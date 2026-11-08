// Permission tests for teacher assignments. Runs against the dev database in .env, creating
// throwaway @example.test accounts and deleting them afterwards.
//   npm test                 permissions only
//   TEST_R2=1 npm test       also uploads, plays back and deletes a tiny recording in R2
require("dotenv").config({ quiet: true });

// A fake admin for this process only, so the real ADMIN_EMAIL account isn't involved.
const RUN = `assign-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { isR2Configured, headObject } = require("../src/lib/r2");

let server;
let base;
const users = {};
const tokens = {};
let song;
let lesson;

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

function newAssignment(studentId, extra = {}) {
  return {
    studentId,
    songId: song.id,
    instrument: "Guitar",
    level: 2,
    section: "Chorus",
    sectionStart: 30,
    sectionEnd: 45,
    instruction: "Strum the chorus along with the band at 75%.",
    ...extra,
  };
}

// 0.1 s of silent 16-bit mono WAV.
function tinyWav() {
  const samples = 4800;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(48000, 24);
  buf.writeUInt32LE(96000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) =>
    prisma.user.create({
      data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, instrument: "Guitar", ...data },
    });
  users.admin = await make("admin");
  users.teacherA = await make("teacherA", { role: "teacher" });
  users.teacherB = await make("teacherB", { role: "teacher" });
  users.studentX = await make("studentX", { paidAt: new Date() });
  users.studentY = await make("studentY", { paidAt: new Date() });
  users.unpaid = await make("unpaid");
  for (const [key, user] of Object.entries(users)) {
    tokens[key] = signMobileToken(user, "10m");
  }

  await prisma.teacherStudent.createMany({
    data: [
      { teacherId: users.teacherA.id, studentId: users.studentX.id },
      { teacherId: users.teacherB.id, studentId: users.studentY.id },
    ],
  });

  song = await prisma.song.create({ data: { title: `${RUN} song` } });
  lesson = await prisma.lesson.create({ data: { title: `${RUN} lesson` } });
});

after(async () => {
  // Deleting through the API also removes any recordings from R2.
  const leftovers = await prisma.assignment.findMany({ where: { songId: song?.id }, select: { id: true } });
  await prisma.teacherStudent.upsert({
    where: { teacherId_studentId: { teacherId: users.teacherA.id, studentId: users.studentX.id } },
    create: { teacherId: users.teacherA.id, studentId: users.studentX.id },
    update: {},
  });
  for (const { id } of leftovers) await call("teacherA", "DELETE", `/teacher/assignments/${id}`);

  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  if (song) await prisma.song.delete({ where: { id: song.id } });
  if (lesson) await prisma.lesson.delete({ where: { id: lesson.id } });
  await prisma.$disconnect();
  server.close();
});

test("only teachers reach the teacher routes", async () => {
  assert.equal((await call(null, "GET", "/teacher/students")).status, 401);
  assert.equal((await call("studentX", "GET", "/teacher/students")).status, 403);

  const { status, data } = await call("teacherA", "GET", "/teacher/students");
  assert.equal(status, 200);
  assert.deepEqual(
    data.students.map((s) => s.id),
    [users.studentX.id]
  );
});

test("teachers see paid material without a membership; unpaid students don't", async () => {
  assert.equal((await call("teacherA", "GET", "/lessons")).status, 200);
  assert.equal((await call("unpaid", "GET", "/lessons")).status, 402);
});

test("assignments are validated and limited to linked students", async () => {
  assert.equal((await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentY.id))).status, 403);
  assert.equal(
    (await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id, { lessonId: lesson.id }))).status,
    400,
    "song and lesson together"
  );
  assert.equal(
    (
      await call(
        "teacherA",
        "POST",
        "/teacher/assignments",
        newAssignment(users.studentX.id, { songId: undefined, lessonId: lesson.id })
      )
    ).status,
    400,
    "section times on a lesson"
  );
  assert.equal(
    (await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id, { level: 6 }))).status,
    400
  );
  assert.equal(
    (await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id, { instruction: " " }))).status,
    400
  );
  assert.equal(
    (await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id, { sectionEnd: 10 }))).status,
    400,
    "section ends before it starts"
  );

  const lessonOnly = await call("teacherA", "POST", "/teacher/assignments", {
    ...newAssignment(users.studentX.id, { songId: undefined, lessonId: lesson.id }),
    sectionStart: undefined,
    sectionEnd: undefined,
  });
  assert.equal(lessonOnly.status, 201);
  assert.equal(lessonOnly.data.assignment.lesson.id, lesson.id);
  assert.equal(lessonOnly.data.assignment.levelName, "Chords");
});

test("students and teachers only reach their own assignments and feedback", async () => {
  const created = await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id));
  assert.equal(created.status, 201);
  const id = created.data.assignment.id;

  // Another teacher, and another student, get a 404 rather than a hint it exists.
  assert.equal((await call("teacherB", "GET", `/teacher/assignments/${id}`)).status, 404);
  assert.equal((await call("teacherB", "DELETE", `/teacher/assignments/${id}`)).status, 404);
  assert.equal((await call("studentY", "GET", `/assignments/${id}`)).status, 404);
  assert.equal((await call("studentY", "POST", `/assignments/${id}/submit`, {})).status, 404);
  assert.ok(!(await call("studentY", "GET", "/assignments")).data.assignments.some((a) => a.id === id));

  const mine = await call("studentX", "GET", "/assignments");
  assert.ok(mine.data.assignments.some((a) => a.id === id && a.teacher.name === "teacherA"));

  // Mark ready for review. A second tap moments later is the same send, not a new attempt.
  const submitted = await call("studentX", "POST", `/assignments/${id}/submit`, {});
  assert.equal(submitted.status, 201);
  assert.equal((await call("studentX", "POST", `/assignments/${id}/submit`, {})).status, 409);
  const ready = await call("teacherA", "GET", "/teacher/assignments?status=ready");
  assert.ok(ready.data.assignments.some((a) => a.id === id));

  const submissionId = submitted.data.submission.id;
  const feedbackPath = `/teacher/submissions/${submissionId}/feedback`;
  const feedback = { feedback: "Good timing. Let the last chord ring." };
  assert.equal((await call("studentX", "PUT", feedbackPath, feedback)).status, 403);
  assert.equal((await call("teacherB", "PUT", feedbackPath, feedback)).status, 404);
  assert.equal((await call("teacherA", "PUT", feedbackPath, { feedback: "" })).status, 400);
  assert.equal((await call("teacherA", "PUT", feedbackPath, feedback)).status, 200);

  const seen = await call("studentX", "GET", `/assignments/${id}`);
  assert.equal(seen.data.assignment.status, "reviewed");
  assert.equal(seen.data.assignment.submissions[0].feedback, feedback.feedback);

  // Once unlinked, the teacher loses access and the student can't send more for review.
  await prisma.teacherStudent.delete({
    where: { teacherId_studentId: { teacherId: users.teacherA.id, studentId: users.studentX.id } },
  });
  assert.equal((await call("teacherA", "GET", `/teacher/assignments/${id}`)).status, 404);
  assert.equal((await call("teacherA", "PUT", feedbackPath, feedback)).status, 404);
  assert.equal((await call("studentX", "POST", `/assignments/${id}/submit`, {})).status, 409);
  await prisma.teacherStudent.create({ data: { teacherId: users.teacherA.id, studentId: users.studentX.id } });
});

test("work can be sent again at any time, and the teacher's reply to the newest send completes it", async () => {
  const created = await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id));
  const id = created.data.assignment.id;
  const sendAgain = async () => {
    // Older than a double tap, so the next send is a new attempt.
    await prisma.submission.updateMany({ where: { assignmentId: id }, data: { createdAt: new Date(Date.now() - 60 * 1000) } });
    return call("studentX", "POST", `/assignments/${id}/submit`, {});
  };

  const first = await call("studentX", "POST", `/assignments/${id}/submit`, {});
  assert.equal(first.status, 201);
  // Again while still waiting for the teacher, as on Lamakū.
  const second = await sendAgain();
  assert.equal(second.status, 201, "sent again before any feedback");
  let seen = (await call("studentX", "GET", `/assignments/${id}`)).data.assignment;
  assert.equal(seen.status, "ready");
  assert.equal(seen.submissions.length, 2, "both attempts are kept");
  assert.equal(seen.submissions[0].id, second.data.submission.id, "newest first");
  const listed = (await call("studentX", "GET", "/assignments")).data.assignments.find((a) => a.id === id);
  assert.equal(listed.attempts, 2, "lists count the attempts");

  // A reply to the older attempt doesn't complete the work: the newer one is still waiting.
  const reply = { feedback: "Better. Send me the next one when it's steady." };
  assert.equal((await call("teacherA", "PUT", `/teacher/submissions/${first.data.submission.id}/feedback`, reply)).status, 200);
  assert.equal((await call("studentX", "GET", `/assignments/${id}`)).data.assignment.status, "ready");
  assert.equal((await call("teacherA", "PUT", `/teacher/submissions/${second.data.submission.id}/feedback`, reply)).status, 200);
  assert.equal((await call("studentX", "GET", `/assignments/${id}`)).data.assignment.status, "reviewed");

  // And again after the feedback, which puts it back with the teacher.
  assert.equal((await sendAgain()).status, 201);
  seen = (await call("studentX", "GET", `/assignments/${id}`)).data.assignment;
  assert.equal(seen.status, "ready");
  assert.equal(seen.submissions.length, 3);
  if (process.env.TEST_R2) {
    assert.equal((await call("studentX", "POST", `/assignments/${id}/recording-upload`, { size: 9644 })).status, 200, "a take can be uploaded while waiting");
  }
});

test("feedback can carry notes tied to moments in the song", async () => {
  const created = await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id));
  const id = created.data.assignment.id;
  const sent = await call("studentX", "POST", `/assignments/${id}/submit`, {});
  const path = `/teacher/submissions/${sent.data.submission.id}/feedback`;

  // Out of order on the way in, in song order on the way out.
  const notes = [
    { at: 31.256, text: "  Early into the G here. Wait for beat 1.  " },
    { at: 12, text: "Nice and steady." },
  ];
  const saved = await call("teacherA", "PUT", path, { feedback: "Closer. Two spots to look at.", notes });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data.submission.notes, [
    { at: 12, text: "Nice and steady." },
    { at: 31.26, text: "Early into the G here. Wait for beat 1." },
  ]);
  const seen = (await call("studentX", "GET", `/assignments/${id}`)).data.assignment.submissions[0];
  assert.equal(seen.notes.length, 2);
  assert.equal(seen.notes[1].at, 31.26);

  // Feedback sent without notes (an older client) keeps them; null clears them.
  assert.equal((await call("teacherA", "PUT", path, { feedback: "Closer still." })).data.submission.notes.length, 2);
  assert.deepEqual((await call("teacherA", "PUT", path, { feedback: "Closer still.", notes: null })).data.submission.notes, []);

  // Each note needs a moment and a line, and there's a limit.
  for (const bad of [
    "not a list",
    [{ at: -1, text: "Before the song" }],
    [{ at: "soon", text: "No time" }],
    [{ at: 10, text: "   " }],
    [{ at: 10, text: "x".repeat(281) }],
    Array.from({ length: 21 }, (_, i) => ({ at: i, text: "One" })),
  ]) {
    assert.equal((await call("teacherA", "PUT", path, { feedback: "Fine.", notes: bad })).status, 400, JSON.stringify(bad).slice(0, 40));
  }
});

test("only the admin manages roles and links", async () => {
  const z = users.unpaid.id;
  assert.equal((await call("teacherA", "GET", "/admin/teaching")).status, 403);
  assert.equal((await call("teacherA", "PATCH", `/admin/students/${z}/role`, { role: "teacher" })).status, 403);

  assert.equal((await call("admin", "PATCH", `/admin/students/${z}/role`, { role: "admin" })).status, 400);
  assert.equal(
    (await call("admin", "POST", "/admin/teaching/links", { teacherId: z, studentId: users.studentY.id })).status,
    400,
    "not a teacher yet"
  );

  assert.equal((await call("admin", "PATCH", `/admin/students/${z}/role`, { role: "teacher" })).status, 200);
  assert.equal(
    (await call("admin", "POST", "/admin/teaching/links", { teacherId: z, studentId: users.studentY.id })).status,
    201
  );
  const overview = await call("admin", "GET", "/admin/teaching");
  const teacher = overview.data.teachers.find((t) => t.id === z);
  assert.deepEqual(
    teacher.students.map((s) => s.id),
    [users.studentY.id]
  );

  // Taking the role away removes their students too.
  assert.equal((await call("admin", "PATCH", `/admin/students/${z}/role`, { role: "student" })).status, 200);
  assert.equal(await prisma.teacherStudent.count({ where: { teacherId: z } }), 0);
});

test("recordings upload privately and only reach the student and their teacher", { skip: !process.env.TEST_R2 }, async () => {
  assert.ok(isR2Configured(), "TEST_R2 is set but R2 isn't configured in .env");
  const created = await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id));
  const id = created.data.assignment.id;
  const wav = tinyWav();

  assert.equal((await call("studentY", "POST", `/assignments/${id}/recording-upload`, { size: wav.length })).status, 404);
  assert.equal(
    (await call("studentX", "POST", `/assignments/${id}/recording-upload`, { size: 999 * 1024 * 1024 })).status,
    400
  );

  const upload = await call("studentX", "POST", `/assignments/${id}/recording-upload`, { size: wav.length });
  assert.equal(upload.status, 200);
  assert.match(upload.data.key, new RegExp(`^submissions/${id}/`));

  // The signature covers the size, so a different body is refused.
  const wrongSize = await fetch(upload.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: Buffer.concat([wav, Buffer.alloc(10)]),
  });
  assert.equal(wrongSize.ok, false, "upload with a different size should be rejected");

  const put = await fetch(upload.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: wav,
  });
  assert.equal(put.status, 200, await put.text());

  // A key from another assignment can't be attached.
  const other = await call("teacherA", "POST", "/teacher/assignments", newAssignment(users.studentX.id));
  assert.equal(
    (
      await call("studentX", "POST", `/assignments/${other.data.assignment.id}/submit`, {
        recording: { key: upload.data.key },
      })
    ).status,
    400
  );

  const submitted = await call("studentX", "POST", `/assignments/${id}/submit`, {
    recording: { key: upload.data.key, offset: 30.25, duration: 0.1 },
  });
  assert.equal(submitted.status, 201);

  const review = await call("teacherA", "GET", `/teacher/assignments/${id}`);
  const recording = review.data.assignment.submissions[0].recording;
  assert.equal(recording.offset, 30.25);
  assert.match(recording.url, /X-Amz-Expires=900/);
  const played = await fetch(recording.url);
  assert.equal(played.status, 200);
  assert.equal(Buffer.from(await played.arrayBuffer()).length, wav.length);
  assert.equal((await call("teacherB", "GET", `/teacher/assignments/${id}`)).status, 404);

  // Deleting the assignment deletes the recording.
  assert.equal((await call("teacherA", "DELETE", `/teacher/assignments/${id}`)).status, 204);
  assert.equal(await headObject(upload.data.key), null);
});
