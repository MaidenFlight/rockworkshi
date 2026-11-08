// Month plans and templates through the API: drafting, publishing, groups and overrides, changes to work
// already published, and who can do what. Runs against the database in .env (DATABASE_URL), with throwaway
// @example.test accounts deleted afterwards. Storage is a stand-in, so nothing here touches R2.
require("dotenv").config({ quiet: true });

const RUN = `plans-test-${Date.now()}`;
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
let otherSong;
let classA;
let classB;

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
const START = "2026-12-07";

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function uploaded(assignmentId) {
  const key = `submissions/${assignmentId}/${crypto.randomUUID()}.wav`;
  stored.set(key, { size: 1000, contentType: "audio/wav" });
  return key;
}
const take = (who, id, extra = {}) => call(who, "POST", `/assignments/${id}/submit`, { recording: { key: uploaded(id), offset: 10, duration: 20, ...extra } });

// A draft from the song's sections for these students.
async function draft(studentNames = ["studentX"], extra = {}) {
  const { status, data } = await call("teacherA", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 2, instrument: "Guitar", studentIds: studentNames.map((n) => users[n].id), ...extra });
  assert.equal(status, 201, JSON.stringify(data));
  return data.plan;
}

const save = (plan, changes, who = "teacherA") => call(who, "PUT", `/teacher/plans/${plan.id}`, { revision: plan.revision, ...changes });
const publish = (plan, names, who = "teacherA") => call(who, "POST", `/teacher/plans/${plan.id}/publish`, { studentIds: names.map((n) => users[n].id) });

// A plan published to these students, ready for changes.
async function published(names = ["studentX"], extra = {}) {
  const plan = await draft(names, extra);
  const done = await publish(plan, names);
  assert.equal(done.status, 201, JSON.stringify(done.data));
  return done.data.plan;
}

async function monthFor(plan, name) {
  return prisma.practiceMonth.findFirst({ where: { planId: plan.id, studentId: users[name].id }, include: { tasks: { orderBy: [{ week: "asc" }, { position: "asc" }] } } });
}

async function studentTasks(name) {
  const { data } = await call(name, "GET", "/assignments?pageSize=100");
  return data.assignments;
}

const applyChanges = async (plan, names) => {
  const { data } = await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`);
  return call("teacherA", "POST", `/teacher/plans/${plan.id}/apply`, { studentIds: names.map((n) => users[n].id), basis: data.impact.basis });
};

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) => prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Guitar", ...data }, include: { roles: true } });
  users.teacherA = await make("teacherA", { role: "teacher" });
  users.teacherB = await make("teacherB", { role: "teacher" });
  users.both = await make("both", { role: "teacher", roles: { create: [{ role: "teacher" }, { role: "admin" }] } });
  users.adminOnly = await make("adminOnly", { roles: { create: [{ role: "admin" }] } });
  users.studentX = await make("studentX", { paidAt: new Date() });
  users.studentY = await make("studentY", { paidAt: new Date() });
  users.studentZ = await make("studentZ", { paidAt: new Date() });
  users.bassist = await make("bassist", { paidAt: new Date(), instrument: "Bass" });
  users.minor = await make("minor", { paidAt: new Date(), isMinor: true });
  users.noInstrument = await make("noInstrument", { paidAt: new Date(), instrument: null });
  users.notLinked = await make("notLinked", { paidAt: new Date() });
  users.otherStudent = await make("otherStudent", { paidAt: new Date() });
  for (const [key, user] of Object.entries(users)) tokens[key] = signMobileToken(user, "10m");
  const links = ["studentX", "studentY", "studentZ", "bassist", "minor", "noInstrument"];
  await prisma.teacherStudent.createMany({
    data: [...links.map((n) => ({ teacherId: users.teacherA.id, studentId: users[n].id })), { teacherId: users.teacherB.id, studentId: users.otherStudent.id }, { teacherId: users.both.id, studentId: users.studentX.id }],
  });
  song = await prisma.song.create({ data: { title: `${RUN} song`, chart: CHART } });
  otherSong = await prisma.song.create({ data: { title: `${RUN} no chart` } });
  const cls = (teacher, title) => prisma.class.create({ data: { teacherId: users[teacher].id, kind: "group", title, timeZone: "Pacific/Honolulu", firstDate: START, startMinute: 960, durationMinutes: 60 } });
  classA = await cls("teacherA", `${RUN} class A`);
  classB = await cls("teacherB", `${RUN} class B`);
  await prisma.classEnrollment.createMany({ data: ["studentX", "studentY", "notLinked"].map((n) => ({ classId: classA.id, userId: users[n].id })) });
});

after(async () => {
  await prisma.class.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------------------------

test("a draft is built from the song's real sections and stays with the teacher", async () => {
  const plan = await draft();
  assert.equal(plan.status, "draft");
  assert.equal(plan.name, song.title);
  assert.deepEqual(plan.sections.map((s) => s.name), ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Outro"]);
  assert.equal(plan.transitions[1].name, "Verse 1 into Chorus 1");
  for (const week of [1, 2, 3, 4]) {
    const here = plan.tasks.filter((t) => t.week === week);
    assert.equal(here.filter((t) => t.kind === "assessment").length, 1, `week ${week} has one assessment`);
    const checkpoints = here.filter((t) => t.kind === "checkpoint").length;
    assert.ok(checkpoints >= 2 && checkpoints <= 3, `week ${week} has two or three checkpoints`);
  }
  assert.equal(plan.tasks[0].dueOn, "2026-12-13");
  assert.equal(plan.tasks[0].dueDay, 6);
  assert.deepEqual(plan.check.problems, []);

  // The student has nothing, on any of the ways they could come across it.
  assert.equal((await prisma.practiceMonth.count({ where: { studentId: users.studentX.id, planId: plan.id } })), 0);
  assert.equal((await studentTasks("studentX")).filter((t) => t.song?.id === song.id && t.month?.id === plan.id).length, 0);
  assert.equal(await prisma.assignment.count({ where: { monthId: plan.id } }), 0);

  const list = await call("teacherA", "GET", "/teacher/plans?status=draft");
  assert.ok(list.data.plans.some((p) => p.id === plan.id && p.students === 1));
  assert.equal((await call("teacherA", "GET", "/teacher/plans?status=published")).data.plans.some((p) => p.id === plan.id), false);
});

test("a draft can be left unfinished, reordered and moved in time, and two windows can't overwrite each other", async () => {
  let plan = await draft();
  const [first, second] = plan.tasks.filter((t) => t.week === 1 && t.kind === "checkpoint");

  // Half-written work saves.
  let saved = await save(plan, { tasks: plan.tasks.map((t) => (t.id === first.id ? { ...t, instruction: "", section: "", sectionEnd: null } : t)) });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  plan = saved.data.plan;
  assert.ok(plan.check.problems.some((p) => /needs a name/.test(p)));
  assert.equal((await publish(plan, ["studentX"])).status, 400, "but it can't go out like that");
  assert.ok((await publish(plan, ["studentX"])).data.problems.length);

  // Reordering: the same tasks in a different order come back numbered in it.
  const reordered = plan.tasks.map((t) => t.id);
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  saved = await save(plan, { tasks: reordered.map((id) => plan.tasks.find((t) => t.id === id)) });
  plan = saved.data.plan;
  assert.deepEqual(plan.tasks.slice(0, 2).map((t) => t.id), [second.id, first.id]);
  assert.deepEqual(plan.tasks.map((t) => t.position), plan.tasks.map((_, i) => i));

  // Moving a task to another week takes it there.
  saved = await save(plan, { tasks: plan.tasks.map((t) => (t.id === first.id ? { ...t, week: 3 } : t)) });
  plan = saved.data.plan;
  assert.equal(plan.tasks.find((t) => t.id === first.id).week, 3);

  // Moving the start moves every due date, and nothing else.
  const before = plan.tasks.map((t) => t.dueDay);
  saved = await save(plan, { startsOn: "2027-01-04" });
  plan = saved.data.plan;
  assert.equal(plan.startsOn, "2027-01-04");
  assert.deepEqual(plan.tasks.map((t) => t.dueDay), before);
  assert.equal(plan.tasks.find((t) => t.id === second.id).dueOn, "2027-01-10");

  // A save from an older copy is refused and changes nothing.
  const stale = await call("teacherA", "PUT", `/teacher/plans/${plan.id}`, { revision: plan.revision - 1, name: "From another window" });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.stale, true);
  assert.equal((await call("teacherA", "GET", `/teacher/plans/${plan.id}`)).data.plan.name, song.title);
  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}`, { name: "No revision" })).status, 400);

  assert.equal((await save(plan, { startsOn: "someday" })).status, 400);
  assert.equal((await save(plan, { weekTitles: ["One"] })).status, 400);
  assert.equal((await save(plan, { tasks: [{ week: 9 }] })).status, 400);
});

