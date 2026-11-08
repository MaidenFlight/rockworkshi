// Videos going up in pieces: who can start one, the limits, picking up after a dropped connection, and
// only counting it as stored once all of it has arrived. Runs against the database in .env
// (DATABASE_URL) with a stand-in for R2, so nothing here touches the real bucket.
require("dotenv").config({ quiet: true });

const RUN = `video-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

// Before anything loads the routes, which take these functions when they're first required.
const objects = new Map();
const uploads = new Map();
const aborted = [];
let nextUpload = 1;
let failNextPart = false;
Object.assign(require("../src/lib/r2"), {
  isR2Configured: () => true,
  headObject: async (key) => objects.get(key) ?? null,
  signedUrl: async (key) => `https://stand-in.test/${key}`,
  listObjects: async (prefix) => [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, lastModified: new Date() })),
  deleteObject: async (key) => objects.delete(key),
  createMultipartUpload: async (key, contentType) => {
    const id = `upload-${nextUpload++}`;
    uploads.set(id, { key, contentType, parts: new Map() });
    return id;
  },
  uploadPart: async (key, id, n, body) => {
    if (failNextPart) {
      failNextPart = false;
      throw new Error("The connection to storage dropped.");
    }
    uploads.get(id).parts.set(n, body.length);
  },
  listParts: async (key, id) =>
    [...(uploads.get(id)?.parts ?? new Map())].sort((a, b) => a[0] - b[0]).map(([partNumber, size]) => ({ partNumber, size, etag: `etag-${partNumber}` })),
  completeMultipartUpload: async (key, id, parts) => {
    const upload = uploads.get(id);
    objects.set(key, { size: parts.reduce((n, p) => n + upload.parts.get(p.partNumber), 0), contentType: upload.contentType });
    uploads.delete(id);
  },
  abortMultipartUpload: async (key, id) => {
    aborted.push(id);
    uploads.delete(id);
  },
});

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { VIDEO_PART_BYTES, MAX_VIDEO_BYTES } = require("../src/lib/assignments");

let server;
let base;
const users = {};
const tokens = {};
let song;

