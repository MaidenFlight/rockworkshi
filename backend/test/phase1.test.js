// Phase 1 of the platform plan: roles, classes and the calendar, enrolment and waitlists,
// attendance, profiles and consent, and guardians. Runs against the dev database in .env with
// throwaway @example.test accounts.
require("dotenv").config({ quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const { hashToken } = require("../src/lib/emailTokens");
const { toInstant, localParts } = require("../src/lib/zoned");
const { sessionDates, sessionTimes } = require("../src/lib/classes");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const RUN = `phase1-test-${Date.now()}`;
let server;
let base;
const users = {};
const tokens = {};

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

async function makeUser(name, data = {}, roles = []) {
  users[name] = await prisma.user.create({
    data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name: `${name} ${RUN}`, paidAt: new Date(), ...data },
  });
  for (const role of roles) await prisma.userRole.create({ data: { userId: users[name].id, role } });
  tokens[name] = signMobileToken(users[name], "10m");
}

// Two weeks out, so every session is in the future.
const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const lesson = (extra = {}) => ({
  kind: "group",
  title: `${RUN} Rock band basics`,
  timeZone: "Pacific/Honolulu",
  firstDate: soon,
  startMinute: 16 * 60,
  durationMinutes: 60,
  repeat: "none",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  ...extra,
});

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  await makeUser("teacher", { role: "teacher" }, ["teacher"]);
  await makeUser("otherTeacher", { role: "teacher" }, ["teacher"]);
  await makeUser("admin", {}, ["admin"]);
  await makeUser("ana");
  await makeUser("ben");
  await makeUser("cy");
  await makeUser("kid", { isMinor: true, sponsorEmail: `${RUN}-parent@example.test` });
  await prisma.teacherStudent.createMany({ data: ["ana", "kid"].map((s) => ({ teacherId: users.teacher.id, studentId: users[s].id })) });
});

after(async () => {
  await prisma.class.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.auditEvent.deleteMany({ where: { createdAt: { gte: new Date(Date.now() - 3600000) }, actorId: null } });
  server.close();
});

test("local times survive daylight-saving changes", () => {
  // Los Angeles springs forward on 8 March 2026: 4pm stays 4pm, so UTC moves an hour earlier.
  const before = toInstant("2026-03-03", 16 * 60, "America/Los_Angeles");
  const afterChange = toInstant("2026-03-10", 16 * 60, "America/Los_Angeles");
  assert.equal(before.toISOString(), "2026-03-04T00:00:00.000Z");
  assert.equal(afterChange.toISOString(), "2026-03-10T23:00:00.000Z");
  // And back on 1 November.
  assert.equal(toInstant("2026-11-03", 16 * 60, "America/Los_Angeles").toISOString(), "2026-11-04T00:00:00.000Z");
  // Honolulu has no daylight saving.
  assert.equal(toInstant("2026-07-01", 9 * 60, "Pacific/Honolulu").toISOString(), "2026-07-01T19:00:00.000Z");
  // A weekly class keeps its weekday and wall time all the way through.
  const weekly = sessionTimes({ repeat: "weekly", firstDate: "2026-02-24", repeatUntil: "2026-03-24", startMinute: 960, durationMinutes: 45, timeZone: "America/Los_Angeles" });
  assert.equal(weekly.length, 5);
  for (const t of weekly) {
    const local = localParts(t.startsAt, "America/Los_Angeles");
    assert.equal(local.minute, 960);
    assert.equal(local.weekday, 2);
  }
});

test("the guardian invite email can't carry HTML or headers from a student's name", () => {
  const { renderGuardianInvite } = require("../src/lib/mailer");
  const name = 'Sam</h1><a href="https://evil.example/login">Sign in here</a>\r\nBcc: someone@example.test';
  const mail = renderGuardianInvite({ studentName: name, link: "https://rockworks.example/family/accept?token=abc" });
  assert.ok(!mail.html.includes('<a href="https://evil.example'), "the student's link isn't live HTML");
  assert.ok(mail.html.includes("Sam&lt;/h1&gt;&lt;a href=&quot;https://evil.example/login&quot;&gt;"), "it shows as text");
  assert.ok(mail.html.includes('<a href="https://rockworks.example/family/accept?token=abc"'), "the real button still works");
  assert.ok(!/[\r\n]/.test(mail.subject), "one line");
  assert.ok(mail.subject.length < 140, "and short");
});