test("publishing makes ordinary months, once, only for the students the teacher confirmed", async () => {
  const plan = await draft(["studentX", "studentY"]);
  assert.equal((await publish(plan, [])).status, 400);
  assert.equal((await publish(plan, ["studentZ"])).status, 400, "not on the plan");

  // Only the one confirmed.
  const first = await publish(plan, ["studentX"]);
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.plan.status, "published");
  assert.equal(await prisma.practiceMonth.count({ where: { studentId: users.studentY.id, planId: plan.id } }), 0);

  const month = await monthFor(plan, "studentX");
  assert.equal(month.tasks.length, plan.tasks.length);
  assert.equal(month.startsOn, START);
  assert.equal(month.planVersion, 1);
  assert.equal(month.tasks[0].status, "assigned");
  assert.equal(month.tasks[0].instrument, "Guitar");
  assert.equal(month.tasks[0].teacherId, users.teacherA.id);
  assert.equal(month.tasks[0].dueOn, "2026-12-13");
  assert.ok(month.tasks.every((t) => t.planTaskId));

  // It's the same work the student's pages and the review already handle.
  const mine = await studentTasks("studentX");
  const task = mine.find((t) => t.id === month.tasks[0].id);
  assert.ok(task);
  assert.equal(task.month.id, month.id);
  assert.equal((await take("studentX", task.id)).status, 201);
  assert.equal((await call("studentX", "GET", `/assignments/${task.id}`)).data.assignment.status, "saved");
  assert.equal((await call("teacherA", "GET", `/teacher/months/${month.id}`)).status, 200);

  // Publishing again changes nothing.
  const again = await publish(first.data.plan, ["studentX"]);
  assert.equal(again.status, 409);
  assert.equal(await prisma.practiceMonth.count({ where: { studentId: users.studentX.id, planId: plan.id } }), 1);

  // And the rest can follow later.
  assert.equal((await publish(first.data.plan, ["studentY"])).status, 201);
  assert.equal(await prisma.practiceMonth.count({ where: { planId: plan.id } }), 2);
  const fetched = (await call("teacherA", "GET", `/teacher/plans/${plan.id}`)).data.plan;
  assert.deepEqual(fetched.students.map((s) => Boolean(s.month)).sort(), [true, true]);
  assert.equal(fetched.pendingChanges, 0);
});

