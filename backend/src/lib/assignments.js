// Rules shared by the teacher routes (/teacher) and the student routes (/assignments).
const crypto = require("crypto");
const { INSTRUMENTS, MAX_LEVEL, LEVEL_NAMES } = require("./lessonVideos");
const { isR2Configured, signedUrl, listObjects, deleteObject } = require("./r2");
const { isDateString } = require("./zoned");

// User.role values. The admin isn't one of them: it's whoever has ADMIN_EMAIL.
const ROLES = ["student", "teacher"];
// "saved" is a checkpoint's take, there to look at and outside the teacher's queue; "ready" is in it.
const STATUSES = ["assigned", "saved", "ready", "reviewed"];

// What a task can ask for (prisma Assignment).
const KINDS = ["checkpoint", "assessment"];
const MEDIA = ["audio", "video"];
// How much help a take had, from least to most: the player's On my own, Chart only and Guide me.
const SUPPORTS = ["solo", "chart", "guide"];
const HELP_NAMES = { solo: "On my own", chart: "Chart only", guide: "Guide me" };
const MIN_TARGET_SPEED = 50;
const MAX_TARGET_SPEED = 100;
const WEEKS = 4;
const MAX_CRITERIA = 6;
const MAX_CRITERION = 80;
const MAX_WEEK_TITLE = 40;
const MAX_MONTH_TASKS = 24;
// The teacher's mark for one criterion.
const MARKS = ["got-it", "getting-there", "work-on"];
const MAX_PRIORITIES = 2;
const MAX_PRIORITY = 120;

const MAX_INSTRUCTION = 500;
const MAX_SECTION = 80;
const MAX_FEEDBACK = 2000;

// The phone uploads 16-bit mono WAV, about 5.8 MB a minute at 48 kHz.
const RECORDING_TYPE = "audio/wav";
const MAX_RECORDING_BYTES = 40 * 1024 * 1024;
// Video comes from the browser's own recorder: MP4 where it can, otherwise WebM.
const VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm" };
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 8 * 60;
const VIDEO_PART_BYTES = 8 * 1024 * 1024;
const UPLOAD_LINK_SECONDS = 10 * 60;
const RECORDING_LINK_SECONDS = 15 * 60;
// A take uploaded but never sent: kept this long in case sending is retried, and only this
// many at once per assignment, so upload links can't fill the bucket.
const UNSENT_RECORDING_MS = 60 * 60 * 1000;
const MAX_UNSENT_RECORDINGS = 5;

const ASSIGNMENT_INCLUDE = {
  song: { select: { id: true, title: true, artist: true } },
  lesson: { select: { id: true, title: true, artist: true } },
  teacher: { select: { id: true, name: true } },
  student: { select: { id: true, name: true, instrument: true } },
  submissions: { orderBy: { createdAt: "desc" } },
  month: { select: { id: true, startsOn: true, weekTitles: true } },
};

// Lists only need the newest submission, to show whether feedback is waiting, and how many were sent.
const LIST_INCLUDE = { ...ASSIGNMENT_INCLUDE, submissions: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { submissions: true } } };

// Trims optional text. { value } (null when empty) or { error }.
function cleanText(value, max) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: true };
  const s = value.trim();
  if (s.length > max) return { error: true };
  return { value: s || null };
}

function isBlank(value) {
  return value === undefined || value === null || value === "";
}

