// A month of weekly practice: the template, who can do what, the difference between a checkpoint and an
// assessment, what a take has to be, and teacher review. Runs against the database in .env (DATABASE_URL),
// creating throwaway @example.test accounts and deleting them afterwards. Storage is a stand-in, so
// nothing here touches R2.
require("dotenv").config({ quiet: true });

const RUN = `weekly-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

// Before anything loads the routes, which take these functions when they're first required.
const stored = new Map();
Object.assign(require("../src/lib/r2"), {
  isR2Configured: () => true,
  headObject: async (key) => stored.get(key) ?? null,
  signedUrl: async (key) => `https://stand-in.test/${key}`,
  listObjects: async () => [],
  deleteObject: async (key) => stored.delete(key),
});

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { buildMonth } = require("../src/lib/weeklyTemplate");

let server;
let base;
const users = {};
const tokens = {};
let song;

const bars = (times) => times.map((time) => ({ time, chords: [{ name: "C", time }] }));
const CHART = {
  end: 100,
  sections: [
    { name: "Intro", bars: bars([0, 5]) },
    { name: "Verse 1", bars: bars([10, 15, 20, 25]) },
    { name: "Chorus 1", bars: bars([30, 35, 40, 45]) },
    { name: "Verse 2", bars: bars([50, 55, 60, 65]) },
    { name: "Chorus 2", bars: bars([70, 75, 80, 85]) },
    { name: "Outro", bars: bars([90, 95]) },
  ],
};
const START = "2026-11-01";

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// A stored recording for a task, as if it had been uploaded.
function uploaded(assignmentId, extension = "wav") {
  const key = `submissions/${assignmentId}/${crypto.randomUUID()}.${extension}`;
  stored.set(key, extension === "wav" ? { size: 1000, contentType: "audio/wav" } : { size: 5000, contentType: `video/${extension}` });
  return key;
}

const task = (extra = {}) => ({ week: 1, kind: "checkpoint", section: "Verse 1", sectionStart: 10, sectionEnd: 30, instruction: "Loop it.", level: 2, ...extra });

// A month for studentX with one task of each sort asked for, keyed by name.
async function monthOf(tasks) {
  const names = Object.keys(tasks);
  const { status, data } = await call("teacherA", "POST", "/teacher/months", { studentId: users.studentX.id, songId: song.id, startsOn: START, tasks: names.map((n) => tasks[n]) });
  assert.equal(status, 201, JSON.stringify(data));
  return { month: data.month, ...Object.fromEntries(names.map((n, i) => [n, data.month.tasks.find((t) => t.position === i)])) };
}