test("a preview shows the student's version and writes nothing", async () => {
  const plan = await draft(["studentX", "studentY"]);
  const [a, b] = plan.tasks;
  const set = await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students/${users.studentX.id}`, { overrides: { [a.id]: { targetSpeed: 60, support: "chart" }, [b.id]: { skip: true } } });
  assert.equal(set.status, 200, JSON.stringify(set.data));

  const count = () => Promise.all([prisma.practiceMonth.count({ where: { planId: plan.id } }), prisma.assignment.count({ where: { studentId: { in: [users.studentX.id, users.studentY.id] } } }), prisma.submission.count({ where: { assignment: { studentId: users.studentX.id } } })]);
  const before = await count();

  const own = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/preview?studentId=${users.studentX.id}`)).data.preview;
  assert.equal(own.student.name, "studentX");
  assert.equal(own.assignments.length, plan.tasks.length - 1, "one task left out");
  assert.deepEqual(own.leftOut.map((t) => t.taskId), [b.id]);
  const changed = own.assignments.find((t) => t.taskId === a.id);
  assert.deepEqual([changed.targetSpeed, changed.support, changed.status, changed.attempts], [60, "chart", "assigned", 0]);
  assert.deepEqual(changed.changedFor.sort(), ["support", "targetSpeed"]);
  assert.equal(changed.month.startsOn, START);
  assert.equal(changed.dueOn, "2026-12-13");

  const other = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/preview?studentId=${users.studentY.id}`)).data.preview;
  assert.equal(other.assignments.length, plan.tasks.length, "only that student is changed");
  assert.equal(other.assignments[0].targetSpeed, plan.tasks[0].targetSpeed);

  assert.deepEqual(await count(), before, "looking doesn't create or change anything");
  assert.equal((await call("teacherA", "GET", `/teacher/plans/${plan.id}/preview?studentId=${users.studentZ.id}`)).status, 404);
});

test("saved as a template, a plan can be copied to a class with new dates", async () => {
  const source = await draft(["studentX"]);
  const shaped = (await save(source, { tasks: source.tasks.map((t, i) => (i === 0 ? { ...t, instruction: "Template words." } : t)) })).data.plan;

  assert.equal((await call("teacherA", "POST", `/teacher/plans/${shaped.id}/template`, { name: " " })).status, 400);
  const made = await call("teacherA", "POST", `/teacher/plans/${shaped.id}/template`, { name: "Guitar level 2 month", instrument: "Guitar", level: 2 });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const template = made.data.plan;
  assert.equal(template.kind, "template");
  assert.equal(template.version, 1);
  assert.equal(template.startsOn, null);
  assert.equal(template.tasks[0].instruction, "Template words.");
  assert.notEqual(template.tasks[0].id, shaped.tasks[0].id, "a new thing, not tied to the plan it came from");

  const listed = await call("teacherA", "GET", "/teacher/plans?kind=template");
  assert.ok(listed.data.plans.some((p) => p.id === template.id && p.instrument === "Guitar" && p.level === 2 && p.levelName === "Chords"));
  assert.equal((await call("teacherA", "GET", "/teacher/plans?kind=plan")).data.plans.some((p) => p.id === template.id), false);

  // A template can't be published itself, and the source plan is left as it was.
  assert.equal((await call("teacherA", "POST", `/teacher/plans/${template.id}/publish`, { studentIds: [users.studentX.id] })).status, 404);

  // Copied to a class, for a later month.
  const copied = await call("teacherA", "POST", "/teacher/plans", { templateId: template.id, startsOn: "2027-02-01", classId: classA.id, studentIds: [users.studentX.id, users.studentY.id] });
  assert.equal(copied.status, 201, JSON.stringify(copied.data));
  const plan = copied.data.plan;
  assert.equal(plan.kind, "plan");
  assert.equal(plan.status, "draft");
  assert.equal(plan.class.id, classA.id);
  assert.equal(plan.template.id, template.id);
  assert.equal(plan.template.behind, false);
  assert.deepEqual(plan.tasks.map((t) => t.id), template.tasks.map((t) => t.id));
  assert.equal(plan.tasks[0].instruction, "Template words.");
  assert.equal(plan.tasks[0].dueOn, "2027-02-07", "due dates follow the new start");

  const out = await publish(plan, ["studentX", "studentY"]);
  assert.equal(out.status, 201, JSON.stringify(out.data));
  assert.equal(out.data.published.length, 2);
  assert.equal((await monthFor(plan, "studentY")).tasks[0].instruction, "Template words.");

  // The template notes where it's been used.
  const seen = (await call("teacherA", "GET", `/teacher/plans/${template.id}`)).data.plan;
  assert.equal(seen.usedBy.length, 1);
  assert.deepEqual([seen.usedBy[0].id, seen.usedBy[0].behind, seen.usedBy[0].months], [plan.id, false, 2]);
});

test("a class can only be someone's own, and only students linked to the teacher can be planned for", async () => {
  const body = { songId: song.id, startsOn: START, level: 2, instrument: "Guitar" };
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { ...body, classId: classB.id })).status, 404);
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { ...body, studentIds: [users.notLinked.id] })).status, 403);
  const plan = await draft([]);
  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students`, { studentIds: [users.otherStudent.id] })).status, 403);
  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students`, { studentIds: [users.studentX.id], classId: classB.id })).status, 404);

  // The roster shows a class's members, and says who isn't linked.
  const { classes, students } = (await call("teacherA", "GET", "/teacher/roster")).data;
  const cls = classes.find((c) => c.id === classA.id);
  assert.deepEqual(cls.members.map((m) => [m.name, m.linked]).sort(), [["notLinked", false], ["studentX", true], ["studentY", true]]);
  assert.equal(students.some((s) => s.name === "notLinked"), false);
  assert.equal(classes.some((c) => c.id === classB.id), false);
});

test("each student on a plan is checked, and the problems are named", async () => {
  const plan = await draft(["bassist", "minor", "noInstrument"]);
  const withVideo = (await save(plan, { tasks: plan.tasks.map((t, i) => (i === 0 ? { ...t, media: "video" } : t)) })).data.plan;
  const of = (name) => withVideo.students.find((s) => s.name === name).issues.map((i) => i.kind);
  assert.deepEqual(of("bassist"), ["other-instrument"]);
  assert.deepEqual(of("minor"), ["no-video-consent"]);
  assert.deepEqual(of("noInstrument"), ["no-instrument"]);

  assert.equal((await publish(withVideo, ["noInstrument"])).status, 400);
  // A different instrument is the teacher's call. The work is set for the instrument they really study.
  const out = await publish(withVideo, ["bassist", "minor"]);
  assert.equal(out.status, 201, JSON.stringify(out.data));
  assert.ok((await monthFor(plan, "bassist")).tasks.every((t) => t.instrument === "Bass"));
  // A minor who can't be filmed still has the video task; the existing rule offers them audio.
  assert.equal((await monthFor(plan, "minor")).tasks.find((t) => t.media === "video") !== undefined, true);
});

test("individual changes reach only that student", async () => {
  const plan = await draft(["studentX", "studentY"]);
  const [speedy, skipped, video] = plan.tasks;
  const overrides = { [speedy.id]: { targetSpeed: 60, support: "chart", dueDay: 10, instruction: "Go gently." }, [skipped.id]: { skip: true }, [video.id]: { media: "video", audioAllowed: true } };
  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students/${users.studentX.id}`, { overrides: { [speedy.id]: { targetSpeed: 10 } } })).status, 400);
  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students/${users.studentX.id}`, { overrides })).status, 200);
  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students/${users.studentZ.id}`, { overrides })).status, 404, "not on the plan");

  const out = await publish(plan, ["studentX", "studentY"]);
  assert.equal(out.status, 201, JSON.stringify(out.data));

  const x = await monthFor(plan, "studentX");
  const y = await monthFor(plan, "studentY");
  assert.equal(x.tasks.length, plan.tasks.length - 1);
  assert.equal(y.tasks.length, plan.tasks.length);
  const own = x.tasks.find((t) => t.planTaskId === speedy.id);
  assert.deepEqual([own.targetSpeed, own.support, own.dueOn, own.instruction], [60, "chart", "2026-12-17", "Go gently."]);
  const same = y.tasks.find((t) => t.planTaskId === speedy.id);
  assert.deepEqual([same.targetSpeed, same.support, same.dueOn, same.instruction], [speedy.targetSpeed, speedy.support, "2026-12-13", speedy.instruction]);
  const v = x.tasks.find((t) => t.planTaskId === video.id);
  assert.deepEqual([v.media, v.audioAllowed], ["video", true]);

  assert.equal((await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students/${users.studentX.id}`, { overrides: {} })).status, 409, "after publishing it's changed on their month");
});

test("changing a published plan does nothing until it has been reviewed and applied", async () => {
  const plan = await published(["studentX", "studentY"]);
  const target = plan.tasks[0];
  const edited = (await save(plan, { tasks: plan.tasks.map((t) => (t.id === target.id ? { ...t, targetSpeed: 95, instruction: "New words." } : t)) })).data.plan;
  assert.equal(edited.pendingChanges, 2, "one task, for two students");

  // Students still have what was published.
  const speedOf = async (name) => (await monthFor(plan, name)).tasks.find((t) => t.planTaskId === target.id).targetSpeed;
  assert.equal(await speedOf("studentX"), target.targetSpeed);

  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data;
  assert.equal(impact.totals.students, 2);
  assert.equal(impact.totals.tasks, 2);
  assert.deepEqual(impact.students.map((s) => s.name).sort(), ["studentX", "studentY"]);
  const row = impact.students[0].changes[0];
  assert.equal(row.taskId, target.id);
  assert.equal(row.label, target.section);
  assert.deepEqual(row.fields.map((f) => f.field).sort(), ["instruction", "targetSpeed"]);
  assert.equal(row.updates, undefined, "the rows it would write stay on the server");

  // Applied to just one of them.
  assert.equal((await call("teacherA", "POST", `/teacher/plans/${plan.id}/apply`, { studentIds: [], basis: impact.basis })).status, 400);
  const applied = await call("teacherA", "POST", `/teacher/plans/${plan.id}/apply`, { studentIds: [users.studentX.id], basis: impact.basis });
  assert.equal(applied.status, 200, JSON.stringify(applied.data));
  assert.equal(await speedOf("studentX"), 95);
  assert.equal(await speedOf("studentY"), target.targetSpeed, "the other student is left as they were");
  assert.equal((await monthFor(plan, "studentX")).planVersion, 2);
  assert.equal((await monthFor(plan, "studentY")).planVersion, 1);

  // The other can catch up later, and is shown only what's left.
  const after = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data.impact;
  assert.deepEqual(after.students.map((s) => s.name), ["studentY"]);
  assert.equal((await applyChanges(plan, ["studentY"])).status, 200);
  assert.equal(await speedOf("studentY"), 95);
});

test("changing only the order of tasks still has to be reviewed and applied", async () => {
  const plan = await published(["studentX"]);
  const order = (tasks) => tasks.filter((t) => t.week === 1 && t.kind === "checkpoint").map((t) => t.section);
  const [a, b, ...rest] = plan.tasks;
  const edited = (await save(plan, { tasks: [b, a, ...rest] })).data.plan;
  assert.notDeepEqual(order(edited.tasks), order(plan.tasks));
  assert.equal(edited.pendingChanges, 1, "a new order is a change the student would see");

  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data;
  assert.equal(impact.totals.students, 1);
  assert.equal(impact.students[0].reordered, true);
  assert.equal((await applyChanges(edited, ["studentX"])).status, 200);

  const month = await monthFor(plan, "studentX");
  assert.deepEqual(order(month.tasks), order(edited.tasks), "the student's month is in the new order");
  assert.equal((await call("teacherA", "GET", `/teacher/plans/${plan.id}`)).data.plan.pendingChanges, 0);
});

test("an individual student's settings survive a change to the plan", async () => {
  const plan = await draft(["studentX", "studentY"]);
  const [a, b] = plan.tasks;
  await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students/${users.studentX.id}`, { overrides: { [a.id]: { targetSpeed: 60 } } });
  const out = await publish(plan, ["studentX", "studentY"]);
  const live = out.data.plan;

  // And one changed by hand on the student's own month.
  const y = await monthFor(plan, "studentY");
  await call("teacherA", "PUT", `/teacher/assignments/${y.tasks.find((t) => t.planTaskId === b.id).id}`, { support: "chart" });

  const edited = (await save(live, { tasks: live.tasks.map((t) => (t.id === a.id ? { ...t, targetSpeed: 95 } : t.id === b.id ? { ...t, support: "solo" } : t)) })).data.plan;
  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data;
  const report = (name) => impact.students.find((s) => s.name === name).changes;
  assert.deepEqual(report("studentX").find((c) => c.taskId === a.id).individual, [{ field: "targetSpeed", value: 60, planValue: 95 }]);
  assert.deepEqual(report("studentY").find((c) => c.taskId === b.id).individual, [{ field: "support", value: "chart", planValue: "solo" }]);

  assert.equal((await applyChanges(edited, ["studentX", "studentY"])).status, 200);
  const field = async (name, id, key) => (await monthFor(plan, name)).tasks.find((t) => t.planTaskId === id)[key];
  assert.equal(await field("studentX", a.id, "targetSpeed"), 60, "their own speed stays");
  assert.equal(await field("studentY", a.id, "targetSpeed"), 95);
  assert.equal(await field("studentX", b.id, "support"), "solo");
  assert.equal(await field("studentY", b.id, "support"), "chart", "the teacher's own change stays");

  // And they're still theirs after that.
  const fresh = (await call("teacherA", "GET", `/teacher/plans/${plan.id}`)).data.plan;
  const again = (await save(fresh, { tasks: fresh.tasks.map((t) => (t.id === a.id ? { ...t, targetSpeed: 100 } : t)) })).data.plan;
  assert.equal((await applyChanges(again, ["studentX", "studentY"])).status, 200);
  assert.equal(await field("studentX", a.id, "targetSpeed"), 60);
  assert.equal(await field("studentY", a.id, "targetSpeed"), 100);
});