// Validates a teacher's new assignment. Returns { error } or { data } without teacherId.
// Whether the teacher may assign to this student is checked by the route.
function validateAssignment(body = {}) {
  const { studentId, songId, lessonId, instrument, level, section, sectionStart, sectionEnd, instruction } = body;

  if (typeof studentId !== "string" || !studentId) return { error: "Choose a student." };

  const hasSong = typeof songId === "string" && songId !== "";
  const hasLesson = typeof lessonId === "string" && lessonId !== "";
  if (hasSong === hasLesson) return { error: "Choose either a song or a lesson." };

  if (!INSTRUMENTS.includes(instrument)) {
    return { error: `instrument must be one of: ${INSTRUMENTS.join(", ")}.` };
  }

  const n = Number(level);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LEVEL) {
    return { error: `level must be a whole number from 1 to ${MAX_LEVEL}.` };
  }

  const sectionText = cleanText(section, MAX_SECTION);
  if (sectionText.error) return { error: `The section name must be ${MAX_SECTION} characters or fewer.` };

  const instructionText = cleanText(instruction, MAX_INSTRUCTION);
  if (instructionText.error || !instructionText.value) {
    return { error: `Write a practice instruction of up to ${MAX_INSTRUCTION} characters.` };
  }

  // Section times are optional, come as a pair, and only mean something on a song.
  let start = null;
  let end = null;
  if (!isBlank(sectionStart) || !isBlank(sectionEnd)) {
    if (!hasSong) return { error: "Section times can only be set on a song." };
    start = Number(sectionStart);
    end = Number(sectionEnd);
    if (isBlank(sectionStart) || isBlank(sectionEnd) || !Number.isFinite(start) || !Number.isFinite(end)) {
      return { error: "Give the section both a start and an end time." };
    }
    if (start < 0 || end <= start) return { error: "The section must end after it starts." };
  }

  const settings = validateTaskSettings(body);
  if (settings.error) return { error: settings.error };
  const task = { ...TASK_DEFAULTS, ...settings.data };
  if (!hasSong && asksForATake(task)) return { error: SONG_ONLY };

  return {
    data: {
      studentId,
      songId: hasSong ? songId : null,
      lessonId: hasLesson ? lessonId : null,
      instrument,
      level: n,
      section: sectionText.value,
      sectionStart: start,
      sectionEnd: end,
      instruction: instructionText.value,
      ...task,
    },
  };
}

// What a task is if the teacher says nothing else: how all work was before tasks had settings.
const TASK_DEFAULTS = {
  kind: "assessment",
  reviewCheckpoint: false,
  media: "audio",
  audioAllowed: false,
  support: null,
  targetSpeed: null,
  week: null,
  dueOn: null,
  criteria: [],
};
const SONG_ONLY = "Video, help and speed requirements can only be set on a song.";
const asksForATake = (task) => task.media === "video" || Boolean(task.support) || Boolean(task.targetSpeed);

// The settings besides what a task is about. Only what's in the body comes back, so an edit changes
// only what it sends. Returns { error } or { data }.
function validateTaskSettings(body = {}) {
  const data = {};
  if (body.kind !== undefined) {
    if (!KINDS.includes(body.kind)) return { error: "A task is either a checkpoint or an assessment." };
    data.kind = body.kind;
  }
  if (body.media !== undefined) {
    if (!MEDIA.includes(body.media)) return { error: "A task asks for either audio or video." };
    data.media = body.media;
  }
  for (const flag of ["audioAllowed", "reviewCheckpoint"]) {
    if (body[flag] === undefined) continue;
    if (typeof body[flag] !== "boolean") return { error: `${flag} must be true or false.` };
    data[flag] = body[flag];
  }
  if (body.support !== undefined) {
    if (isBlank(body.support)) data.support = null;
    else if (!SUPPORTS.includes(body.support)) return { error: "Choose Guide me, Chart only or On my own." };
    else data.support = body.support;
  }
  if (body.targetSpeed !== undefined) {
    if (isBlank(body.targetSpeed)) data.targetSpeed = null;
    else {
      const speed = Number(body.targetSpeed);
      if (!Number.isInteger(speed) || speed < MIN_TARGET_SPEED || speed > MAX_TARGET_SPEED) {
        return { error: `The target speed must be a whole percentage from ${MIN_TARGET_SPEED} to ${MAX_TARGET_SPEED}.` };
      }
      data.targetSpeed = speed;
    }
  }
  if (body.week !== undefined) {
    if (isBlank(body.week)) data.week = null;
    else {
      const week = Number(body.week);
      if (!Number.isInteger(week) || week < 1 || week > WEEKS) return { error: `The week must be from 1 to ${WEEKS}.` };
      data.week = week;
    }
  }
  if (body.dueOn !== undefined) {
    if (isBlank(body.dueOn)) data.dueOn = null;
    else if (!isDateString(body.dueOn)) return { error: "Give the due date as a real date." };
    else data.dueOn = body.dueOn;
  }
  if (body.criteria !== undefined) {
    const criteria = validateCriteria(body.criteria);
    if (criteria.error) return { error: criteria.error };
    data.criteria = criteria.value;
  }
  return { data };
}

function validateCriteria(list) {
  if (list === null) return { value: [] };
  if (!Array.isArray(list) || list.length > MAX_CRITERIA) return { error: `Up to ${MAX_CRITERIA} assessment criteria.` };
  const value = [];
  for (const item of list) {
    const text = cleanText(item, MAX_CRITERION);
    if (text.error || !text.value) return { error: `Each criterion needs 1 to ${MAX_CRITERION} characters.` };
    value.push(text.value);
  }
  return { value };
}