function take(id, extra = {}, extension = "wav") {
  return call("studentX", "POST", `/assignments/${id}/submit`, { recording: { key: uploaded(id, extension), offset: 10, duration: 20, ...extra } });
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) => prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Guitar", ...data } });
  users.teacherA = await make("teacherA", { role: "teacher" });
  users.teacherB = await make("teacherB", { role: "teacher" });
  users.studentX = await make("studentX", { paidAt: new Date() });
  users.studentY = await make("studentY", { paidAt: new Date() });
  users.minor = await make("minor", { paidAt: new Date(), isMinor: true });
  for (const [key, user] of Object.entries(users)) tokens[key] = signMobileToken(user, "10m");
  await prisma.teacherStudent.createMany({
    data: [
      { teacherId: users.teacherA.id, studentId: users.studentX.id },
      { teacherId: users.teacherA.id, studentId: users.minor.id },
      { teacherId: users.teacherB.id, studentId: users.studentY.id },
    ],
  });
  song = await prisma.song.create({ data: { title: `${RUN} song`, chart: CHART } });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("the template builds four weeks from the sections the song really has", () => {
  const { weekTitles, tasks } = buildMonth(CHART, { startsOn: START, level: 2 });
  assert.deepEqual(weekTitles, ["Learn the parts", "Connect the parts", "Build independence", "Perform"]);
  const week = (n) => tasks.filter((t) => t.week === n);
  const names = (list) => list.map((t) => t.section);

  for (const n of [1, 2, 3, 4]) {
    assert.equal(week(n).filter((t) => t.kind === "assessment").length, 1, `week ${n} has one assessment`);
    const checkpoints = week(n).filter((t) => t.kind === "checkpoint");
    assert.ok(checkpoints.length >= 2 && checkpoints.length <= 3, `week ${n} has two or three checkpoints`);
    assert.equal(week(n).at(-1).kind, "assessment", "the assessment comes last");
  }

  assert.deepEqual(names(week(1)), ["Intro", "Verse 1", "Chorus 1", "Verse 1 + Chorus 1"]);
  assert.deepEqual(names(week(2)), ["Intro into Verse 1", "Verse 1 into Chorus 1", "Chorus 1 into Verse 2", "Intro to Chorus 1"]);
  assert.deepEqual(names(week(3)), ["Verse 2", "Chorus 2", "Earlier feedback", "Intro to Verse 2"]);
  assert.deepEqual(names(week(4)), ["Trouble spots", "Outro", "Whole song or agreed arrangement"]);

  // What each week asks for.
  const assessment = (n) => week(n).at(-1);
  assert.deepEqual([1, 2, 3, 4].map((n) => assessment(n).media), ["audio", "audio", "video", "video"]);
  assert.deepEqual([1, 2, 3, 4].map((n) => assessment(n).support), ["guide", "chart", "solo", "solo"]);
  assert.deepEqual([1, 2, 3, 4].map((n) => assessment(n).targetSpeed), [80, 90, 100, 100]);
  assert.deepEqual([1, 2, 3, 4].map((n) => assessment(n).dueOn), ["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"]);
  assert.equal(tasks.filter((t) => t.kind === "checkpoint" && t.media !== "audio").length, 0, "checkpoints are audio");
  assert.equal(assessment(1).criteria.length, 4);
  assert.equal(week(1)[0].criteria.length, 0);
  // A transition runs from the last two bars of one section into the first two of the next.
  assert.deepEqual([week(2)[1].sectionStart, week(2)[1].sectionEnd], [20, 40]);
  assert.deepEqual([assessment(1).sectionStart, assessment(1).sectionEnd], [10, 50]);
  assert.equal(assessment(4).sectionStart, null);
});

test("the template never invents a section", () => {
  assert.equal(buildMonth(null, { startsOn: START, level: 1 }).tasks.length, 0);

  const odd = { end: 30, sections: [{ name: "A", bars: bars([0, 5]) }, { name: "B", bars: bars([10, 15]) }, { name: "C", bars: bars([20, 25]) }] };
  const real = new Set(["A", "B", "C"]);
  const { tasks } = buildMonth(odd, { startsOn: START, level: 1 });
  const unnamedExtras = new Set(["Earlier feedback", "Trouble spots", "Whole song or agreed arrangement"]);
  for (const t of tasks) {
    if (unnamedExtras.has(t.section)) {
      assert.equal(t.sectionStart, null, "a task that isn't a section of the song has no range");
      continue;
    }
    for (const word of t.section.split(/ (?:to|into|\+) /)) assert.ok(real.has(word), `${t.section} is built from the chart`);
  }

  const one = { end: 20, sections: [{ name: "Main", bars: bars([0, 5, 10, 15]) }] };
  const single = buildMonth(one, { startsOn: START, level: 1 }).tasks;
  assert.equal(single.filter((t) => t.week === 2 && t.kind === "checkpoint").length, 0, "one section has no transitions");
  assert.equal(single.find((t) => t.week === 1 && t.kind === "assessment").section, "Main");
});

test("a student learning to read keeps the chart in the On my own weeks", () => {
  const { tasks } = buildMonth(CHART, { startsOn: START, level: 1, readsChart: true });
  assert.equal(tasks.filter((t) => t.support === "solo").length, 0);
  assert.deepEqual([...new Set(tasks.filter((t) => t.week >= 3).map((t) => t.support))], ["chart"]);
  assert.equal(tasks.filter((t) => t.week === 1 && t.support !== "guide").length, 0);
});