test("sent work and feedback come through a change untouched, and a task with takes can't be removed", async () => {
  const plan = await published(["studentX"]);
  const month = await monthFor(plan, "studentX");
  const assessment = month.tasks.find((t) => t.kind === "assessment");
  const untouched = month.tasks.find((t) => t.kind === "checkpoint");
  const spare = month.tasks.filter((t) => t.kind === "checkpoint")[1];

  const sent = await take("studentX", assessment.id, { support: assessment.support, speed: 0.8 });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));
  const feedback = await call("teacherA", "PUT", `/teacher/submissions/${sent.data.submission.id}/feedback`, { feedback: "Nice.", notes: [{ at: 12, text: "Rushing." }], priorities: ["Slow the change"] });
  assert.equal(feedback.status, 200);
  await take("studentX", untouched.id);
  const before = await prisma.submission.findMany({ where: { assignment: { monthId: month.id } }, orderBy: { id: "asc" } });

  // Takes a task with takes away from the plan, along with one that has none.
  const withoutThem = plan.tasks.filter((t) => t.id !== untouched.planTaskId && t.id !== spare.planTaskId).map((t) => (t.id === assessment.planTaskId ? { ...t, targetSpeed: 95, media: "video", instruction: "Now filmed." } : t));
  const edited = (await save(plan, { tasks: withoutThem })).data.plan;

  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data;
  const report = impact.students[0];
  assert.deepEqual(report.keeps.map((k) => [k.taskId, k.attempts]), [[untouched.planTaskId, 1]], "kept, and said so");
  assert.deepEqual(report.removes.map((r) => r.taskId), [spare.planTaskId]);
  assert.equal(report.changes.find((c) => c.taskId === assessment.planTaskId).attempts, 1);
  assert.equal(impact.totals.withTakes, 1);

  assert.equal((await applyChanges(edited, ["studentX"])).status, 200);
  const after = await monthFor(plan, "studentX");
  assert.ok(after.tasks.some((t) => t.id === untouched.id), "the task with a take is still there");
  assert.equal(after.tasks.some((t) => t.id === spare.id), false);
  const changed = after.tasks.find((t) => t.id === assessment.id);
  assert.deepEqual([changed.targetSpeed, changed.media, changed.status], [95, "video", "reviewed"], "what's asked changes; the review stands");
  assert.deepEqual(await prisma.submission.findMany({ where: { assignment: { monthId: month.id } }, orderBy: { id: "asc" } }), before, "every submission and its feedback is exactly as it was");
  const seen = (await call("studentX", "GET", `/assignments/${assessment.id}`)).data.assignment.submissions[0];
  assert.equal(seen.feedback, "Nice.");
  assert.deepEqual(seen.priorities, ["Slow the change"]);
  assert.equal(seen.recording.speed, 0.8, "the take keeps how it was made");
});

