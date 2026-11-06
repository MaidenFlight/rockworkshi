// Rules shared by the teacher routes (/teacher) and the student routes (/assignments).
const crypto = require("crypto");
const { INSTRUMENTS, MAX_LEVEL, LEVEL_NAMES } = require("./lessonVideos");
const { isR2Configured, signedUrl, listObjects, deleteObject } = require("./r2");

// User.role values. The admin isn't one of them: it's whoever has ADMIN_EMAIL.
const ROLES = ["student", "teacher"];
const STATUSES = ["assigned", "ready", "reviewed"];

const MAX_INSTRUCTION = 500;
const MAX_SECTION = 80;
const MAX_FEEDBACK = 2000;

// The phone uploads 16-bit mono WAV, about 5.8 MB a minute at 48 kHz.
const RECORDING_TYPE = "audio/wav";
const MAX_RECORDING_BYTES = 40 * 1024 * 1024;
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
};

// Lists only need the newest submission, to show whether feedback is waiting.
const LIST_INCLUDE = { ...ASSIGNMENT_INCLUDE, submissions: { orderBy: { createdAt: "desc" }, take: 1 } };

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
    },
  };
}

function validateFeedback(feedback) {
  const text = cleanText(feedback, MAX_FEEDBACK);
  if (text.error || !text.value) return { error: `Feedback must be 1 to ${MAX_FEEDBACK} characters.` };
  return { value: text.value };
}

// Keys are random and namespaced by assignment, so a student can only attach
// a recording uploaded through this assignment's upload link.
function recordingPrefix(assignmentId) {
  return `submissions/${assignmentId}/`;
}

function newRecordingKey(assignmentId) {
  return `${recordingPrefix(assignmentId)}${crypto.randomUUID()}.wav`;
}

function isRecordingKeyFor(assignmentId, key) {
  return (
    typeof key === "string" &&
    key.startsWith(recordingPrefix(assignmentId)) &&
    /^submissions\/[^/]+\/[0-9a-f-]{36}\.wav$/.test(key)
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
    recording = { offset: s.recordingOffset, duration: s.recordingDuration };
    if (linkSeconds && isR2Configured()) recording.url = await signedUrl(s.recordingKey, linkSeconds);
  }
  return {
    id: s.id,
    createdAt: s.createdAt,
    recording,
    feedback: s.feedback,
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
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    // Both null means the song or lesson was deleted after it was assigned.
    song: a.song || null,
    lesson: a.lesson || null,
    teacher: a.teacher ? { id: a.teacher.id, name: a.teacher.name } : null,
    student: a.student || null,
    submissions: await Promise.all((a.submissions || []).map((s) => presentSubmission(s, linkSeconds))),
  };
}

module.exports = {
  ROLES,
  STATUSES,
  LEVEL_NAMES,
  MAX_FEEDBACK,
  RECORDING_TYPE,
  MAX_RECORDING_BYTES,
  UPLOAD_LINK_SECONDS,
  RECORDING_LINK_SECONDS,
  MAX_UNSENT_RECORDINGS,
  ASSIGNMENT_INCLUDE,
  LIST_INCLUDE,
  validateAssignment,
  validateFeedback,
  newRecordingKey,
  isRecordingKeyFor,
  deleteRecordings,
  deleteAssignmentRecordings,
  tidyUnsentRecordings,
  presentSubmission,
  presentAssignment,
};