// A video a bit over two pieces long.
const SIZE = VIDEO_PART_BYTES * 2 + 1000;

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tokens[who]}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function sendPart(who, path, n, bytes) {
  const res = await fetch(`${base}${path}/parts/${n}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/octet-stream" },
    body: Buffer.alloc(bytes),
  });
  return res.status;
}

async function makeTask(studentId, extra = {}) {
  return prisma.assignment.create({
    data: { teacherId: users.teacher.id, studentId, songId: song.id, instrument: "Guitar", level: 1, instruction: "Film it.", media: "video", kind: "assessment", ...extra },
  });
}

const start = (who, id, body = {}) => call(who, "POST", `/assignments/${id}/video-uploads`, { size: SIZE, type: "video/mp4;codecs=avc1", duration: 60, ...body });

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  const make = (name, data = {}) => prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Guitar", ...data } });
  users.teacher = await make("teacher", { role: "teacher" });
  users.student = await make("student", { paidAt: new Date() });
  users.other = await make("other", { paidAt: new Date() });
  users.minor = await make("minor", { paidAt: new Date(), isMinor: true });
  for (const [key, user] of Object.entries(users)) tokens[key] = signMobileToken(user, "10m");
  await prisma.teacherStudent.createMany({ data: [users.student, users.minor].map((s) => ({ teacherId: users.teacher.id, studentId: s.id })) });
  song = await prisma.song.create({ data: { title: `${RUN} song` } });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("a video goes up in pieces, and is only stored once all of it has arrived", async () => {
  const task = await makeTask(users.student.id);
  const started = await start("student", task.id);
  assert.equal(started.status, 201, JSON.stringify(started.data));
  assert.equal(started.data.parts, 3);
  assert.equal(started.data.partSize, VIDEO_PART_BYTES);
  const path = `/assignments/${task.id}/video-uploads/${started.data.id}`;

  assert.equal(await sendPart("student", path, 1, VIDEO_PART_BYTES), 204);
  // Not finished, so it can't be joined up yet.
  const early = await call("student", "POST", `${path}/complete`);
  assert.equal(early.status, 409);
  assert.deepEqual(early.data.missing, [2, 3]);
  assert.equal(objects.size, 0, "nothing is stored until it's complete");

  // A piece that fails can be sent again; the others stay.
  failNextPart = true;
  const res = await sendPart("student", path, 2, VIDEO_PART_BYTES);
  assert.ok(res >= 500, "storage trouble is reported");
  assert.deepEqual((await call("student", "GET", path)).data.received, [1]);

  // Coming back later, only what's missing has to be sent.
  assert.equal(await sendPart("student", path, 2, VIDEO_PART_BYTES), 204);
  assert.equal(await sendPart("student", path, 3, 1000), 204);
  const status = await call("student", "GET", path);
  assert.deepEqual(status.data.received, [1, 2, 3]);
  assert.equal(status.data.complete, false);

  const done = await call("student", "POST", `${path}/complete`);
  assert.equal(done.status, 200);
  assert.match(done.data.key, /\.mp4$/);
  assert.equal(objects.get(done.data.key).size, SIZE);
  assert.equal((await call("student", "POST", `${path}/complete`)).data.key, done.data.key, "finishing twice is harmless");
  assert.equal(await sendPart("student", path, 3, 1000), 409, "a finished upload takes no more pieces");
  assert.equal((await call("student", "GET", path)).data.complete, true);

  // And it can be sent, as a video.
  const sent = await call("student", "POST", `/assignments/${task.id}/submit`, { recording: { key: done.data.key, offset: 2.5, duration: 60, speed: 1, support: "solo" } });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));
  assert.equal(sent.data.submission.recording.media, "video");
  assert.equal(sent.data.submission.recording.type, "video/mp4");
  assert.equal(sent.data.submission.recording.size, SIZE);
  assert.equal(sent.data.submission.recording.offset, 2.5);
});

test("each piece has to be the right size and part of this video", async () => {
  const task = await makeTask(users.student.id);
  const { data } = await start("student", task.id);
  const path = `/assignments/${task.id}/video-uploads/${data.id}`;
  assert.equal(await sendPart("student", path, 1, 1000), 400, "too small");
  assert.equal(await sendPart("student", path, 3, VIDEO_PART_BYTES), 400, "the last piece is only what's left");
  assert.equal(await sendPart("student", path, 4, 1000), 400, "there are only three");
  assert.equal(await sendPart("student", path, 0, 1000), 400);
  assert.equal(await sendPart("student", path, 1, VIDEO_PART_BYTES + 1), 413, "more than a piece can be");
});

test("uploads belong to the student and the task", async () => {
  const task = await makeTask(users.student.id);
  const elsewhere = await makeTask(users.student.id);
  const { data } = await start("student", task.id);
  const path = `/assignments/${task.id}/video-uploads/${data.id}`;

  assert.equal((await start("other", task.id)).status, 404);
  assert.equal((await call("other", "GET", path)).status, 404);
  assert.equal(await sendPart("other", path, 1, VIDEO_PART_BYTES), 404);
  assert.equal((await call("other", "POST", `${path}/complete`)).status, 404);
  assert.equal((await call("other", "DELETE", path)).status, 404);
  assert.equal((await call("student", "GET", `/assignments/${elsewhere.id}/video-uploads/${data.id}`)).status, 404, "not through another task");
});

test("the limits on what can be started", async () => {
  const task = await makeTask(users.student.id);
  assert.equal((await start("student", task.id, { size: MAX_VIDEO_BYTES + 1 })).status, 400);
  assert.equal((await start("student", task.id, { size: 0 })).status, 400);
  assert.equal((await start("student", task.id, { duration: 9 * 60 })).status, 400);
  assert.equal((await start("student", task.id, { type: "video/quicktime" })).status, 400);

  const audioTask = await makeTask(users.student.id, { media: "audio" });
  assert.equal((await start("student", audioTask.id)).status, 400, "an audio task doesn't take a video");

  // Only so many at once; giving up on one makes room.
  const opened = [];
  for (let i = 0; i < 3; i++) opened.push(await start("student", task.id));
  assert.deepEqual(opened.map((o) => o.status), [201, 201, 201]);
  assert.equal((await start("student", task.id)).status, 429);
  const count = aborted.length;
  assert.equal((await call("student", "DELETE", `/assignments/${task.id}/video-uploads/${opened[0].data.id}`)).status, 204);
  assert.equal(aborted.length, count + 1, "it's cancelled in storage too");
  assert.equal((await start("student", task.id)).status, 201);
});

test("uploads nobody came back to are cancelled", async () => {
  const task = await makeTask(users.student.id);
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await start("student", task.id)).data.id);
  await prisma.recordingUpload.updateMany({ where: { id: { in: ids } }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
  const count = aborted.length;
  assert.equal((await start("student", task.id)).status, 201, "old ones don't take up room");
  assert.equal(aborted.length, count + 3);
  assert.equal(await prisma.recordingUpload.count({ where: { assignmentId: task.id } }), 1);
});

test("a minor can't be filmed without a guardian's yes", async () => {
  const task = await makeTask(users.minor.id);
  const refused = await start("minor", task.id);
  assert.equal(refused.status, 403);
  assert.match(refused.data.error, /guardian/);

  // Even a video that got there some other way can't be sent.
  const key = `submissions/${task.id}/00000000-0000-4000-8000-000000000000.mp4`;
  objects.set(key, { size: 1000, contentType: "video/mp4" });
  assert.equal((await call("minor", "POST", `/assignments/${task.id}/submit`, { recording: { key } })).status, 400);

  await prisma.consentRecord.create({ data: { userId: users.minor.id, givenById: users.teacher.id, purpose: "practice-video", granted: true } });
  assert.equal((await start("minor", task.id)).status, 201);
  assert.equal((await call("minor", "POST", `/assignments/${task.id}/submit`, { recording: { key } })).status, 201);

  // Taking it back stops the next one.
  await prisma.consentRecord.create({ data: { userId: users.minor.id, givenById: users.teacher.id, purpose: "practice-video", granted: false } });
  assert.equal((await start("minor", task.id)).status, 403);
});

test("a recording's playback link only reaches the student and their teacher", async () => {
  const task = await makeTask(users.student.id);
  const key = `submissions/${task.id}/11111111-1111-4111-8111-111111111111.webm`;
  objects.set(key, { size: 1000, contentType: "video/webm" });
  assert.equal((await call("student", "POST", `/assignments/${task.id}/submit`, { recording: { key } })).status, 201);
  assert.ok((await call("student", "GET", `/assignments/${task.id}`)).data.assignment.submissions[0].recording.url);
  assert.ok((await call("teacher", "GET", `/teacher/assignments/${task.id}`)).data.assignment.submissions[0].recording.url);
  assert.equal((await call("other", "GET", `/assignments/${task.id}`)).status, 404);
});