test("applying from a stale review is refused, and shows the new picture", async () => {
  const plan = await published(["studentX"]);
  const month = await monthFor(plan, "studentX");
  const [gone] = month.tasks;
  const edited = (await save(plan, { tasks: plan.tasks.filter((t) => t.id !== gone.planTaskId) })).data.plan;
  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data;
  assert.deepEqual(impact.students[0].removes.map((r) => r.taskId), [gone.planTaskId]);

  // The student saves a take for it after the teacher looked.
  assert.equal((await take("studentX", gone.id)).status, 201);
  const refused = await call("teacherA", "POST", `/teacher/plans/${plan.id}/apply`, { studentIds: [users.studentX.id], basis: impact.basis });
  assert.equal(refused.status, 409);
  assert.deepEqual(refused.data.impact.students[0].keeps.map((k) => k.taskId), [gone.planTaskId]);
  assert.equal(refused.data.impact.students[0].removes.length, 0);
  assert.ok(await prisma.assignment.findUnique({ where: { id: gone.id } }), "nothing was removed");

  assert.equal((await applyChanges(edited, ["studentX"])).status, 400, "and now there's nothing for them to change");
});

test("new tasks and a new start date reach students too, and unapplied changes can be thrown away", async () => {
  const plan = await published(["studentX"]);
  const added = { week: 2, kind: "checkpoint", section: "Extra", sectionStart: 10, sectionEnd: 20, instruction: "One more.", level: 2, media: "audio", dueDay: 9 };
  let edited = (await save(plan, { startsOn: "2026-12-14", weekTitles: ["A", "B", "C", "D"], tasks: [...plan.tasks, added] })).data.plan;
  assert.equal(edited.tasks.find((t) => t.section === "Extra").dueOn, "2026-12-23");

  // Thrown away, it's as it was published.
  const undone = await call("teacherA", "POST", `/teacher/plans/${plan.id}/discard`, {});
  assert.equal(undone.data.plan.pendingChanges, 0);
  assert.equal(undone.data.plan.startsOn, START);
  assert.equal(undone.data.plan.tasks.some((t) => t.section === "Extra"), false);

  edited = (await save(undone.data.plan, { startsOn: "2026-12-14", weekTitles: ["A", "B", "C", "D"], tasks: [...undone.data.plan.tasks, added] })).data.plan;
  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${plan.id}/impact`)).data;
  assert.deepEqual(impact.students[0].monthFields.map((f) => f.field), ["startsOn", "weekTitles"]);
  assert.deepEqual(impact.students[0].adds.map((a) => a.label), ["Extra"]);
  assert.ok(impact.students[0].changes.every((c) => c.fields.every((f) => f.field === "dueOn" || f.field === "position")));

  assert.equal((await applyChanges(edited, ["studentX"])).status, 200);
  const month = await monthFor(plan, "studentX");
  assert.equal(month.startsOn, "2026-12-14");
  assert.deepEqual(month.weekTitles, ["A", "B", "C", "D"]);
  const extra = month.tasks.find((t) => t.section === "Extra");
  assert.deepEqual([extra.dueOn, extra.status, extra.instrument, extra.teacherId], ["2026-12-23", "assigned", "Guitar", users.teacherA.id]);
  assert.equal(month.tasks[0].dueOn, "2026-12-20");
});

test("editing a template changes nothing already made from it, until the teacher brings it in", async () => {
  const source = await draft(["studentX"]);
  const template = (await call("teacherA", "POST", `/teacher/plans/${source.id}/template`, { name: `${RUN} template` })).data.plan;
  const [first, second, third] = template.tasks;

  // One plan, published, with a change of its own and a student with their own speed.
  const fromTemplate = (await call("teacherA", "POST", "/teacher/plans", { templateId: template.id, startsOn: START, studentIds: [users.studentX.id, users.studentY.id] })).data.plan;
  const adjusted = (await save(fromTemplate, { tasks: fromTemplate.tasks.map((t) => (t.id === second.id ? { ...t, instruction: "This group's own words." } : t)) })).data.plan;
  await call("teacherA", "PUT", `/teacher/plans/${adjusted.id}/students/${users.studentX.id}`, { overrides: { [first.id]: { targetSpeed: 55 } } });
  const live = (await publish(adjusted, ["studentX", "studentY"])).data.plan;
  const month = await monthFor(live, "studentY");
  const sent = await take("studentY", month.tasks.find((t) => t.planTaskId === third.id).id);
  assert.equal(sent.status, 201, JSON.stringify(sent.data));

  // The template changes.
  const edited = await save(template, { tasks: template.tasks.map((t) => (t.id === first.id ? { ...t, targetSpeed: 90 } : t.id === second.id ? { ...t, instruction: "Template's new words." } : t.id === third.id ? { ...t, instruction: "Revised." } : t)) });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  assert.equal(edited.data.plan.version, 2, "a new version");

  const unchanged = async () => (await monthFor(live, "studentY")).tasks.find((t) => t.planTaskId === first.id);
  assert.equal((await unchanged()).targetSpeed, first.targetSpeed, "students aren't touched");
  const plan = (await call("teacherA", "GET", `/teacher/plans/${live.id}`)).data.plan;
  assert.equal(plan.tasks.find((t) => t.id === first.id).targetSpeed, first.targetSpeed, "nor is the plan");
  assert.deepEqual([plan.template.behind, plan.template.version, plan.template.latest], [true, 1, 2]);
  assert.equal((await call("teacherA", "GET", `/teacher/plans/${template.id}`)).data.plan.usedBy.find((u) => u.id === live.id).behind, true);

  // Bringing it in says what would happen first.
  const { report, from, to, changesAnything } = (await call("teacherA", "GET", `/teacher/plans/${live.id}/template-changes`)).data;
  assert.deepEqual([from, to, changesAnything], [1, 2, true]);
  assert.deepEqual(report.changes.find((c) => c.taskId === first.id).fields, [{ field: "targetSpeed", from: first.targetSpeed, to: 90 }]);
  assert.deepEqual(report.changes.find((c) => c.taskId === second.id).individual.map((k) => k.value), ["This group's own words."]);

  assert.equal((await call("teacherA", "POST", `/teacher/plans/${live.id}/template-changes`, { version: 1 })).status, 409);
  const merged = await call("teacherA", "POST", `/teacher/plans/${live.id}/template-changes`, { version: 2 });
  assert.equal(merged.status, 200, JSON.stringify(merged.data));
  assert.equal(merged.data.plan.template.behind, false);
  assert.equal((await unchanged()).targetSpeed, first.targetSpeed, "still nothing for students");
  assert.ok(merged.data.plan.pendingChanges > 0);

  // Then applied, as a published plan's changes always are.
  const { impact } = (await call("teacherA", "GET", `/teacher/plans/${live.id}/impact`)).data;
  assert.equal((await call("teacherA", "POST", `/teacher/plans/${live.id}/apply`, { studentIds: [users.studentX.id, users.studentY.id], basis: impact.basis })).status, 200);
  const x = await monthFor(live, "studentX");
  const y = await monthFor(live, "studentY");
  const get = (m, id) => m.tasks.find((t) => t.planTaskId === id);
  assert.equal(get(x, first.id).targetSpeed, 55, "the individual's speed is kept");
  assert.equal(get(y, first.id).targetSpeed, 90);
  assert.equal(get(y, second.id).instruction, "This group's own words.", "so is the plan's own wording");
  assert.equal(get(y, third.id).instruction, "Revised.");
  assert.equal(await prisma.submission.count({ where: { id: sent.data.submission.id } }), 1, "and the take is still there");
});

test("archiving hides a plan without touching anything, and it can be restored", async () => {
  const plan = await published(["studentX"]);
  const archived = await call("teacherA", "POST", `/teacher/plans/${plan.id}/archive`, {});
  assert.equal(archived.data.plan.status, "archived");
  assert.equal((await call("teacherA", "GET", "/teacher/plans")).data.plans.some((p) => p.id === plan.id), false);
  assert.equal((await call("teacherA", "GET", "/teacher/plans?status=archived")).data.plans.some((p) => p.id === plan.id), true);
  assert.equal((await save(archived.data.plan, { name: "Nope" })).status, 409);
  assert.equal((await monthFor(plan, "studentX")).tasks.length, plan.tasks.length, "the student's month carries on");

  const restored = await call("teacherA", "POST", `/teacher/plans/${plan.id}/restore`, {});
  assert.equal(restored.data.plan.status, "published");
  assert.equal((await save(restored.data.plan, { name: "Renamed" })).status, 200);

  // A template that's archived can't be copied until it's back.
  const template = (await call("teacherA", "POST", `/teacher/plans/${plan.id}/template`, { name: "Archived one" })).data.plan;
  await call("teacherA", "POST", `/teacher/plans/${template.id}/archive`, {});
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { templateId: template.id, startsOn: START })).status, 400);
});

test("only the teacher who made a plan can reach it", async () => {
  const plan = await draft(["studentX"]);
  const template = (await call("teacherA", "POST", `/teacher/plans/${plan.id}/template`, { name: "Mine" })).data.plan;
  const paths = [
    ["GET", `/teacher/plans/${plan.id}`],
    ["PUT", `/teacher/plans/${plan.id}`, { revision: plan.revision, name: "Taken" }],
    ["PUT", `/teacher/plans/${plan.id}/students`, { studentIds: [] }],
    ["PUT", `/teacher/plans/${plan.id}/students/${users.studentX.id}`, { overrides: {} }],
    ["GET", `/teacher/plans/${plan.id}/preview`],
    ["POST", `/teacher/plans/${plan.id}/publish`, { studentIds: [users.studentX.id] }],
    ["GET", `/teacher/plans/${plan.id}/impact`],
    ["POST", `/teacher/plans/${plan.id}/apply`, { studentIds: [users.studentX.id], basis: "x" }],
    ["POST", `/teacher/plans/${plan.id}/discard`, {}],
    ["POST", `/teacher/plans/${plan.id}/template`, { name: "Stolen" }],
    ["GET", `/teacher/plans/${plan.id}/template-changes`],
    ["POST", `/teacher/plans/${plan.id}/archive`, {}],
    ["POST", `/teacher/plans/${plan.id}/restore`, {}],
    ["GET", `/teacher/plans/${template.id}`],
  ];
  for (const [method, path, body] of paths) {
    assert.equal((await call("teacherB", method, path, body)).status, 404, `teacher B: ${method} ${path}`);
    assert.equal((await call("both", method, path, body)).status, 404, `another teacher who's also an admin: ${method} ${path}`);
    assert.equal((await call("studentX", method, path, body)).status, 403, `student: ${method} ${path}`);
    assert.equal((await call("adminOnly", method, path, body)).status, 403, `admin who doesn't teach: ${method} ${path}`);
    assert.equal((await call(null, method, path, body)).status, 401, `signed out: ${method} ${path}`);
  }
  assert.equal((await call("teacherB", "GET", "/teacher/plans")).data.plans.some((p) => p.id === plan.id), false);
  assert.equal((await call("teacherB", "POST", "/teacher/plans", { templateId: template.id, startsOn: START })).status, 404, "another teacher's template can't be copied");

  // A person who is both teacher and admin works in the Studio like any teacher.
  const own = await call("both", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 1, instrument: "Guitar", studentIds: [users.studentX.id] });
  assert.equal(own.status, 201, JSON.stringify(own.data));
  assert.equal((await call("both", "POST", `/teacher/plans/${own.data.plan.id}/publish`, { studentIds: [users.studentX.id] })).status, 201);
});

