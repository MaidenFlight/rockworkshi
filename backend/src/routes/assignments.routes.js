const express = require("express");
const prisma = require("../lib/prisma");
const { findPage } = require("../lib/pagination");
const { requireAuth } = require("../middleware/auth");
const {
  isR2Configured,
  signedUploadUrl,
  headObject,
  putObject,
  createMultipartUpload,
  uploadPart,
  listParts,
  completeMultipartUpload,
  abortMultipartUpload,
} = require("../lib/r2");
const { canFilm } = require("../lib/consents");
const {
  SUPPORTS,
  RECORDING_TYPE,
  MAX_RECORDING_BYTES,
  VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  VIDEO_PART_BYTES,
  NEEDS_GUARDIAN,
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

// What the teacher most recently asked to be worked on next in each of these months, as
// { monthId: { list, section } }. A list only carries each task's newest send, so an earlier reply's
// priorities would disappear from it as soon as the work is sent again.
async function latestPriorities(studentId, items) {
  const monthIds = [...new Set(items.map((a) => a.monthId).filter(Boolean))];
  if (!monthIds.length) return {};
  const replies = await prisma.submission.findMany({
    where: { reviewedAt: { not: null }, assignment: { studentId, monthId: { in: monthIds } } },
    orderBy: { reviewedAt: "desc" },
    select: { priorities: true, assignment: { select: { monthId: true, section: true } } },
  });
  const latest = {};
  for (const reply of replies) {
    if (latest[reply.assignment.monthId] || !Array.isArray(reply.priorities) || !reply.priorities.length) continue;
    latest[reply.assignment.monthId] = { list: reply.priorities, section: reply.assignment.section };
  }
  return latest;
}

router.get("/", async (req, res) => {
  const { items, pagination } = await findPage(
    prisma.assignment,
    { where: { studentId: req.user.id }, include: LIST_INCLUDE, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] },
    req.query
  );
  res.json({
    assignments: await Promise.all(items.map((a) => presentAssignment(a))),
    pagination,
    canFilm: await canFilm(req.user),
    priorities: await latestPriorities(req.user.id, items),
  });
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

// ---------------------------------------------------------------------------------------------
// Video goes up in pieces, through here: the bucket doesn't take uploads from browsers, a video is far
// too big to hold in memory at once, and a dropped connection should only cost the piece it was on.

// Long enough for someone to come back and carry on the same day.
const OPEN_UPLOAD_MS = 24 * 60 * 60 * 1000;
const MAX_OPEN_UPLOADS = 3;
// R2 keeps the pieces until told otherwise, so the piece-by-piece upload has to be cancelled by hand.
async function cancelUpload(upload) {
  try {
    await abortMultipartUpload(upload.key, upload.uploadId);
  } catch (err) {
    // Already gone, or R2 will clear it by itself within the week.
    console.error(`Could not cancel upload ${upload.id}:`, err);
  }
  await prisma.recordingUpload.delete({ where: { id: upload.id } }).catch(() => {});
}

async function findOpenUpload(req, res) {
  const assignment = await findMyAssignment(req, req.params.id, {});
  const upload = assignment && (await prisma.recordingUpload.findUnique({ where: { id: req.params.uploadId } }));
  if (!upload || upload.assignmentId !== assignment.id) {
    res.status(404).json({ error: "Not found." });
    return null;
  }
  return upload;
}

const totalParts = (upload) => Math.ceil(upload.size / upload.partSize);
// Every piece is the same size except the last.
const partBytes = (upload, n) => (n < totalParts(upload) ? upload.partSize : upload.size - upload.partSize * (totalParts(upload) - 1));

// Starts a video's upload. { id, partSize, parts } says how to cut it up.
router.post("/:id/video-uploads", async (req, res) => {
  const assignment = await findMyAssignment(req, req.params.id, {});
  if (!assignment) return res.status(404).json({ error: "Not found." });
  if (assignment.media !== "video") return res.status(400).json({ error: "This task asks for audio, so record it without the camera." });
  if (!(await canFilm(req.user))) return res.status(403).json({ error: NEEDS_GUARDIAN });

  const size = Number(req.body?.size);
  const tooBig = `Videos can be up to ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB and ${MAX_VIDEO_SECONDS / 60} minutes.`;
  if (!Number.isInteger(size) || size <= 0 || size > MAX_VIDEO_BYTES) return res.status(400).json({ error: tooBig });
  const duration = Number(req.body?.duration);
  // A few seconds over is the recorder stopping itself at the limit.
  if (Number.isFinite(duration) && duration > MAX_VIDEO_SECONDS + 10) return res.status(400).json({ error: tooBig });
  const contentType = typeof req.body?.type === "string" ? req.body.type.split(";")[0].trim().toLowerCase() : "";
  if (!VIDEO_TYPES[contentType]) return res.status(400).json({ error: "This browser recorded a kind of video the school can't store." });
  if (!isR2Configured()) return res.status(503).json({ error: "Recording storage is not configured." });

  const open = await prisma.recordingUpload.findMany({ where: { assignmentId: assignment.id, completedAt: null } });
  const cutoff = Date.now() - OPEN_UPLOAD_MS;
  const abandoned = open.filter((u) => u.createdAt.getTime() < cutoff);
  await Promise.all(abandoned.map(cancelUpload));
  if (open.length - abandoned.length >= MAX_OPEN_UPLOADS) return res.status(429).json({ error: "Too many videos are part-way through uploading. Try again tomorrow." });
  if (!(await hasRoomForAnotherTake(assignment, res))) return;

  const key = newRecordingKey(assignment.id, VIDEO_TYPES[contentType]);
  const uploadId = await createMultipartUpload(key, contentType);
  const upload = await prisma.recordingUpload.create({ data: { assignmentId: assignment.id, key, uploadId, contentType, size, partSize: VIDEO_PART_BYTES } });
  res.status(201).json({ id: upload.id, partSize: upload.partSize, parts: totalParts(upload) });
});

// Which pieces have arrived, so an interrupted upload can send only the rest.
router.get("/:id/video-uploads/:uploadId", async (req, res) => {
  const upload = await findOpenUpload(req, res);
  if (!upload) return;
  if (upload.completedAt) return res.json({ id: upload.id, complete: true, key: upload.key, parts: totalParts(upload), partSize: upload.partSize, received: [] });
  const parts = await listParts(upload.key, upload.uploadId);
  res.json({ id: upload.id, complete: false, parts: totalParts(upload), partSize: upload.partSize, received: parts.map((p) => p.partNumber) });
});

router.put("/:id/video-uploads/:uploadId/parts/:n", express.raw({ type: "application/octet-stream", limit: VIDEO_PART_BYTES }), async (req, res) => {
  const upload = await findOpenUpload(req, res);
  if (!upload) return;
  if (upload.completedAt) return res.status(409).json({ error: "This video has already finished uploading." });
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > totalParts(upload)) return res.status(400).json({ error: "That isn't a piece of this video." });
  if (!Buffer.isBuffer(req.body) || req.body.length !== partBytes(upload, n)) return res.status(400).json({ error: "That piece is the wrong size." });
  await uploadPart(upload.key, upload.uploadId, n, req.body);
  res.status(204).end();
});

// Joins the pieces into one stored file, only once they've all arrived, and hands back its key for
// the send (POST /:id/submit). Safe to repeat.
router.post("/:id/video-uploads/:uploadId/complete", async (req, res) => {
  const upload = await findOpenUpload(req, res);
  if (!upload) return;
  if (!upload.completedAt) {
    const parts = await listParts(upload.key, upload.uploadId);
    const received = new Set(parts.map((p) => p.partNumber));
    const missing = Array.from({ length: totalParts(upload) }, (_, i) => i + 1).filter((n) => !received.has(n));
    if (missing.length) return res.status(409).json({ error: "Some of this video hasn't arrived yet.", missing });
    await completeMultipartUpload(upload.key, upload.uploadId, parts);
    await prisma.recordingUpload.update({ where: { id: upload.id }, data: { completedAt: new Date() } });
  }
  const stored = await headObject(upload.key);
  if (!stored || stored.size !== upload.size) return res.status(500).json({ error: "The video didn't store properly. Please send it again." });
  res.json({ key: upload.key });
});

// The student gave up on this video.
router.delete("/:id/video-uploads/:uploadId", async (req, res) => {
  const upload = await findOpenUpload(req, res);
  if (!upload) return;
  if (!upload.completedAt) await cancelUpload(upload);
  res.status(204).end();
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
  if (err.type === "entity.too.large") return res.status(413).json({ error: req.path.includes("/video-uploads/") ? "That piece is too big." : RECORDING_TOO_BIG });
  next(err);
});

module.exports = router;