test("names and other profile fields are capped when saved", async () => {
  const long = "x".repeat(500);
  assert.equal((await call("ben", "PATCH", "/auth/me", { name: long, sponsorName: long })).status, 200);
  const saved = await prisma.user.findUnique({ where: { id: users.ben.id } });
  assert.equal(saved.name.length, 200);
  assert.equal(saved.sponsorName.length, 200);
});

test("monthly classes skip months without that day", () => {
  assert.deepEqual(sessionDates({ repeat: "monthly", firstDate: "2027-01-31", repeatUntil: "2027-05-31" }), ["2027-01-31", "2027-03-31", "2027-05-31"]);
});

test("only teachers schedule, and only admins grant roles or enrol", async () => {
  assert.equal((await call("ana", "POST", "/teacher/classes", lesson())).status, 403);
  assert.equal((await call("teacher", "POST", "/admin/classes/x/enrolments", { userId: users.ana.id })).status, 403);
  assert.equal((await call("teacher", "PUT", `/admin/users/${users.ben.id}/roles`, { roles: ["teacher"] })).status, 403);
  const granted = await call("admin", "PUT", `/admin/users/${users.cy.id}/roles`, { roles: ["teacher"] });
  assert.equal(granted.status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: users.cy.id } })).role, "teacher", "User.role follows");
  await call("admin", "PUT", `/admin/users/${users.cy.id}/roles`, { roles: [] });
  assert.equal((await prisma.user.findUnique({ where: { id: users.cy.id } })).role, "student");
  assert.ok(await prisma.auditEvent.findFirst({ where: { action: "roles.set", targetId: users.cy.id } }), "audited");
});

test("classes: clashes, capacity, waitlist, attendance and the calendar", async () => {
  const made = await call("teacher", "POST", "/teacher/classes", lesson({ capacity: 1, repeat: "weekly", repeatUntil: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10) }));
  assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.ok(made.data.sessions >= 4);
  const classId = made.data.class.id;

  const clash = await call("teacher", "POST", "/teacher/classes", lesson({ title: `${RUN} Clash`, startMinute: 16 * 60 + 30 }));
  assert.equal(clash.status, 409, "overlaps the first class");
  assert.ok(clash.data.conflicts.length);
  assert.equal((await call("teacher", "POST", "/teacher/classes", lesson({ title: `${RUN} Clash`, startMinute: 16 * 60 + 30, allowConflicts: true }))).status, 201);

  assert.equal((await call("otherTeacher", "GET", `/teacher/classes/${classId}`)).status, 404, "another teacher's class is invisible");

  assert.equal((await call("admin", "POST", `/admin/classes/${classId}/enrolments`, { userId: users.ana.id })).data.status, "enrolled");
  assert.equal((await call("admin", "POST", `/admin/classes/${classId}/enrolments`, { userId: users.ben.id })).data.status, "waitlisted", "over capacity");

  const range = `from=${new Date().toISOString()}&to=${new Date(Date.now() + 60 * 86400000).toISOString()}`;
  const anaCal = (await call("ana", "GET", `/calendar?${range}`)).data.events.filter((e) => e.classId === classId);
  const benCal = (await call("ben", "GET", `/calendar?${range}`)).data.events.filter((e) => e.classId === classId);
  const cyCal = (await call("cy", "GET", `/calendar?${range}`)).data.events.filter((e) => e.classId === classId);
  assert.ok(anaCal.length >= 4 && anaCal.every((e) => e.meetingUrl && e.enrolment === "enrolled"));
  assert.ok(benCal.length && benCal.every((e) => e.meetingUrl === null && e.enrolment === "waitlisted"), "waiting students don't get the link");
  assert.equal(cyCal.length, 0, "nobody else sees it");

  const detail = (await call("teacher", "GET", `/teacher/classes/${classId}`)).data;
  const first = detail.occurrences[0];
  assert.equal((await call("teacher", "PUT", `/teacher/occurrences/${first.id}/attendance`, { entries: [{ userId: users.ben.id, status: "present" }] })).status, 400, "only enrolled students");
  assert.equal((await call("teacher", "PUT", `/teacher/occurrences/${first.id}/attendance`, { entries: [{ userId: users.ana.id, status: "present" }] })).status, 200);

  // Ana leaves: Ben moves in from the waitlist.
  const removed = await call("admin", "DELETE", `/admin/classes/${classId}/enrolments/${users.ana.id}`);
  assert.deepEqual(removed.data.promoted, [users.ben.id]);

  // Moving one session keeps it apart from the series, and retiming the class leaves it there.
  const second = detail.occurrences[1];
  const moved = await call("teacher", "POST", `/teacher/occurrences/${second.id}/move`, { date: soon, startMinute: 10 * 60, allowConflicts: true });
  assert.equal(moved.status, 200);
  assert.equal((await call("teacher", "PATCH", `/teacher/classes/${classId}`, { startMinute: 17 * 60, allowConflicts: true })).status, 200);
  const after = (await call("teacher", "GET", `/teacher/classes/${classId}`)).data.occurrences;
  assert.ok(after.some((o) => o.id === second.id && o.moved), "the moved session is kept");
  assert.ok(after.some((o) => o.id === first.id), "the session with attendance is kept");
  assert.ok(after.filter((o) => !o.moved && o.id !== first.id).every((o) => localParts(new Date(o.startsAt), "Pacific/Honolulu").minute === 17 * 60));
});

