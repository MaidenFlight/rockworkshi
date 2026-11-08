const express = require("express");
const prisma = require("../lib/prisma");
const { findPage } = require("../lib/pagination");
const { requireAuth } = require("../middleware/auth");
const { isR2Configured, signedUploadUrl, headObject, putObject } = require("../lib/r2");
const { canFilm } = require("../lib/consents");
const {
  SUPPORTS,
  RECORDING_TYPE,
  MAX_RECORDING_BYTES,
  VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  UPLOAD_LINK_SECONDS,
  RECORDING_LINK_SECONDS,
  ASSIGNMENT_INCLUDE,
  LIST_INCLUDE,
  MAX_UNSENT_RECORDINGS,
  newRecordingKey,
  mediaOfKey,
  isRecordingKeyFor,
  needsTake,
  takeProblem,
  statusAfterSend,
  tidyUnsentRecordings,
  deleteRecordings,
  presentAssignment,
  presentSubmission,
} = require("../lib/assignments");

// The student's side: their own assignments only.
const router = express.Router();
router.use(requireAuth);

// A second send of the same thing this soon after the first is a double tap, not a new attempt.
const DOUBLE_SEND_MS = 10 * 1000;

// Someone else's assignment is a 404, so ids can't be probed.
async function findMyAssignment(req, id, include = ASSIGNMENT_INCLUDE) {
  const assignment = await prisma.assignment.findUnique({ where: { id }, include });
  return assignment && assignment.studentId === req.user.id ? assignment : null;
}

function numberOrNull(value, min, max) {
  const n = Number(value);
  return value !== null && value !== undefined && Number.isFinite(n) && n >= min && n <= max ? n : null;
}

router.get("/", async (req, res) => {
  const { items, pagination } = await findPage(
    prisma.assignment,
    { where: { studentId: req.user.id }, include: LIST_INCLUDE, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] },
    req.query
  );
  res.json({ assignments: await Promise.all(items.map((a) => presentAssignment(a))), pagination, canFilm: await canFilm(req.user) });
});

router.get("/:id", async (req, res) => {
  const assignment = await findMyAssignment(req, req.params.id);
  if (!assignment) return res.status(404).json({ error: "Not found." });
  res.json({ assignment: await presentAssignment(assignment, { linkSeconds: RECORDING_LINK_SECONDS }), canFilm: await canFilm(req.user) });
});

// Takes never sent are limited per assignment. Says so and returns false once at the limit.
async function hasRoomForAnotherTake(assignment, res) {
  const sent = await prisma.submission.findMany({
    where: { assignmentId: assignment.id, recordingKey: { not: null } },
    select: { recordingKey: true },
  });
  const unsent = await tidyUnsentRecordings(assignment.id, sent.map((s) => s.recordingKey));
  if (unsent < MAX_UNSENT_RECORDINGS) return true;
  res.status(429).json({ error: "Too many recordings are waiting to be sent. Try again in an hour." });
  return false;
}

const RECORDING_TOO_BIG = `Recordings can be up to ${Math.round(MAX_RECORDING_BYTES / 1024 / 1024)} MB, about 7 minutes.`;

// Step 1 of sending a recording: a link the phone can upload exactly one WAV of this size to.
// Work can be sent again at any time, so this is open whatever the work's status.
router.post("/:id/recording-upload", async (req, res) => {
  const assignment = await findMyAssignment(req, req.params.id, {});
  if (!assignment) return res.status(404).json({ error: "Not found." });

  const size = Number(req.body?.size);
  if (!Number.isInteger(size) || size <= 44 || size > MAX_RECORDING_BYTES) {
    return res.status(400).json({ error: RECORDING_TOO_BIG });
  }
  if (!isR2Configured()) return res.status(503).json({ error: "Recording storage is not configured." });

  if (!(await hasRoomForAnotherTake(assignment, res))) return;

  const key = newRecordingKey(assignment.id);
  const uploadUrl = await signedUploadUrl(key, RECORDING_TYPE, size, UPLOAD_LINK_SECONDS);
  res.json({ key, uploadUrl, contentType: RECORDING_TYPE });
});

