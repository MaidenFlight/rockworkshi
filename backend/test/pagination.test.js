// Paged lists: page sizes, the last page, search, who can see what. Runs against the dev
// database in .env, creating throwaway @example.test rows and deleting them afterwards.
require("dotenv").config({ quiet: true });

const RUN = `paging-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

let server;
let base;
const users = {};
const tokens = {};
let song;

async function call(who, path) {
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${tokens[who]}` } });
  return { status: res.status, data: await res.json().catch(() => null) };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) =>
    prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Kazoo", ...data } });
  users.admin = await make("admin");
  users.teacherA = await make("teacherA", { role: "teacher" });
  users.teacherB = await make("teacherB", { role: "teacher" });
  users.student = await make("student", { paidAt: new Date() });
  for (const [key, user] of Object.entries(users)) {
    tokens[key] = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "10m" });
  }
  for (let i = 0; i < 8; i++) await make(`extra${i}`);

  song = await prisma.song.create({ data: { title: `${RUN} song` } });
  await prisma.teacherStudent.create({ data: { teacherId: users.teacherA.id, studentId: users.student.id } });
  await prisma.assignment.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({
      teacherId: users.teacherA.id,
      studentId: users.student.id,
      songId: song.id,
      instrument: "Guitar",
      level: 1,
      instruction: `Task ${i}`,
      status: i < 3 ? "ready" : "assigned",
    })),
  });

  await prisma.trialRequest.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({ studentName: `${RUN} ${i}`, email: `${RUN}@example.test` })),
  });
  await prisma.contactMessage.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({ name: `${RUN} ${i}`, email: `${RUN}@example.test`, message: "Hello" })),
  });
});

after(async () => {
  await prisma.assignment.deleteMany({ where: { songId: song?.id } });
  await prisma.trialRequest.deleteMany({ where: { email: `${RUN}@example.test` } });
  await prisma.contactMessage.deleteMany({ where: { email: `${RUN}@example.test` } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  if (song) await prisma.song.delete({ where: { id: song.id } });
  await prisma.$disconnect();
  server.close();
});

test("pages don't overlap and report their position", async () => {
  const one = await call("admin", "/admin/trials?page=1&pageSize=10");
  const two = await call("admin", "/admin/trials?page=2&pageSize=10");
  assert.equal(one.status, 200);
  assert.equal(one.data.trials.length, 10);
  assert.equal(two.data.trials.length, 10);
  assert.equal(two.data.pagination.page, 2);
  assert.equal(two.data.pagination.pageSize, 10);
  assert.ok(two.data.pagination.total >= 30);
  const ids = new Set([...one.data.trials, ...two.data.trials].map((t) => t.id));
  assert.equal(ids.size, 20);
});

test("a page past the end returns the last page", async () => {
  const { data } = await call("admin", "/admin/messages?page=999999&pageSize=10");
  assert.equal(data.pagination.page, data.pagination.totalPages);
  assert.ok(data.messages.length > 0);
});

test("bad paging values fall back to safe ones", async () => {
  for (const q of ["page=abc", "page=-3", "page=1.5", "page=0"]) {
    assert.equal((await call("admin", `/admin/trials?${q}`)).data.pagination.page, 1, q);
  }
  assert.equal((await call("admin", "/admin/trials?pageSize=abc")).data.pagination.pageSize, 25);
  const capped = await call("admin", "/admin/trials?pageSize=5000");
  assert.equal(capped.data.pagination.pageSize, 100);
  assert.ok(capped.data.trials.length <= 100);
});

test("student search pages over matches only, ignoring case", async () => {
  const { data } = await call("admin", `/admin/students?search=${RUN.toUpperCase()}&pageSize=5&page=3`);
  assert.equal(data.pagination.total, 12);
  assert.equal(data.pagination.totalPages, 3);
  assert.equal(data.students.length, 2);
  assert.ok(data.students.every((s) => s.email.startsWith(RUN)));
  assert.ok(data.students.every((s) => !("passwordHash" in s)));
});

test("the overview counts everything, not one page", async () => {
  const { status, data } = await call("admin", "/admin/overview");
  assert.equal(status, 200);
  assert.ok(data.students >= 12);
  assert.ok(data.newTrials >= 30);
  assert.ok(data.messages >= 30);
  const kazoo = data.breakdown.find((b) => b.name === "Kazoo");
  assert.ok(kazoo.count >= 12);
  assert.ok(data.breakdown.every((b) => b.pct >= 0 && b.pct <= 100));
});

test("only the admin reaches the admin lists", async () => {
  for (const path of ["/admin/students", "/admin/trials", "/admin/messages", "/admin/overview"]) {
    assert.equal((await call("student", path)).status, 403, path);
  }
});

test("teacher lists page and stay limited to their own students", async () => {
  const { data } = await call("teacherA", "/teacher/assignments?pageSize=5&page=3");
  assert.equal(data.pagination.total, 12);
  assert.equal(data.assignments.length, 2);
  const ready = await call("teacherA", "/teacher/assignments?status=ready");
  assert.equal(ready.data.pagination.total, 3);
  const filtered = await call("teacherA", `/teacher/assignments?studentId=${users.student.id}&pageSize=5`);
  assert.equal(filtered.data.pagination.total, 12);
  const other = await call("teacherB", "/teacher/assignments");
  assert.equal(other.data.pagination.total, 0);
  assert.deepEqual(other.data.assignments, []);
  assert.equal(other.data.pagination.page, 1);
});

test("students page through their own work", async () => {
  const { data } = await call("student", "/assignments?pageSize=5&page=2");
  assert.equal(data.pagination.total, 12);
  assert.equal(data.assignments.length, 5);
  assert.equal((await call("teacherB", "/assignments")).data.pagination.total, 0);
});
