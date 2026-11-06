// Phone tokens after a password change, login limits, and what deleting an account removes.
// Runs against the dev database in .env, creating throwaway @example.test rows and deleting them.
//   npm test                 no storage
//   TEST_R2=1 npm test       also checks recordings in R2 under throwaway keys
require("dotenv").config({ quiet: true });

const RUN = `safety-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { signMobileToken } = require("../src/lib/mobileToken");
const { putObject, headObject } = require("../src/lib/r2");
const { newRecordingKey } = require("../src/lib/assignments");

const PASSWORD = "first-password-1";
let server;
let base;
let song;
const users = {};

async function call(token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const make = (name, data = {}) =>
  prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Guitar", ...data } });

const adminToken = () => signMobileToken(users.admin);

async function setWork(teacher, student) {
  await prisma.teacherStudent.create({ data: { teacherId: teacher.id, studentId: student.id } });
  return prisma.assignment.create({
    data: {
      teacherId: teacher.id,
      studentId: student.id,
      songId: song.id,
      instrument: "Guitar",
      level: 1,
      instruction: "Practise this",
      submissions: { create: { feedback: "Nice work" } },
    },
  });
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  users.admin = await make("admin");
  users.member = await make("member", { passwordHash: await bcrypt.hash(PASSWORD, 10), emailVerifiedAt: new Date(), paidAt: new Date() });
  song = await prisma.song.create({ data: { title: `${RUN} song` } });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  if (song) await prisma.song.delete({ where: { id: song.id } });
  await prisma.$disconnect();
  server.close();
});

test("changing a password stops phone tokens issued before it", async () => {
  const email = users.member.email;
  const login = await call(null, "POST", "/auth/mobile/login", { email, password: PASSWORD });
  assert.equal(login.status, 200);
  const oldToken = login.data.token;
  assert.equal((await call(oldToken, "GET", "/auth/me")).status, 200);

  const changed = await call(oldToken, "POST", "/auth/change-password", { currentPassword: PASSWORD, newPassword: "second-password-2" });
  assert.equal(changed.status, 200);
  assert.equal((await call(oldToken, "GET", "/library")).status, 401);

  const again = await call(null, "POST", "/auth/mobile/login", { email, password: "second-password-2" });
  assert.equal((await call(again.data.token, "GET", "/library")).status, 200);
});

test("a token without a password stamp is refused", async () => {
  const jwt = require("jsonwebtoken");
  const bare = jwt.sign({ sub: users.member.id }, process.env.JWT_SECRET, { expiresIn: "10m" });
  assert.equal((await call(bare, "GET", "/library")).status, 401);
});

test("deleting a teacher keeps their students' work and feedback", async () => {
  const teacher = await make("teacherGone", { role: "teacher" });
  const student = await make("studentStays", { paidAt: new Date() });
  const work = await setWork(teacher, student);

  assert.equal((await call(adminToken(), "DELETE", `/admin/students/${teacher.id}`)).status, 204);

  const seen = await call(signMobileToken(student), "GET", `/assignments/${work.id}`);
  assert.equal(seen.status, 200);
  assert.equal(seen.data.assignment.teacher, null);
  assert.equal(seen.data.assignment.submissions[0].feedback, "Nice work");
  // With no teacher to review it, submitting explains why rather than crashing.
  assert.equal((await call(signMobileToken(student), "POST", `/assignments/${work.id}/submit`, {})).status, 409);
});

test("deleting a student removes their work", async () => {
  const teacher = await make("teacherStays", { role: "teacher" });
  const student = await make("studentGone");
  const work = await setWork(teacher, student);
  assert.equal((await call(adminToken(), "DELETE", `/admin/students/${student.id}`)).status, 204);
  assert.equal(await prisma.assignment.findUnique({ where: { id: work.id } }), null);
});

test("the admin can't remove their own account, and unknown ids are a 404", async () => {
  assert.equal((await call(adminToken(), "DELETE", `/admin/students/${users.admin.id}`)).status, 400);
  assert.ok(await prisma.user.findUnique({ where: { id: users.admin.id } }));
  assert.equal((await call(adminToken(), "DELETE", "/admin/students/no-such-id")).status, 404);
});

test("recordings never sent are deleted with the assignment and the student", { skip: !process.env.TEST_R2 }, async () => {
  const teacher = await make("teacherR2", { role: "teacher" });
  const student = await make("studentR2", { paidAt: new Date() });
  const first = await setWork(teacher, student);
  const unsentKey = newRecordingKey(first.id);
  await putObject(unsentKey, Buffer.alloc(64), "audio/wav");
  assert.ok(await headObject(unsentKey));
  assert.equal((await call(signMobileToken(teacher), "DELETE", `/teacher/assignments/${first.id}`)).status, 204);
  assert.equal(await headObject(unsentKey), null);

  const second = await prisma.assignment.create({
    data: { teacherId: teacher.id, studentId: student.id, songId: song.id, instrument: "Guitar", level: 1, instruction: "Again" },
  });
  const keys = Array.from({ length: 5 }, () => newRecordingKey(second.id));
  await Promise.all(keys.map((key) => putObject(key, Buffer.alloc(64), "audio/wav")));

  // Five recent takes never sent is the limit, so there's no sixth upload link.
  const refused = await call(signMobileToken(student), "POST", `/assignments/${second.id}/recording-upload`, { size: 1000 });
  assert.equal(refused.status, 429);

  assert.equal((await call(adminToken(), "DELETE", `/admin/students/${student.id}`)).status, 204);
  for (const key of keys) assert.equal(await headObject(key), null);
});

test("a database failure while reading a token is a server error, not a sign-out", async () => {
  const member = await prisma.user.findUnique({ where: { id: users.member.id } });
  const token = signMobileToken(member);
  const original = prisma.user.findUnique;
  prisma.user.findUnique = () => Promise.reject(new Error("database down"));
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal((await call(token, "GET", "/library")).status, 500);
  } finally {
    prisma.user.findUnique = original;
    console.error = quiet;
  }
  assert.equal((await call("not-a-token", "GET", "/library")).status, 401);
});

test("recordings through the API are checked before anything is stored", async () => {
  const teacher = await make("teacherUpload", { role: "teacher" });
  const student = await make("studentUpload", { paidAt: new Date() });
  const other = await make("otherUpload", { paidAt: new Date() });
  const work = await setWork(teacher, student);
  const put = (who, body, type = "audio/wav") =>
    fetch(`${base}/assignments/${work.id}/recording`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${signMobileToken(who)}`, "Content-Type": type },
      body,
    });
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(100)]);

  assert.equal((await put(other, wav)).status, 404, "someone else's assignment");
  assert.equal((await put(student, Buffer.alloc(100))).status, 400, "not a WAV");
  assert.equal((await put(student, Buffer.from("RIFF"))).status, 400, "too short");
  assert.equal((await put(student, wav, "application/octet-stream")).status, 400, "wrong type");
  const huge = await put(student, Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(40 * 1024 * 1024 + 1)]));
  assert.equal(huge.status, 413);
  assert.match((await huge.json()).error, /40 MB/);

  await prisma.assignment.update({ where: { id: work.id }, data: { status: "ready" } });
  assert.equal((await put(student, wav)).status, 409, "already waiting for the teacher");
});

