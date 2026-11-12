// The teacher's review queue. One list of the weekly assessments (and any work the teacher asked to see)
// that are waiting for them, the longest wait first, and apart from it the practice checkpoints students
// have saved. It only reads: a task's status says whether it's waiting, and the newest send decides how
// long for. Only work this teacher set, for students they still teach.
const express = require("express");
const prisma = require("../lib/prisma");
const { findPage, pageOfList } = require("../lib/pagination");
const { requireTeacher } = require("../middleware/auth");
const { INSTRUMENTS } = require("../lib/lessonVideos");
const { LIST_INCLUDE, presentAssignment } = require("../lib/assignments");

const router = express.Router();
router.use(requireTeacher);

// More than a real queue will ever hold, so the sort below sees all of it.
const QUEUE_LIMIT = 2000;
// An assessment, or a checkpoint the teacher asked to have in the queue (Assignment.reviewCheckpoint).
const FOR_REVIEW = [{ kind: "assessment" }, { reviewCheckpoint: true }];

// What the filters allow, for this teacher only. Filtering on someone else's class finds nothing.
function scope(req) {
  const { classId, studentId, instrument } = req.query;
  const student = { myTeachers: { some: { teacherId: req.user.id } } };
  if (typeof classId === "string" && classId) student.classEnrolments = { some: { classId, status: "enrolled", class: { teacherId: req.user.id } } };
  const where = { teacherId: req.user.id, student };
  if (typeof studentId === "string" && studentId) where.studentId = studentId;
  if (typeof instrument === "string" && INSTRUMENTS.includes(instrument)) where.instrument = instrument;
  return where;
}

const waitingWhere = (req) => ({ ...scope(req), status: "ready", OR: FOR_REVIEW });

// The queue in order: the longest wait first, with the id to keep ties steady.
const sentAt = (a) => (a.submissions[0]?.createdAt ?? a.updatedAt).getTime();
const byWait = (a, b) => sentAt(a) - sentAt(b) || a.id.localeCompare(b.id);

async function loadQueue(req) {
  const rows = await prisma.assignment.findMany({ where: waitingWhere(req), include: LIST_INCLUDE, take: QUEUE_LIMIT });
  return rows.sort(byWait);
}

// One row: the task and its newest send, and what the teacher needs to know before opening it.
async function row(a) {
  const task = await presentAssignment(a);
  const latest = task.submissions[0] ?? null;
  return {
    ...task,
    sentAt: latest?.createdAt ?? null,
    resubmission: task.attempts > 1,
    audioInstead: task.media === "video" && latest?.recording?.media === "audio",
  };
}

async function filterChoices(req) {
  const [links, classes] = await Promise.all([
    prisma.teacherStudent.findMany({ where: { teacherId: req.user.id }, include: { student: { select: { id: true, name: true } } } }),
    prisma.class.findMany({ where: { teacherId: req.user.id, status: "active" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return {
    students: links.map((l) => l.student).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    classes,
    instruments: INSTRUMENTS,
  };
}

router.get("/inbox", async (req, res) => {
  const view = req.query.view === "reviewed" ? "reviewed" : "waiting";
  const filters = await filterChoices(req);
  if (view === "reviewed") {
    const [waiting, page] = await Promise.all([
      prisma.assignment.count({ where: waitingWhere(req) }),
      findPage(prisma.assignment, { where: { ...scope(req), status: "reviewed", OR: FOR_REVIEW }, include: LIST_INCLUDE, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] }, req.query),
    ]);
    return res.json({ view, waiting, items: await Promise.all(page.items.map(row)), pagination: page.pagination, filters });
  }
  const queue = await loadQueue(req);
  const { items, pagination } = pageOfList(queue, req.query);
  res.json({ view, waiting: queue.length, items: await Promise.all(items.map(row)), pagination, filters });
});

// What comes after this assessment in the queue, keeping the same filters. Works from an assessment
// that has just been reviewed and so has left the queue: it carries on from where that one was.
router.get("/inbox/next", async (req, res) => {
  const queue = await loadQueue(req);
  const after = typeof req.query.after === "string" ? req.query.after : "";
  const index = queue.findIndex((a) => a.id === after);
  let next;
  if (index >= 0) {
    next = queue[index + 1] ?? queue.find((a) => a.id !== after);
  } else {
    const current = after ? await prisma.assignment.findFirst({ where: { id: after, teacherId: req.user.id }, include: { submissions: { orderBy: { createdAt: "desc" }, take: 1 } } }) : null;
    next = (current && queue.find((a) => byWait(a, current) > 0)) ?? queue[0];
  }
  res.json({
    next: next ? { id: next.id, student: next.student, section: next.section, week: next.week, kind: next.kind } : null,
    position: index >= 0 ? index + 1 : null,
    total: queue.length,
  });
});

// Saved practice takes, newest first. These are there to look at and never wait on anyone.
router.get("/checkpoints", async (req, res) => {
  const where = { ...scope(req), kind: "checkpoint", reviewCheckpoint: false, submissions: { some: {} } };
  const { items, pagination } = await findPage(prisma.assignment, { where, include: LIST_INCLUDE, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] }, req.query);
  res.json({ items: await Promise.all(items.map(row)), pagination, filters: await filterChoices(req) });
});

module.exports = router;