// A change to a task that already exists. Which student and song it's for stay as they are; a week
// only means something inside a month. Returns { error } or { data } with just what changes.
function validateTaskEdit(body = {}, current) {
  const settings = validateTaskSettings(body);
  if (settings.error) return { error: settings.error };
  const data = settings.data;

  if (body.level !== undefined) {
    const n = Number(body.level);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LEVEL) return { error: `level must be a whole number from 1 to ${MAX_LEVEL}.` };
    data.level = n;
  }
  if (body.section !== undefined) {
    const text = cleanText(body.section, MAX_SECTION);
    if (text.error) return { error: `The section name must be ${MAX_SECTION} characters or fewer.` };
    data.section = text.value;
  }
  if (body.instruction !== undefined) {
    const text = cleanText(body.instruction, MAX_INSTRUCTION);
    if (text.error || !text.value) return { error: `Write a practice instruction of up to ${MAX_INSTRUCTION} characters.` };
    data.instruction = text.value;
  }
  if (body.sectionStart !== undefined || body.sectionEnd !== undefined) {
    if (isBlank(body.sectionStart) && isBlank(body.sectionEnd)) {
      data.sectionStart = null;
      data.sectionEnd = null;
    } else {
      if (!current.songId) return { error: "Section times can only be set on a song." };
      const start = Number(body.sectionStart);
      const end = Number(body.sectionEnd);
      if (isBlank(body.sectionStart) || isBlank(body.sectionEnd) || !Number.isFinite(start) || !Number.isFinite(end)) {
        return { error: "Give the section both a start and an end time." };
      }
      if (start < 0 || end <= start) return { error: "The section must end after it starts." };
      data.sectionStart = start;
      data.sectionEnd = end;
    }
  }
  if (!current.monthId && data.week) return { error: "Only a task in a month has a week." };
  if (current.monthId && data.week === null) return { error: "Choose a week for this task." };
  if (!current.songId && asksForATake({ ...current, ...data })) return { error: SONG_ONLY };
  return { data };
}

// Where a task stands after an edit. Sent work moves in or out of the teacher's queue with the task; a
// take saved as a checkpoint was never submitted for assessment, so that still has to be done.
function statusAfterEdit(before, after) {
  if (before.status !== "saved" && before.status !== "ready") return before.status;
  if (after.kind === "checkpoint") return after.reviewCheckpoint ? "ready" : "saved";
  return before.kind === "assessment" ? before.status : "assigned";
}

// Four short names, one per week. Returns { error } or { value }.
function validateWeekTitles(titles) {
  if (!Array.isArray(titles) || titles.length !== WEEKS) return { error: `Give each of the ${WEEKS} weeks a name.` };
  const value = [];
  for (const title of titles) {
    const text = cleanText(title, MAX_WEEK_TITLE);
    if (text.error || !text.value) return { error: `Each week's name needs 1 to ${MAX_WEEK_TITLE} characters.` };
    value.push(text.value);
  }
  return { value };
}

// A task in a month always ends in a take, and a video task can't be done without one.
function needsTake(task) {
  return Boolean(task.monthId) || task.media === "video";
}

// What a take sent for this task can't be, as a sentence for the student, or null if it's fine.
// take = { media, support, speed }; canFilm says whether this student may record video at all, since
// one who can't is offered audio instead. support is left out by the phone app, and isn't checked
// then: these rules help a student know what's being asked, and don't try to catch anyone out.
function takeProblem(task, take, { canFilm }) {
  if (task.media === "audio" && take.media === "video") return "This task asks for audio, so record it without the camera.";
  if (take.media === "video" && !canFilm) return NEEDS_GUARDIAN;
  if (task.media === "video" && take.media === "audio" && !task.audioAllowed && canFilm) {
    return "This task asks for a video. Record it on the website, with the camera on.";
  }
  if (task.kind !== "assessment") return null;
  if (task.support && take.support && SUPPORTS.indexOf(take.support) > SUPPORTS.indexOf(task.support)) {
    return `This take used more help than the assessment asks for, so it stays as practice. Record a new take with ${HELP_NAMES[task.support]} for the assessment.`;
  }
  // Half a percent of slack, for a speed that's only nearly the target after rounding.
  if (task.targetSpeed && (take.speed ?? 1) * 100 < task.targetSpeed - 0.5) {
    return `This take is slower than the assessment's ${task.targetSpeed}%, so it stays as practice. Record a new take at ${task.targetSpeed}% for the assessment.`;
  }
  return null;
}