test("profiles: private by choice, and a minor's needs a guardian", async () => {
  const profile = { profile: { goals: "Play in a band", genres: ["Rock"], visibility: "teachers", bandInterest: true }, instruments: [{ instrument: "Guitar", primary: true, selfLevel: "Beginner" }], availability: [{ weekday: 6, startMinute: 600, endMinute: 720 }] };
  assert.equal((await call("ana", "PUT", "/me/profile", profile)).status, 200);
  assert.equal((await call("teacher", "GET", `/teacher/students/${users.ana.id}`)).data.profile.goals, "Play in a band");
  assert.equal((await call("otherTeacher", "GET", `/teacher/students/${users.ana.id}`)).status, 404, "only linked teachers");
  await call("ana", "PUT", "/me/profile", { ...profile, profile: { ...profile.profile, visibility: "private" } });
  const hidden = (await call("teacher", "GET", `/teacher/students/${users.ana.id}`)).data;
  assert.equal(hidden.profile, null);
  assert.equal(hidden.profileHidden, true);
  assert.equal(hidden.availability.length, 0);

  assert.equal((await call("kid", "PUT", "/me/profile", profile)).status, 403, "no profile for a minor without consent");
  assert.equal((await call("kid", "POST", "/me/consents", { purpose: "profile", granted: true })).status, 403, "a minor can't consent for themselves");
});

test("guardians: invited by an admin, see only their own child, and give consent", async () => {
  const invite = await call("admin", "POST", `/admin/students/${users.kid.id}/guardian-invite`, {});
  assert.equal(invite.status, 201);
  assert.equal(invite.data.email, `${RUN}-parent@example.test`, "the sponsor email on file");

  // The emailed token isn't stored, so stand in a known one.
  await prisma.guardianLink.update({ where: { id: invite.data.id }, data: { inviteTokenHash: hashToken(`${RUN}-token`) } });
  assert.equal((await call(null, "GET", `/family/invite?token=${RUN}-token`)).data.accountExists, false);
  const accepted = await call(null, "POST", "/family/accept", { token: `${RUN}-token`, name: "Pat Parent", password: "longenough1" });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.data));
  assert.equal((await call(null, "POST", "/family/accept", { token: `${RUN}-token`, name: "Again", password: "longenough1" })).status, 404, "single use");

  users.parent = await prisma.user.findUnique({ where: { email: `${RUN}-parent@example.test` }, include: { roles: true } });
  tokens.parent = signMobileToken(users.parent, "10m");
  assert.equal(users.parent.role, "guardian");
  assert.ok(users.parent.emailVerifiedAt, "accepting the emailed link confirms the address");

  const children = (await call("parent", "GET", "/family/children")).data.children;
  assert.deepEqual(children.map((c) => c.id), [users.kid.id]);
  assert.equal((await call("parent", "POST", `/family/children/${users.ana.id}/consents`, { purpose: "profile", granted: true })).status, 404, "not their child");
  assert.equal((await call("ana", "GET", "/family/children")).status, 403);

  assert.equal((await call("parent", "POST", `/family/children/${users.kid.id}/consents`, { purpose: "profile", granted: true })).status, 201);
  assert.equal((await call("kid", "PUT", "/me/profile", { profile: { goals: "Drums!" }, instruments: [], availability: [] })).status, 200);
  // Withdrawing consent removes the profile itself.
  await call("parent", "POST", `/family/children/${users.kid.id}/consents`, { purpose: "profile", granted: false });
  assert.equal(await prisma.studentProfile.findUnique({ where: { userId: users.kid.id } }), null);
});