// The website's step 1. Browsers aren't allowed to upload to the bucket directly (its CORS
// rules only allow GET), so the WAV comes through here. The result is the same stored object.
router.put("/:id/recording", express.raw({ type: RECORDING_TYPE, limit: MAX_RECORDING_BYTES }), async (req, res) => {
  const assignment = await findMyAssignment(req, req.params.id, {});
  if (!assignment) return res.status(404).json({ error: "Not found." });
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length <= 44 || body.toString("latin1", 0, 4) !== "RIFF") {
    return res.status(400).json({ error: "That recording isn't a WAV file." });
  }
  if (!isR2Configured()) return res.status(503).json({ error: "Recording storage is not configured." });
  if (!(await hasRoomForAnotherTake(assignment, res))) return;

  const key = newRecordingKey(assignment.id);
  await putObject(key, body, RECORDING_TYPE);
  res.status(201).json({ key });
});

// Step 2: send the work for review, with the uploaded recording if there is one. It can be sent again
// at any time, before or after the teacher replies: every send is kept as an attempt, newest first, and
// the teacher's reply to the newest is what marks the work reviewed (teacher.routes.js).
router.post("/:id/submit", async (req, res) => {
  const assignment = await findMyAssignment(req, req.params.id, {});
  if (!assignment) return res.status(404).json({ error: "Not found." });

  const link =
    assignment.teacherId &&
    (await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId: assignment.teacherId, studentId: assignment.studentId } },
    }));
  if (!link) {
    return res.status(409).json({ error: "The teacher who set this can't review it any more. Ask the school about it." });
  }

  const data = { assignmentId: assignment.id };
  const recording = req.body?.recording;
  if (!recording && needsTake(assignment)) {
    return res.status(400).json({ error: "This task needs a recording. Record a take first." });
  }
  if (recording) {
    if (!isRecordingKeyFor(assignment.id, recording.key)) {
      return res.status(400).json({ error: "That recording doesn't belong to this assignment." });
    }
    if (!isR2Configured()) return res.status(503).json({ error: "Recording storage is not configured." });

    const media = mediaOfKey(recording.key);
    const speed = numberOrNull(recording.speed, 0.25, 1);
    const support = SUPPORTS.includes(recording.support) ? recording.support : null;
    const problem = takeProblem(assignment, { media, speed, support }, { canFilm: await canFilm(req.user) });
    if (problem) return res.status(400).json({ error: problem });

    // The upload fixes type and size, but check what actually arrived.
    const stored = await headObject(recording.key);
    if (!stored) return res.status(400).json({ error: "The recording hasn't finished uploading." });
    const fits = media === "audio" ? stored.size <= MAX_RECORDING_BYTES && stored.contentType === RECORDING_TYPE : stored.size <= MAX_VIDEO_BYTES && Boolean(VIDEO_TYPES[stored.contentType]);
    if (!fits) {
      await deleteRecordings([recording.key]);
      return res.status(400).json({ error: media === "audio" ? "That recording isn't a WAV file within the size limit." : "That recording isn't a video within the size limit." });
    }

    data.recordingKey = recording.key;
    // Seconds. A take can start a moment before the song does, hence the small negative allowance.
    data.recordingOffset = numberOrNull(recording.offset, -10, 24 * 60 * 60);
    data.recordingDuration = numberOrNull(recording.duration, 0, 24 * 60 * 60);
    data.media = media;
    data.recordingType = stored.contentType;
    data.recordingSize = stored.size;
    data.support = support;
    // A full-speed take is the usual case, and is what no speed means.
    data.speed = speed !== null && speed < 1 ? speed : null;
  }

  // Two taps on the same send make one attempt: the same take (or no take) moments after the last one.
  const last = await prisma.submission.findFirst({ where: { assignmentId: assignment.id }, orderBy: { createdAt: "desc" } });
  if (last && !last.reviewedAt && last.recordingKey === (data.recordingKey ?? null) && Date.now() - last.createdAt.getTime() < DOUBLE_SEND_MS) {
    return res.status(409).json({ error: assignment.kind === "checkpoint" ? "That was just saved." : "That was just sent. It's waiting for your teacher." });
  }

  let submission;
  try {
    submission = await prisma.$transaction(async (tx) => {
      await tx.assignment.update({ where: { id: assignment.id }, data: { status: statusAfterSend(assignment) } });
      return tx.submission.create({ data });
    });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That recording was already sent." });
    throw err;
  }

  res.status(201).json({ submission: await presentSubmission(submission) });
});

// express.raw reports an oversized body as an error, not a request.
router.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: RECORDING_TOO_BIG });
  next(err);
});

module.exports = router;