test("a teacher can't publish to or change the work of a student they no longer teach", async () => {
  const plan = await draft(["studentZ"]);
  const live = await published(["studentZ"]);
  const edited = (await save(live, { tasks: live.tasks.map((t, i) => (i === 0 ? { ...t, targetSpeed: 99 } : t)) })).data.plan;
  const key = { teacherId_studentId: { teacherId: users.teacherA.id, studentId: users.studentZ.id } };
  await prisma.teacherStudent.delete({ where: key });
  try {
    assert.equal((await publish(plan, ["studentZ"])).status, 403);
    const fetched = (await call("teacherA", "GET", `/teacher/plans/${plan.id}`)).data.plan;
    assert.equal(fetched.students[0].issues[0].kind, "not-linked");

    // Someone who was on the list can stay on it, without stopping others being added.
    const kept = await call("teacherA", "PUT", `/teacher/plans/${plan.id}/students`, { studentIds: [users.studentZ.id, users.studentX.id] });
    assert.equal(kept.status, 200, JSON.stringify(kept.data));
    assert.equal(kept.data.plan.students.length, 2);
    // But they can't be added afresh to another plan.
    const other = await draft([]);
    assert.equal((await call("teacherA", "PUT", `/teacher/plans/${other.id}/students`, { studentIds: [users.studentZ.id] })).status, 403);

    const { impact } = (await call("teacherA", "GET", `/teacher/plans/${edited.id}/impact`)).data;
    assert.equal(impact.totals.students, 0);
    assert.equal(impact.totals.unlinked, 1);
    assert.equal((await call("teacherA", "POST", `/teacher/plans/${edited.id}/apply`, { studentIds: [users.studentZ.id], basis: impact.basis })).status, 400);
    assert.notEqual((await monthFor(live, "studentZ")).tasks[0].targetSpeed, 99);
  } finally {
    await prisma.teacherStudent.create({ data: { teacherId: users.teacherA.id, studentId: users.studentZ.id } });
  }
});