test("a recording through the API can be sent and played back", { skip: !process.env.TEST_R2 }, async () => {
  const teacher = await make("teacherSend", { role: "teacher" });
  const student = await make("studentSend", { paidAt: new Date() });
  const work = await setWork(teacher, student);
  const token = signMobileToken(student);
  const res = await fetch(`${base}/assignments/${work.id}/recording`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/wav" },
    body: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(1000)]),
  });
  assert.equal(res.status, 201);
  const { key } = await res.json();
  assert.ok((await headObject(key)).size > 1000);

  const sent = await call(token, "POST", `/assignments/${work.id}/submit`, { recording: { key, offset: 12.5, duration: 30 } });
  assert.equal(sent.status, 201);
  const seen = await call(signMobileToken(teacher), "GET", `/teacher/assignments/${work.id}`);
  assert.equal(seen.data.assignment.submissions[0].recording.offset, 12.5);
  assert.ok(seen.data.assignment.submissions[0].recording.url);

  assert.equal((await call(adminToken(), "DELETE", `/admin/students/${student.id}`)).status, 204);
  assert.equal(await headObject(key), null);
});

test("the website's speed and loop save with the rest of the session", async () => {
  const song2 = song.id;
  const student = await make("studentSession", { paidAt: new Date() });
  const token = signMobileToken(student);
  const session = { position: 20, speed: 0.75, loop: { start: 10, end: 30 } };
  assert.equal((await call(token, "PUT", `/songs/${song2}/practice/session`, { session })).status, 204);
  const { data } = await call(token, "GET", `/songs/${song2}/practice`);
  assert.deepEqual(data.practice.session, session);
});

// Last, because it uses up this process's allowance of failed sign-ins.
test("repeated failed sign-ins are blocked, on the website and phone routes together", async () => {
  const body = { email: users.member.email, password: "wrong-password" };
  const good = await call(null, "POST", "/auth/mobile/login", { email: users.member.email, password: "second-password-2" });
  assert.equal(good.status, 200);

  for (let i = 0; i < 20; i++) {
    const route = i % 2 ? "/auth/login" : "/auth/mobile/login";
    assert.equal((await call(null, "POST", route, body)).status, 401, `attempt ${i + 1}`);
  }
  const blocked = await call(null, "POST", "/auth/mobile/login", body);
  assert.equal(blocked.status, 429);
  assert.match(blocked.data.error, /Too many/);
  // The right password is refused too until the window passes.
  assert.equal((await call(null, "POST", "/auth/login", { email: users.member.email, password: "second-password-2" })).status, 429);
});
