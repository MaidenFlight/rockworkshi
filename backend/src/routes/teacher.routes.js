const express = require("express");
const prisma = require("../lib/prisma");
const { findPage } = require("../lib/pagination");
const { requireTeacher } = require("../middleware/auth");
const {
  STATUSES,
  RECORDING_LINK_SECONDS,
  ASSIGNMENT_INCLUDE,
  LIST_INCLUDE,
  validateAssignment,
  validateFeedback,
  deleteAssignmentRecordings,
  presentAssignment,
  presentSubmission,
} = require("../lib/assignments");

const router = express.Router();
router.use(requireTeacher);

async function isLinked(teacherId, studentId) {
  const link = await prisma.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
  });
  return Boolean(link);
}

// An assignment this teacher set, for a student they still teach. Anything else is
// a 404, so a teacher can't tell whether someone else's assignment exists.
async function findOwnAssignment(req, id, include = ASSIGNMENT_INCLUDE) {
  const assignment = await prisma.assignment.findUnique({ where: { id }, include });
  if (!assignment || assignment.teacherId !== req.user.id) return null;
  return (await isLinked(req.user.id, assignment.studentId)) ? assignment : null;
}

router.get("/students", async (req, res) => {
  const links = await prisma.teacherStudent.findMany({
    where: { teacherId: req.user.id },
    include: { student: { select: { id: true, name: true, instrument: true, level: true } } },
  });
  const counts = await prisma.assignment.groupBy({
    by: ["studentId", "status"],
    where: { teacherId: req.user.id, studentId: { in: links.map((l) => l.studentId) } },
    _count: { _all: true },
  });

  const students = links
    .map(({ student }) => ({
      ...student,
      // e.g. { assigned: 2, ready: 1 }
      assignments: Object.fromEntries(
        counts.filter((c) => c.studentId === student.id).map((c) => [c.status, c._count._all])
      ),
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  res.json({ students });
});

// Songs and lessons to choose from when assigning.
router.get("/content", async (req, res) => {
  const [songs, lessons] = await Promise.all([
    prisma.song.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      select: { id: true, title: true, artist: true, _count: { select: { tracks: true } } },
    }),
    prisma.lesson.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      select: { id: true, title: true, artist: true },
    }),
  ]);
  res.json({
    songs: songs.map(({ _count, ...s }) => ({ ...s, hasTracks: _count.tracks > 0 })),
    lessons,
  });
});

router.get("/assignments", async (req, res) => {
  const { status, studentId } = req.query;
  const where = {
    teacherId: req.user.id,
    // Students who have since been unlinked drop out of the list.
    student: { myTeachers: { some: { teacherId: req.user.id } } },
  };
  if (STATUSES.includes(status)) where.status = status;
  if (typeof studentId === "string" && studentId) where.studentId = studentId;

  const { items, pagination } = await findPage(
    prisma.assignment,
    { where, include: LIST_INCLUDE, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] },
    req.query
  );
  res.json({ assignments: await Promise.all(items.map((a) => presentAssignment(a))), pagination });
});

router.post("/assignments", async (req, res) => {
  const { error, data } = validateAssignment(req.body);
  if (error) return res.status(400).json({ error });

  if (!(await isLinked(req.user.id, data.studentId))) {
    return res.status(403).json({ error: "You can only set work for your own students." });
  }

  const content = data.songId
    ? await prisma.song.findUnique({ where: { id: data.songId } })
    : await prisma.lesson.findUnique({ where: { id: data.lessonId } });
  if (!content || !content.published) {
    return res.status(400).json({ error: "That song or lesson isn't available." });
  }

  const assignment = await prisma.assignment.create({
    data: { ...data, teacherId: req.user.id },
    include: ASSIGNMENT_INCLUDE,
  });
  res.status(201).json({ assignment: await presentAssignment(assignment) });
});

router.get("/assignments/:id", async (req, res) => {
  const assignment = await findOwnAssignment(req, req.params.id);
  if (!assignment) return res.status(404).json({ error: "Not found." });
  res.json({ assignment: await presentAssignment(assignment, { linkSeconds: RECORDING_LINK_SECONDS }) });
});

router.delete("/assignments/:id", async (req, res) => {
  const assignment = await findOwnAssignment(req, req.params.id, {});
  if (!assignment) return res.status(404).json({ error: "Not found." });
  await prisma.assignment.delete({ where: { id: assignment.id } });
  await deleteAssignmentRecordings([assignment.id]);
  res.status(204).end();
});

// Saving again replaces the feedback.
router.put("/submissions/:id/feedback", async (req, res) => {
  const { error, value } = validateFeedback(req.body?.feedback);
  if (error) return res.status(400).json({ error });

  const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
  const assignment = submission && (await findOwnAssignment(req, submission.assignmentId, {}));
  if (!assignment) return res.status(404).json({ error: "Not found." });

  const [updated] = await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: { feedback: value, reviewedAt: new Date() },
    }),
    // Only feedback on the newest submission completes the review. If the student
    // submitted again in the meantime, that one is still waiting.
    prisma.assignment.updateMany({
      where: { id: assignment.id, submissions: { none: { createdAt: { gt: submission.createdAt } } } },
      data: { status: "reviewed" },
    }),
  ]);
  res.json({ submission: await presentSubmission(updated) });
});

module.exports = router;