test("a change to one student's task says who it reaches before it's saved", async () => {
  const plan = await published(["studentX", "studentY"]);
  const month = await monthFor(plan, "studentX");
  const task = month.tasks.find((t) => t.kind === "assessment");
  await take("studentX", task.id, { support: task.support, speed: 0.8 });

  const asked = await call("teacherA", "POST", `/teacher/assignments/${task.id}/impact`, { targetSpeed: 95, instruction: task.instruction });
  assert.equal(asked.status, 200, JSON.stringify(asked.data));
  const { impact } = asked.data;
  assert.equal(impact.student.name, "studentX");
  assert.deepEqual([impact.label, impact.week, impact.attempts, impact.plan.id], [task.section, task.week, 1, plan.id]);
  assert.deepEqual(impact.fields, [{ field: "targetSpeed", from: task.targetSpeed, to: 95 }], "what stays the same isn't a change");
  assert.deepEqual([impact.status, impact.statusAfter], ["ready", "ready"]);
  assert.equal((await prisma.assignment.findUnique({ where: { id: task.id } })).targetSpeed, task.targetSpeed, "nothing is saved by asking");

  assert.equal((await call("teacherB", "POST", `/teacher/assignments/${task.id}/impact`, { targetSpeed: 95 })).status, 404);
  assert.equal((await call("teacherA", "POST", `/teacher/assignments/${task.id}/impact`, { targetSpeed: 5 })).status, 400);

  await call("teacherA", "PUT", `/teacher/assignments/${task.id}`, { targetSpeed: 95 });
  const event = await prisma.auditEvent.findFirst({ where: { action: "assignment.edit", targetId: task.id } });
  assert.deepEqual(event.detail.changed, ["targetSpeed"]);
  assert.equal(event.actorId, users.teacherA.id);
});