test("only the student's own teacher can plan and change a month", async () => {
  const body = { studentId: users.studentX.id, songId: song.id, startsOn: START, level: 2 };
  assert.equal((await call(null, "POST", "/teacher/months/draft", body)).status, 401);
  assert.equal((await call("studentX", "POST", "/teacher/months/draft", body)).status, 403);
  assert.equal((await call("teacherB", "POST", "/teacher/months/draft", body)).status, 403);
  const draft = await call("teacherA", "POST", "/teacher/months/draft", body);
  assert.equal(draft.status, 200);
  assert.ok(draft.data.draft.tasks.length >= 12);
  assert.equal((await call("teacherA", "POST", "/teacher/months/draft", { ...body, startsOn: "soon" })).status, 400);

  const { weekTitles, tasks } = draft.data.draft;
  const full = { studentId: users.studentX.id, songId: song.id, startsOn: START, weekTitles, tasks };
  assert.equal((await call("teacherB", "POST", "/teacher/months", full)).status, 403);
  const created = await call("teacherA", "POST", "/teacher/months", full);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.month.id;
  // In the order the teacher had them, whatever order they're stored in.
  assert.deepEqual(created.data.month.tasks.map((t) => t.position), tasks.map((_, i) => i));
  assert.equal(created.data.month.sections.length, 6);

  assert.equal((await call("teacherB", "GET", `/teacher/months/${id}`)).status, 404);
  assert.equal((await call("studentX", "GET", `/teacher/months/${id}`)).status, 403);
  assert.equal((await call("teacherB", "PUT", `/teacher/months/${id}`, { startsOn: "2026-12-01" })).status, 404);
  assert.equal((await call("teacherB", "POST", `/teacher/months/${id}/tasks`, task())).status, 404);
  assert.equal((await call("teacherB", "PUT", `/teacher/assignments/${created.data.month.tasks[0].id}`, { targetSpeed: 60 })).status, 404);
  assert.equal((await call("teacherB", "GET", `/teacher/months?studentId=${users.studentX.id}`)).data.months.length, 0);
  assert.equal((await call("teacherA", "GET", `/teacher/months?studentId=${users.studentX.id}`)).data.months.some((m) => m.id === id), true);

  // The student sees it as their own work, and another student doesn't.
  const mine = await call("studentX", "GET", `/assignments/${created.data.month.tasks[0].id}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.assignment.month.id, id);
  assert.equal(mine.data.assignment.week, 1);
  assert.equal((await call("studentY", "GET", `/assignments/${created.data.month.tasks[0].id}`)).status, 404);

  // Once the teacher no longer teaches the student, the month is out of reach.
  await prisma.teacherStudent.delete({ where: { teacherId_studentId: { teacherId: users.teacherA.id, studentId: users.studentX.id } } });
  try {
    assert.equal((await call("teacherA", "GET", `/teacher/months/${id}`)).status, 404);
    assert.equal((await call("teacherA", "PUT", `/teacher/assignments/${created.data.month.tasks[0].id}`, { targetSpeed: 60 })).status, 404);
    assert.equal((await call("teacherA", "POST", "/teacher/months/draft", body)).status, 403);
  } finally {
    await prisma.teacherStudent.create({ data: { teacherId: users.teacherA.id, studentId: users.studentX.id } });
  }
});

test("task settings are checked", async () => {
  const month = (tasks) => call("teacherA", "POST", "/teacher/months", { studentId: users.studentX.id, songId: song.id, startsOn: START, tasks });
  assert.equal((await month([])).status, 400);
  for (const bad of [{ week: 5 }, { week: null }, { kind: "quiz" }, { media: "gif" }, { support: "lots" }, { targetSpeed: 20 }, { targetSpeed: 101 }, { targetSpeed: 75.5 }, { dueOn: "2026-02-30" }, { audioAllowed: "yes" }, { criteria: ["a", "b", "c", "d", "e", "f", "g"] }, { criteria: [""] }]) {
    assert.equal((await month([task(bad)])).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call("teacherA", "POST", "/teacher/months", { studentId: users.studentX.id, songId: song.id, startsOn: START, weekTitles: ["One"], tasks: [task()] })).status, 400);
  assert.equal((await call("teacherA", "POST", "/teacher/months", { studentId: users.studentX.id, songId: "nope", startsOn: START, tasks: [task()] })).status, 400);

  const lesson = await prisma.lesson.create({ data: { title: `${RUN} lesson` } });
  try {
    const base = { studentId: users.studentX.id, lessonId: lesson.id, instrument: "Guitar", level: 1, instruction: "Watch it." };
    assert.equal((await call("teacherA", "POST", "/teacher/assignments", base)).status, 201);
    assert.equal((await call("teacherA", "POST", "/teacher/assignments", { ...base, media: "video" })).status, 400);
    assert.equal((await call("teacherA", "POST", "/teacher/assignments", { ...base, support: "solo" })).status, 400);
  } finally {
    await prisma.assignment.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.lesson.delete({ where: { id: lesson.id } });
  }

  const { one } = await monthOf({ one: task() });
  const edit = (body) => call("teacherA", "PUT", `/teacher/assignments/${one.id}`, body);
  assert.equal((await edit({ week: 9 })).status, 400);
  assert.equal((await edit({ week: null })).status, 400, "a task in a month keeps a week");
  assert.equal((await edit({ instruction: " " })).status, 400);
  assert.equal((await edit({ sectionStart: 40, sectionEnd: 10 })).status, 400);
  const changed = await edit({ week: 2, dueOn: "2026-11-14", support: "chart", targetSpeed: 70, media: "video", audioAllowed: true, instruction: "New words.", level: 3, section: "Verse 1 + Chorus 1", sectionStart: 10, sectionEnd: 50, criteria: ["Steady timing"] });
  assert.equal(changed.status, 200, JSON.stringify(changed.data));
  const a = changed.data.assignment;
  assert.deepEqual([a.week, a.dueOn, a.support, a.targetSpeed, a.media, a.audioAllowed, a.instruction, a.level, a.section, a.sectionEnd], [2, "2026-11-14", "chart", 70, "video", true, "New words.", 3, "Verse 1 + Chorus 1", 50]);
  assert.deepEqual(a.criteria, ["Steady timing"]);
  // Only what was sent changes.
  assert.equal((await edit({ targetSpeed: 75 })).data.assignment.media, "video");

  const added = await call("teacherA", "POST", `/teacher/months/${(await prisma.assignment.findUnique({ where: { id: one.id } })).monthId}/tasks`, task({ week: 3, kind: "assessment" }));
  assert.equal(added.status, 201);
  assert.equal(added.data.assignment.position, 1);
  assert.equal(added.data.assignment.week, 3);
});

test("a checkpoint is saved outside the queue, and an assessment enters it", async () => {
  const { checkpoint, flagged, assessment } = await monthOf({
    checkpoint: task(),
    flagged: task({ reviewCheckpoint: true }),
    assessment: task({ kind: "assessment" }),
  });
  const queue = async () => (await call("teacherA", "GET", "/teacher/assignments?status=ready&page=1&pageSize=100")).data.assignments.map((a) => a.id);

  assert.equal((await take(checkpoint.id)).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${checkpoint.id}`)).data.assignment.status, "saved");
  assert.equal((await queue()).includes(checkpoint.id), false, "a saved checkpoint isn't in the queue");
  // But the teacher can open it and hear it.
  const inspect = await call("teacherA", "GET", `/teacher/assignments/${checkpoint.id}`);
  assert.equal(inspect.status, 200);
  assert.ok(inspect.data.assignment.submissions[0].recording.url);
  // Saved again and again, each one kept.
  assert.equal((await take(checkpoint.id)).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${checkpoint.id}`)).data.assignment.submissions.length, 2);

  assert.equal((await queue()).includes(assessment.id), false, "nothing's in the queue before it's submitted");
  assert.equal((await take(flagged.id)).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${flagged.id}`)).data.assignment.status, "ready");
  assert.equal((await queue()).includes(flagged.id), true, "a checkpoint the teacher flagged is in the queue");

  // Saving a checkpoint submits nothing else, and an assessment doesn't wait for its checkpoints.
  assert.equal((await call("studentX", "GET", `/assignments/${assessment.id}`)).data.assignment.status, "assigned");
  assert.equal((await take(assessment.id, { support: "guide" })).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${assessment.id}`)).data.assignment.status, "ready");
  assert.equal((await queue()).includes(assessment.id), true);
});

test("editing a task moves sent work in or out of the queue", async () => {
  const { a, b } = await monthOf({ a: task(), b: task({ kind: "assessment" }) });
  const edit = (id, body) => call("teacherA", "PUT", `/teacher/assignments/${id}`, body);
  const status = async (id) => (await call("studentX", "GET", `/assignments/${id}`)).data.assignment.status;

  await take(a.id);
  assert.equal(await status(a.id), "saved");
  await edit(a.id, { reviewCheckpoint: true });
  assert.equal(await status(a.id), "ready", "flagging a saved checkpoint puts it in the queue");
  await edit(a.id, { reviewCheckpoint: false });
  assert.equal(await status(a.id), "saved");
  await edit(a.id, { kind: "assessment" });
  assert.equal(await status(a.id), "assigned", "a saved checkpoint was never submitted for assessment");

  await take(b.id);
  assert.equal(await status(b.id), "ready");
  await edit(b.id, { kind: "checkpoint" });
  assert.equal(await status(b.id), "saved");
});

test("what a take has to be", async () => {
  const { needs, video, either, slow, help, practice } = await monthOf({
    needs: task({ kind: "assessment" }),
    video: task({ kind: "assessment", media: "video" }),
    either: task({ kind: "assessment", media: "video", audioAllowed: true }),
    slow: task({ kind: "assessment", targetSpeed: 90 }),
    help: task({ kind: "assessment", support: "chart" }),
    practice: task({ support: "solo", targetSpeed: 100 }),
  });

  // A task in a month needs a take.
  assert.equal((await call("studentX", "POST", `/assignments/${needs.id}/submit`, {})).status, 400);

  // Audio or video, as asked.
  assert.equal((await take(video.id)).status, 400);
  assert.equal((await take(needs.id, {}, "mp4")).status, 400, "an audio task doesn't take a video");
  const filmed = await take(video.id, { speed: 1, support: "solo" }, "mp4");
  assert.equal(filmed.status, 201, JSON.stringify(filmed.data));
  assert.deepEqual([filmed.data.submission.recording.media, filmed.data.submission.recording.type, filmed.data.submission.recording.size], ["video", "video/mp4", 5000]);
  assert.equal((await take(either.id)).status, 201, "audio is accepted where the teacher allows it");

  // At least the target speed.
  const tooSlow = await take(slow.id, { speed: 0.75 });
  assert.equal(tooSlow.status, 400);
  assert.match(tooSlow.data.error, /stays as practice/);
  assert.equal((await take(slow.id, { speed: 0.9 })).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${slow.id}`)).data.assignment.submissions[0].recording.speed, 0.9);
  assert.equal((await take(slow.id, { speed: 1 })).status, 201);

  // No more help than it allows; less is fine.
  const tooMuch = await take(help.id, { support: "guide" });
  assert.equal(tooMuch.status, 400);
  assert.match(tooMuch.data.error, /Chart only/);
  assert.equal((await take(help.id, { support: "chart" })).status, 201);
  assert.equal((await take(help.id, { support: "solo" })).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${help.id}`)).data.assignment.submissions[0].recording.support, "solo");

  // A checkpoint can be saved however it was practised.
  assert.equal((await take(practice.id, { speed: 0.5, support: "guide" })).status, 201);

  // Checked against what's really stored.
  const wrongType = uploaded(needs.id);
  stored.set(wrongType, { size: 1000, contentType: "text/plain" });
  assert.equal((await call("studentX", "POST", `/assignments/${needs.id}/submit`, { recording: { key: wrongType } })).status, 400);
  assert.equal((await call("studentX", "POST", `/assignments/${needs.id}/submit`, { recording: { key: `submissions/${needs.id}/${crypto.randomUUID()}.wav` } })).status, 400, "never uploaded");
  assert.equal((await call("studentX", "POST", `/assignments/${needs.id}/submit`, { recording: { key: uploaded(video.id) } })).status, 400, "another task's recording");
});

test("a minor without a guardian's yes sends audio for a video task", async () => {
  const created = await call("teacherA", "POST", "/teacher/months", { studentId: users.minor.id, songId: song.id, startsOn: START, tasks: [task({ kind: "assessment", media: "video" })] });
  assert.equal(created.status, 201);
  const id = created.data.month.tasks[0].id;
  assert.equal(created.data.month.canFilm, false);
  assert.equal((await call("minor", "GET", `/assignments/${id}`)).data.canFilm, false);

  const send = () => call("minor", "POST", `/assignments/${id}/submit`, { recording: { key: uploaded(id), offset: 0, duration: 5 } });
  assert.equal((await send()).status, 201, "audio is the alternative until a guardian says yes");

  // A minor can't say yes for themselves.
  assert.equal((await call("minor", "POST", "/me/consents", { purpose: "practice-video", granted: true })).status, 403);
  assert.equal((await call("minor", "GET", `/assignments/${id}`)).data.canFilm, false);

  await prisma.consentRecord.create({ data: { userId: users.minor.id, givenById: users.teacherA.id, purpose: "practice-video", granted: true } });
  assert.equal((await call("minor", "GET", `/assignments/${id}`)).data.canFilm, true);
  const asked = await send();
  assert.equal(asked.status, 400, "once allowed, the task asks for video again");
  assert.match(asked.data.error, /video/);
});

test("a teacher marks an assessment and picks priorities for next week", async () => {
  const { assessment, checkpoint } = await monthOf({ assessment: task({ kind: "assessment", criteria: ["Steady timing", "Clean transitions"] }), checkpoint: task() });
  const first = await take(assessment.id);
  const path = `/teacher/submissions/${first.data.submission.id}/feedback`;
  const feedback = "Nicely steady.";

  for (const bad of [{ marks: [{ criterion: "Steady timing", mark: "wow" }] }, { marks: [{ mark: "got-it" }] }, { priorities: ["a", "b", "c"] }, { priorities: ["x".repeat(121)] }]) {
    assert.equal((await call("teacherA", "PUT", path, { feedback, ...bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call("teacherB", "PUT", path, { feedback })).status, 404);

  const marks = [{ criterion: "Steady timing", mark: "got-it" }, { criterion: "Clean transitions", mark: "work-on" }];
  const priorities = ["Wait for beat 1 at the chorus", "Keep strumming through the change"];
  const notes = [{ at: 31, text: "Rushing here." }];
  const saved = await call("teacherA", "PUT", path, { feedback, marks, priorities, notes });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));

  const seen = (await call("studentX", "GET", `/assignments/${assessment.id}`)).data.assignment;
  assert.equal(seen.status, "reviewed");
  assert.deepEqual(seen.submissions[0].marks, marks);
  assert.deepEqual(seen.submissions[0].priorities, priorities);
  assert.deepEqual(seen.submissions[0].notes, notes);

  // Replying without them leaves them; sending the work again is a new attempt.
  await call("teacherA", "PUT", path, { feedback: "Nicely steady, again." });
  assert.deepEqual((await call("studentX", "GET", `/assignments/${assessment.id}`)).data.assignment.submissions[0].priorities, priorities);
  assert.equal((await take(assessment.id)).status, 201);
  const again = (await call("studentX", "GET", `/assignments/${assessment.id}`)).data.assignment;
  assert.equal(again.status, "ready");
  assert.equal(again.submissions.length, 2);
  assert.deepEqual(again.submissions[1].priorities, priorities, "the earlier reply is kept");

  // A checkpoint can be replied to, without having been in the queue.
  const saved2 = await take(checkpoint.id);
  assert.equal((await call("teacherA", "PUT", `/teacher/submissions/${saved2.data.submission.id}/feedback`, { feedback: "Good." })).status, 200);
  assert.equal((await call("studentX", "GET", `/assignments/${checkpoint.id}`)).data.assignment.status, "reviewed");
});

test("work set before weeks existed behaves as it always did", async () => {
  const created = await call("teacherA", "POST", "/teacher/assignments", { studentId: users.studentX.id, songId: song.id, instrument: "Guitar", level: 2, section: "Chorus", instruction: "Strum it." });
  assert.equal(created.status, 201);
  const a = created.data.assignment;
  assert.deepEqual([a.kind, a.media, a.support, a.targetSpeed, a.week, a.month, a.dueOn], ["assessment", "audio", null, null, null, null, null]);
  assert.deepEqual(a.criteria, []);

  // A take stays optional, and it goes to the teacher.
  assert.equal((await call("studentX", "POST", `/assignments/${a.id}/submit`, {})).status, 201);
  const seen = (await call("studentX", "GET", `/assignments/${a.id}`)).data.assignment;
  assert.equal(seen.status, "ready");
  assert.equal(seen.submissions[0].recording, null);

  // An older phone app sends a take with none of the new details.
  const key = uploaded(a.id);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const phone = await call("studentX", "POST", `/assignments/${a.id}/submit`, { recording: { key, offset: 1, duration: 2 } });
  assert.equal(phone.status, 201, JSON.stringify(phone.data));
  assert.deepEqual([phone.data.submission.recording.media, phone.data.submission.recording.speed, phone.data.submission.recording.support], ["audio", 1, null]);

  // A week can't be put on it.
  assert.equal((await call("teacherA", "PUT", `/teacher/assignments/${a.id}`, { week: 2 })).status, 400);
  assert.equal((await call("teacherA", "POST", "/teacher/assignments", { studentId: users.studentX.id, songId: song.id, instrument: "Guitar", level: 2, instruction: "Strum it.", week: 2 })).data.assignment.week, null);
});