const NEEDS_GUARDIAN = "A parent or guardian needs to turn on Practice videos on their family page first. You can send audio instead.";

// Where a task goes when a take is sent: a checkpoint is saved, outside the queue, unless the teacher
// asked to review it; anything else is waiting for the teacher.
function statusAfterSend(task) {
  return task.kind === "checkpoint" && !task.reviewCheckpoint ? "saved" : "ready";
}

// The teacher's mark for each criterion: [{ criterion, mark }]. undefined leaves what's saved.
function validateMarks(marks) {
  if (marks === undefined) return { value: undefined };
  if (marks === null) return { value: [] };
  if (!Array.isArray(marks) || marks.length > MAX_CRITERIA) return { error: `Up to ${MAX_CRITERIA} marks, one for each criterion.` };
  const value = [];
  for (const entry of marks) {
    const criterion = cleanText(entry?.criterion, MAX_CRITERION);
    if (criterion.error || !criterion.value || !MARKS.includes(entry?.mark)) return { error: "Each mark needs a criterion and one of the three marks." };
    value.push({ criterion: criterion.value, mark: entry.mark });
  }
  return { value };
}

// One or two things to work on next week. undefined leaves what's saved.
function validatePriorities(list) {
  if (list === undefined) return { value: undefined };
  if (list === null) return { value: [] };
  if (!Array.isArray(list) || list.length > MAX_PRIORITIES) return { error: `Up to ${MAX_PRIORITIES} priorities for next week.` };
  const value = [];
  for (const item of list) {
    const text = cleanText(item, MAX_PRIORITY);
    if (text.error) return { error: `Each priority can be up to ${MAX_PRIORITY} characters.` };
    if (text.value) value.push(text.value);
  }
  return { value };
}

function validateFeedback(feedback) {
  const text = cleanText(feedback, MAX_FEEDBACK);
  if (text.error || !text.value) return { error: `Feedback must be 1 to ${MAX_FEEDBACK} characters.` };
  return { value: text.value };
}

const MAX_NOTES = 20;
const MAX_NOTE = 280;
// No song is longer than this, so a moment past it is a mistake.
const MAX_NOTE_AT = 60 * 60;

// The teacher's notes tied to moments in the song: [{ at: seconds, text }], sorted by time. undefined
// leaves the saved notes as they are (an older client sends feedback alone); null or [] clears them.
function validateNotes(notes) {
  if (notes === undefined) return { value: undefined };
  if (notes === null) return { value: [] };
  if (!Array.isArray(notes) || notes.length > MAX_NOTES) return { error: `Up to ${MAX_NOTES} notes, each a moment in the song and a line about it.` };
  const value = [];
  for (const note of notes) {
    const at = Number(note?.at);
    if (!Number.isFinite(at) || at < 0 || at > MAX_NOTE_AT) return { error: "Each note needs a moment in the song." };
    const text = cleanText(note?.text, MAX_NOTE);
    if (text.error || !text.value) return { error: `Each note needs 1 to ${MAX_NOTE} characters.` };
    value.push({ at: Math.round(at * 100) / 100, text: text.value });
  }
  value.sort((a, b) => a.at - b.at);
  return { value };
}

// Keys are random and namespaced by assignment, so a student can only attach
// a recording uploaded through this assignment's upload link.
function recordingPrefix(assignmentId) {
  return `submissions/${assignmentId}/`;
}

function newRecordingKey(assignmentId, extension = "wav") {
  return `${recordingPrefix(assignmentId)}${crypto.randomUUID()}.${extension}`;
}

// A key's kind of recording, from its extension (newRecordingKey).
function mediaOfKey(key) {
  return key.endsWith(".wav") ? "audio" : "video";
}

function isRecordingKeyFor(assignmentId, key) {
  return (
    typeof key === "string" &&
    key.startsWith(recordingPrefix(assignmentId)) &&
    /^submissions\/[^/]+\/[0-9a-f-]{36}\.(wav|mp4|webm)$/.test(key)
  );
}

// Removes recordings from R2 before their rows are deleted. A failure is logged and leaves a
// private, unreachable object behind rather than blocking the delete.
async function deleteRecordings(keys) {
  const list = keys.filter(Boolean);
  if (!list.length || !isR2Configured()) return;
  const results = await Promise.allSettled(list.map((key) => deleteObject(key)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`Could not delete recording ${list[i]}:`, r.reason);
  });
}