test("a song without a chart can still be planned around, and says so", async () => {
  const songless = await call("teacherA", "POST", "/teacher/plans", { songId: otherSong.id, startsOn: START, level: 1, instrument: "Guitar", studentIds: [] });
  assert.equal(songless.status, 201, JSON.stringify(songless.data));
  assert.equal(songless.data.plan.tasks.length, 0);
  assert.equal(songless.data.plan.song.hasChart, false);
  assert.ok(songless.data.plan.check.warnings.some((w) => /no chart/.test(w)));
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { songId: "nope", startsOn: START, level: 1, instrument: "Guitar" })).status, 400);
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { songId: song.id, startsOn: "soon", level: 1, instrument: "Guitar" })).status, 400);
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 9, instrument: "Guitar" })).status, 400);
  assert.equal((await call("teacherA", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 1, instrument: "Kazoo" })).status, 400);
  const empty = await call("teacherA", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 1, instrument: "Guitar", start: "empty" });
  assert.equal(empty.data.plan.tasks.length, 0);
  const content = await call("teacherA", "GET", "/teacher/content");
  assert.equal(content.data.songs.find((s) => s.id === song.id).hasChart, true);
  assert.equal(content.data.songs.find((s) => s.id === otherSong.id).hasChart, false);
});

test("removing a student takes their plan seat, and removing a teacher leaves the students' work", async () => {
  const teacher = await prisma.user.create({ data: { email: `${RUN}-leaving@example.test`, passwordHash: "!no-login", name: "Leaving", role: "teacher" }, include: { roles: true } });
  tokens.leaving = signMobileToken(teacher, "10m");
  const student = await prisma.user.create({ data: { email: `${RUN}-staying@example.test`, passwordHash: "!no-login", name: "Staying", instrument: "Guitar", paidAt: new Date() } });
  const gone = await prisma.user.create({ data: { email: `${RUN}-gone@example.test`, passwordHash: "!no-login", name: "Gone", instrument: "Guitar", paidAt: new Date() } });
  await prisma.teacherStudent.createMany({ data: [student, gone].map((s) => ({ teacherId: teacher.id, studentId: s.id })) });

  const made = await call("leaving", "POST", "/teacher/plans", { songId: song.id, startsOn: START, level: 1, instrument: "Guitar", studentIds: [student.id, gone.id] });
  const planId = made.data.plan.id;
  assert.equal((await call("leaving", "POST", `/teacher/plans/${planId}/publish`, { studentIds: [student.id] })).status, 201);

  await prisma.user.delete({ where: { id: gone.id } });
  assert.equal(await prisma.monthPlanStudent.count({ where: { planId, studentId: gone.id } }), 0);

  await prisma.user.delete({ where: { id: teacher.id } });
  assert.equal(await prisma.monthPlan.count({ where: { id: planId } }), 0, "a teacher's plans go with their account");
  const month = await prisma.practiceMonth.findFirst({ where: { studentId: student.id }, include: { tasks: true } });
  assert.ok(month.tasks.length > 0, "the student keeps the month");
  assert.equal(month.planId, null);
  assert.equal(month.teacherId, null);
});
