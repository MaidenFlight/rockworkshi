// The assessment inbox: what enters the queue, in what order, what happens on a resubmission, the
// filters, moving to the next one, and whose work a teacher can see. Runs against the database in .env
// (DATABASE_URL), with throwaway @example.test accounts deleted afterwards. Storage is a stand-in.
require("dotenv").config({ quiet: true });

const RUN = `inbox-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

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

let server;
let base;
const users = {};
const tokens = {};
let song;
let classA;
let classB;

const START = "2026-12-07";
const CHART = { end: 40, sections: [{ name: "Verse 1", bars: [{ time: 0, chords: [] }, { time: 10, chords: [] }] }, { name: "Chorus 1", bars: [{ time: 20, chords: [] }, { time: 30, chords: [] }] }] };

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function uploaded(assignmentId, extension = "wav") {
  const key = `submissions/${assignmentId}/${crypto.randomUUID()}.${extension}`;
  stored.set(key, extension === "wav" ? { size: 1000, contentType: "audio/wav" } : { size: 5000, contentType: `video/${extension}` });
  return key;
}

const take = (who, id, extra = {}, extension = "wav") => call(who, "POST", `/assignments/${id}/submit`, { recording: { key: uploaded(id, extension), offset: 0, duration: 20, ...extra } });

let tick = 0;
// Makes a send look like it happened at a known moment, so the queue's order can be checked.
async function age(submissionId, minutesAgo = 1000 - tick++ * 10) {
  await prisma.submission.update({ where: { id: submissionId }, data: { createdAt: new Date(Date.now() - minutesAgo * 60000) } });
}

const task = (extra = {}) => ({ week: 1, kind: "assessment", section: "Verse 1", sectionStart: 0, sectionEnd: 20, instruction: "Play it.", level: 2, ...extra });

// A month for one student through the existing route, with its tasks named.
async function monthFor(name, tasks, teacher = "teacherA") {
  const names = Object.keys(tasks);
  const { status, data } = await call(teacher, "POST", "/teacher/months", { studentId: users[name].id, songId: song.id, startsOn: START, tasks: names.map((n) => tasks[n]) });
  assert.equal(status, 201, JSON.stringify(data));
  return Object.fromEntries(names.map((n, i) => [n, data.month.tasks.find((t) => t.position === i)]));
}

const inbox = async (who = "teacherA", query = "") => (await call(who, "GET", `/teacher/inbox${query}`)).data;
const ids = (list) => list.map((a) => a.id);

// Every test starts with an empty queue for the teacher it uses.
async function clearWork() {
  await prisma.assignment.deleteMany({ where: { studentId: { in: Object.values(users).map((u) => u.id) } } });
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) => prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Guitar", ...data }, include: { roles: true } });
  users.teacherA = await make("teacherA", { role: "teacher" });
  users.teacherB = await make("teacherB", { role: "teacher" });
  users.adminOnly = await make("adminOnly", { roles: { create: [{ role: "admin" }] } });
  users.kai = await make("kai", { paidAt: new Date() });
  users.mia = await make("mia", { paidAt: new Date() });
  users.leo = await make("leo", { paidAt: new Date(), instrument: "Bass" });
  users.minor = await make("minor", { paidAt: new Date(), isMinor: true });
  users.others = await make("others", { paidAt: new Date() });
  for (const [key, user] of Object.entries(users)) tokens[key] = signMobileToken(user, "10m");
  await prisma.teacherStudent.createMany({
    data: [...["kai", "mia", "leo", "minor"].map((n) => ({ teacherId: users.teacherA.id, studentId: users[n].id })), { teacherId: users.teacherB.id, studentId: users.others.id }],
  });
  song = await prisma.song.create({ data: { title: `${RUN} song`, chart: CHART } });
  const cls = (teacher, title) => prisma.class.create({ data: { teacherId: users[teacher].id, kind: "group", title, timeZone: "Pacific/Honolulu", firstDate: START, startMinute: 960, durationMinutes: 60 } });
  classA = await cls("teacherA", `${RUN} A`);
  classB = await cls("teacherB", `${RUN} B`);
  await prisma.classEnrollment.createMany({ data: [{ classId: classA.id, userId: users.kai.id }, { classId: classB.id, userId: users.mia.id }, { classId: classA.id, userId: users.leo.id, status: "waitlisted" }] });
});

after(async () => {
  await prisma.class.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("submitted assessments enter the queue; saved checkpoints and unsent work don't", async () => {
  await clearWork();
  const { assessment, checkpoint, flagged, unsent } = await monthFor("kai", { assessment: task(), checkpoint: task({ kind: "checkpoint" }), flagged: task({ kind: "checkpoint", reviewCheckpoint: true }), unsent: task() });

  assert.deepEqual((await inbox()).items, [], "nothing until something is sent");

  assert.equal((await take("kai", assessment.id)).status, 201);
  assert.equal((await take("kai", checkpoint.id)).status, 201);
  let queue = await inbox();
  assert.deepEqual(ids(queue.items), [assessment.id]);
  assert.equal(queue.waiting, 1);
  assert.equal(queue.pagination.total, 1);

  // A checkpoint is only in the queue when the teacher asked for it to be.
  assert.equal((await take("kai", flagged.id)).status, 201);
  queue = await inbox();
  assert.ok(ids(queue.items).includes(flagged.id));
  assert.equal(ids(queue.items).includes(unsent.id), false);

  // The saved one is in the separate view, and doesn't count as waiting for anybody.
  const { data } = await call("teacherA", "GET", "/teacher/checkpoints");
  assert.deepEqual(ids(data.items), [checkpoint.id], "flagged checkpoints are in the queue, so they aren't listed twice");
  assert.equal(data.items[0].status, "saved");
  assert.equal(data.items[0].attempts, 1);
  assert.ok(data.filters.students.length);
});

test("each row says what the teacher needs before opening it", async () => {
  await clearWork();
  const { first, video, either } = await monthFor("kai", {
    first: task({ dueOn: "2026-12-13", support: "chart", targetSpeed: 90 }),
    video: task({ week: 2, media: "video", section: "Chorus 1" }),
    either: task({ week: 3, media: "video", audioAllowed: true, section: "Verse 2" }),
  });
  await take("kai", first.id, { support: "chart", speed: 0.9 });
  await take("kai", video.id, {}, "webm");
  await take("kai", either.id);

  const { items } = await inbox();
  const row = (id) => items.find((a) => a.id === id);

  const a = row(first.id);
  assert.equal(a.student.name, "kai");
  assert.equal(a.instrument, "Guitar");
  assert.equal(a.song.title, `${RUN} song`);
  assert.equal(a.week, 1);
  assert.equal(a.section, "Verse 1");
  assert.equal(a.kind, "assessment");
  assert.equal(a.dueOn, "2026-12-13");
  assert.deepEqual([a.media, a.support, a.targetSpeed], ["audio", "chart", 90]);
  assert.ok(a.sentAt);
  assert.equal(a.attempts, 1);
  assert.equal(a.resubmission, false);
  assert.equal(a.status, "ready");
  const recording = a.submissions[0].recording;
  assert.deepEqual([recording.media, recording.type, recording.speed, recording.support, recording.duration], ["audio", "audio/wav", 0.9, "chart", 20]);
  assert.equal(recording.url, undefined, "no recording links on a list");

  assert.deepEqual([row(video.id).submissions[0].recording.media, row(video.id).submissions[0].recording.type, row(video.id).audioInstead], ["video", "video/webm", false]);
  assert.deepEqual([row(either.id).audioAllowed, row(either.id).audioInstead], [true, true], "audio instead of the video that was asked for is pointed out");
});

test("the queue runs longest wait first, and a resubmission goes by its newest send", async () => {
  await clearWork();
  const { a, b, c } = await monthFor("kai", { a: task(), b: task({ week: 2 }), c: task({ week: 3 }) });
  const sendA = await take("kai", a.id);
  const sendB = await take("kai", b.id);
  const sendC = await take("kai", c.id);
  await age(sendA.data.submission.id, 300);
  await age(sendB.data.submission.id, 500);
  await age(sendC.data.submission.id, 100);
  assert.deepEqual(ids((await inbox()).items), [b.id, a.id, c.id]);

  // Reviewed, it leaves the queue. Earlier send kept, with the feedback on it.
  assert.equal((await call("teacherA", "PUT", `/teacher/submissions/${sendB.data.submission.id}/feedback`, { feedback: "Good start.", notes: [{ at: 3, text: "Late here." }] })).status, 200);
  let queue = await inbox();
  assert.deepEqual(ids(queue.items), [a.id, c.id]);
  assert.equal(queue.waiting, 2);

  const reviewed = await inbox("teacherA", "?view=reviewed");
  assert.equal(reviewed.view, "reviewed");
  assert.deepEqual(ids(reviewed.items), [b.id]);
  assert.equal(reviewed.items[0].status, "reviewed");
  assert.equal(reviewed.waiting, 2, "still says what's waiting");

  // Sent again: back in the queue as a resubmission, waiting from the new send, at the back.
  const again = await take("kai", b.id);
  assert.equal(again.status, 201);
  queue = await inbox();
  assert.deepEqual(ids(queue.items), [a.id, c.id, b.id]);
  const row = queue.items.find((x) => x.id === b.id);
  assert.equal(row.attempts, 2);
  assert.equal(row.resubmission, true);
  assert.equal(row.submissions[0].id, again.data.submission.id);
  assert.equal(row.sentAt, row.submissions[0].createdAt);

  // Replying to the older send doesn't take the new one out of the queue.
  await call("teacherA", "PUT", `/teacher/submissions/${sendB.data.submission.id}/feedback`, { feedback: "Good start, edited." });
  assert.ok(ids((await inbox()).items).includes(b.id));

  // Both attempts are there to review, each with its own feedback.
  const detail = (await call("teacherA", "GET", `/teacher/assignments/${b.id}`)).data.assignment;
  assert.deepEqual(detail.submissions.map((s) => s.feedback), [null, "Good start, edited."]);
  assert.deepEqual(detail.submissions[1].notes, [{ at: 3, text: "Late here." }]);
});

test("the queue filters by class, student and instrument", async () => {
  await clearWork();
  const { kaiTask } = await monthFor("kai", { kaiTask: task() });
  const { miaTask } = await monthFor("mia", { miaTask: task() });
  const { leoTask } = await monthFor("leo", { leoTask: task() });
  for (const [who, t] of [["kai", kaiTask], ["mia", miaTask], ["leo", leoTask]]) await take(who, t.id);

  const all = await inbox();
  assert.equal(all.items.length, 3);
  assert.deepEqual(all.filters.classes.map((c) => c.id), [classA.id]);
  assert.deepEqual(all.filters.students.map((s) => s.name), ["kai", "leo", "mia", "minor"]);
  assert.ok(all.filters.instruments.includes("Bass"));

  assert.deepEqual(ids((await inbox("teacherA", `?studentId=${users.mia.id}`)).items), [miaTask.id]);
  assert.deepEqual(ids((await inbox("teacherA", "?instrument=Bass")).items), [leoTask.id]);
  assert.deepEqual(ids((await inbox("teacherA", "?instrument=Kazoo")).items).length, 3, "an unknown instrument isn't a filter");
  // Leo is only on the waitlist for the class.
  assert.deepEqual(ids((await inbox("teacherA", `?classId=${classA.id}`)).items), [kaiTask.id]);
  assert.deepEqual(ids((await inbox("teacherA", `?classId=${classA.id}&instrument=Bass`)).items), []);
  assert.deepEqual(ids((await inbox("teacherA", `?classId=${classB.id}`)).items), [], "another teacher's class finds nothing");
});

test("next walks the queue, keeps the filters, and carries on after a review", async () => {
  await clearWork();
  const { a, b, c } = await monthFor("kai", { a: task(), b: task({ week: 2 }), c: task({ week: 3 }) });
  const { d } = await monthFor("leo", { d: task({ week: 4 }) });
  const sends = {};
  for (const [name, who, t, minutes] of [["a", "kai", a, 400], ["b", "kai", b, 300], ["c", "kai", c, 200], ["d", "leo", d, 100]]) {
    sends[name] = await take(who, t.id);
    await age(sends[name].data.submission.id, minutes);
  }
  const next = async (id, query = "") => (await call("teacherA", "GET", `/teacher/inbox/next?after=${id}${query}`)).data;

  let step = await next(a.id);
  assert.equal(step.next.id, b.id);
  assert.deepEqual([step.position, step.total], [1, 4]);
  assert.equal((await next(b.id)).next.id, c.id);

  // With a filter, Leo's isn't next.
  const guitar = await next(c.id, `&studentId=${users.kai.id}`);
  assert.equal(guitar.next.id, a.id, "the end of the filtered queue goes back to the start");
  assert.equal(guitar.total, 3);

  // Reviewing b takes it out of the queue, and "next" still carries on from where it was.
  await call("teacherA", "PUT", `/teacher/submissions/${sends.b.data.submission.id}/feedback`, { feedback: "Done." });
  step = await next(b.id);
  assert.equal(step.next.id, c.id);
  assert.equal(step.position, null);
  assert.equal(step.total, 3);

  // The only one left has nothing after it.
  for (const name of ["a", "c"]) await call("teacherA", "PUT", `/teacher/submissions/${sends[name].data.submission.id}/feedback`, { feedback: "Done." });
  assert.equal((await next(d.id)).next, null);
  await call("teacherA", "PUT", `/teacher/submissions/${sends.d.data.submission.id}/feedback`, { feedback: "Done." });
  const empty = await next(d.id);
  assert.deepEqual([empty.next, empty.total], [null, 0]);
});

test("a long queue pages", async () => {
  await clearWork();
  const tasks = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`t${i}`, task({ week: 1 + (i % 4), section: `S${i}` })]));
  const months = await monthFor("kai", tasks);
  for (const [i, t] of Object.values(months).entries()) await age((await take("kai", t.id)).data.submission.id, 1000 - i);
  const page = await inbox("teacherA", "?pageSize=5&page=3");
  assert.deepEqual([page.pagination.page, page.pagination.totalPages, page.pagination.total, page.items.length], [3, 3, 12, 2]);
  assert.equal(page.items[0].section, "S10");
  assert.equal(page.waiting, 12);
  assert.equal((await inbox("teacherA", "?pageSize=5&page=99")).pagination.page, 3);
});

test("work set before there were weeks still comes to the queue", async () => {
  await clearWork();
  const created = await call("teacherA", "POST", "/teacher/assignments", { studentId: users.kai.id, songId: song.id, instrument: "Guitar", level: 2, section: "Chorus", instruction: "Strum it." });
  const a = created.data.assignment;
  assert.equal((await call("kai", "POST", `/assignments/${a.id}/submit`, {})).status, 201, "no recording is needed on old work");
  const { items } = await inbox();
  assert.deepEqual(ids(items), [a.id]);
  assert.deepEqual([items[0].week, items[0].month, items[0].submissions[0].recording], [null, null, null]);
});

test("teachers only see their own work, for students they still teach", async () => {
  await clearWork();
  const { mine } = await monthFor("kai", { mine: task() });
  const { theirs } = await monthFor("others", { theirs: task() }, "teacherB");
  const { checkpoint } = await monthFor("kai", { checkpoint: task({ kind: "checkpoint" }) });
  await take("kai", mine.id);
  await take("others", theirs.id);
  await take("kai", checkpoint.id);

  assert.deepEqual(ids((await inbox("teacherA")).items), [mine.id]);
  assert.deepEqual(ids((await inbox("teacherB")).items), [theirs.id]);
  assert.deepEqual(ids((await inbox("teacherB", `?studentId=${users.kai.id}`)).items), []);
  assert.deepEqual((await call("teacherB", "GET", `/teacher/checkpoints?studentId=${users.kai.id}`)).data.items, []);
  assert.equal((await call("teacherB", "GET", `/teacher/inbox/next?after=${mine.id}`)).data.next.id, theirs.id, "someone else's id tells them nothing");

  for (const who of ["kai", "adminOnly"]) {
    assert.equal((await call(who, "GET", "/teacher/inbox")).status, 403);
    assert.equal((await call(who, "GET", "/teacher/inbox/next")).status, 403);
    assert.equal((await call(who, "GET", "/teacher/checkpoints")).status, 403);
  }
  assert.equal((await call(null, "GET", "/teacher/inbox")).status, 401);

  // Once the teacher no longer teaches the student, their work leaves the inbox and nothing is lost.
  const key = { teacherId_studentId: { teacherId: users.teacherA.id, studentId: users.kai.id } };
  await prisma.teacherStudent.delete({ where: key });
  try {
    assert.deepEqual((await inbox("teacherA")).items, []);
    assert.deepEqual((await call("teacherA", "GET", "/teacher/checkpoints")).data.items, []);
    assert.equal(await prisma.submission.count({ where: { assignmentId: mine.id } }), 1);
  } finally {
    await prisma.teacherStudent.create({ data: { teacherId: users.teacherA.id, studentId: users.kai.id } });
  }
});

test("work from a published plan comes through the same queue, and the plan's changes don't disturb it", async () => {
  await clearWork();
  const made = await call("teacherA", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 1, instrument: "Guitar", studentIds: [users.kai.id, users.mia.id] });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const out = await call("teacherA", "POST", `/teacher/plans/${made.data.plan.id}/publish`, { studentIds: [users.kai.id, users.mia.id] });
  assert.equal(out.status, 201, JSON.stringify(out.data));
  const row = await prisma.assignment.findFirst({ where: { studentId: users.kai.id, monthId: { not: null }, kind: "assessment" }, orderBy: [{ week: "asc" }] });
  const sent = await take("kai", row.id, { support: row.support, speed: 0.8 });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));
  assert.deepEqual(ids((await inbox()).items), [row.id]);

  // A change to the plan leaves the take where it is.
  const live = (await call("teacherA", "GET", `/teacher/plans/${made.data.plan.id}`)).data.plan;
  const edited = await call("teacherA", "PUT", `/teacher/plans/${live.id}`, { revision: live.revision, tasks: live.tasks.map((t) => (t.id === row.planTaskId ? { ...t, instruction: "Clearer words." } : t)) });
  assert.equal(edited.status, 200);
  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${live.id}/impact`)).data;
  assert.equal((await call("teacherA", "POST", `/teacher/plans/${live.id}/apply`, { studentIds: [users.kai.id, users.mia.id], basis: impact.basis })).status, 200);
  const { items } = await inbox();
  assert.deepEqual(ids(items), [row.id], "still waiting");
  assert.equal(items[0].instruction, "Clearer words.");
  assert.equal(items[0].submissions[0].id, sent.data.submission.id);
});