// Everything stored for these assignments, including takes that were uploaded but never sent
// and so appear on no Submission row. Call it once the rows are gone.
async function deleteAssignmentRecordings(assignmentIds) {
  if (!assignmentIds.length || !isR2Configured()) return;
  const results = await Promise.allSettled(
    assignmentIds.map(async (id) => deleteRecordings((await listObjects(recordingPrefix(id))).map((o) => o.key)))
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`Could not list recordings for assignment ${assignmentIds[i]}:`, r.reason);
  });
}

// Deletes takes abandoned long enough ago, and returns how many recent unsent ones remain.
async function tidyUnsentRecordings(assignmentId, sentKeys) {
  const sent = new Set(sentKeys);
  const unsent = (await listObjects(recordingPrefix(assignmentId))).filter((o) => !sent.has(o.key));
  const cutoff = Date.now() - UNSENT_RECORDING_MS;
  const abandoned = unsent.filter((o) => o.lastModified.getTime() < cutoff);
  await deleteRecordings(abandoned.map((o) => o.key));
  return unsent.length - abandoned.length;
}

// linkSeconds signs a short-lived playback link for each recording. Lists leave it out.
async function presentSubmission(s, linkSeconds) {
  let recording = null;
  if (s.recordingKey) {
    recording = {
      offset: s.recordingOffset,
      duration: s.recordingDuration,
      media: s.media,
      type: s.recordingType ?? RECORDING_TYPE,
      size: s.recordingSize,
      speed: s.speed ?? 1,
      support: s.support,
    };
    if (linkSeconds && isR2Configured()) recording.url = await signedUrl(s.recordingKey, linkSeconds);
  }
  return {
    id: s.id,
    createdAt: s.createdAt,
    recording,
    feedback: s.feedback,
    notes: Array.isArray(s.notes) ? s.notes : [],
    marks: Array.isArray(s.marks) ? s.marks : [],
    priorities: Array.isArray(s.priorities) ? s.priorities : [],
    reviewedAt: s.reviewedAt,
  };
}

async function presentAssignment(a, { linkSeconds } = {}) {
  return {
    id: a.id,
    status: a.status,
    instrument: a.instrument,
    level: a.level,
    levelName: LEVEL_NAMES[a.level - 1] || null,
    section: a.section,
    sectionStart: a.sectionStart,
    sectionEnd: a.sectionEnd,
    instruction: a.instruction,
    kind: a.kind,
    reviewCheckpoint: a.reviewCheckpoint,
    media: a.media,
    audioAllowed: a.audioAllowed,
    support: a.support,
    targetSpeed: a.targetSpeed,
    criteria: Array.isArray(a.criteria) ? a.criteria : [],
    week: a.week,
    position: a.position,
    dueOn: a.dueOn,
    month: a.month || null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    // Both null means the song or lesson was deleted after it was assigned.
    song: a.song || null,
    lesson: a.lesson || null,
    teacher: a.teacher ? { id: a.teacher.id, name: a.teacher.name } : null,
    student: a.student || null,
    submissions: await Promise.all((a.submissions || []).map((s) => presentSubmission(s, linkSeconds))),
    // How many times it was sent. A list carries only the newest submission, so it's counted apart.
    attempts: a._count?.submissions ?? (a.submissions || []).length,
  };
}

module.exports = {
  ROLES,
  STATUSES,
  KINDS,
  MEDIA,
  SUPPORTS,
  HELP_NAMES,
  WEEKS,
  MARKS,
  MAX_MONTH_TASKS,
  LEVEL_NAMES,
  MAX_FEEDBACK,
  RECORDING_TYPE,
  MAX_RECORDING_BYTES,
  VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  VIDEO_PART_BYTES,
  NEEDS_GUARDIAN,
  UPLOAD_LINK_SECONDS,
  RECORDING_LINK_SECONDS,
  MAX_UNSENT_RECORDINGS,
  ASSIGNMENT_INCLUDE,
  LIST_INCLUDE,
  validateAssignment,
  validateTaskEdit,
  statusAfterEdit,
  validateWeekTitles,
  needsTake,
  takeProblem,
  statusAfterSend,
  validateFeedback,
  validateNotes,
  validateMarks,
  validatePriorities,
  newRecordingKey,
  mediaOfKey,
  isRecordingKeyFor,
  deleteRecordings,
  deleteAssignmentRecordings,
  tidyUnsentRecordings,
  presentSubmission,
  presentAssignment,
};
