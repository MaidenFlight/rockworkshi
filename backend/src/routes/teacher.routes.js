const express = require("express");
const prisma = require("../lib/prisma");
const { findPage } = require("../lib/pagination");
const { requireTeacher } = require("../middleware/auth");
const { audit } = require("../lib/audit");
const { canonicalInstrument } = require("../lib/instrumentAccess");
const { isDateString } = require("../lib/zoned");
const { canFilm } = require("../lib/consents");
const { buildMonth, sectionsOf, transitionsOf, WEEK_TITLES } = require("../lib/weeklyTemplate");
const { same, taskLabel } = require("../lib/monthPlans");
const {
  STATUSES,
  MAX_MONTH_TASKS,
  RECORDING_LINK_SECONDS,
  ASSIGNMENT_INCLUDE,
  LIST_INCLUDE,
  validateAssignment,
  validateTaskEdit,
  statusAfterEdit,
  validateWeekTitles,
  validateFeedback,
  validateNotes,
  validateMarks,
  validatePriorities,
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

// Whether this teacher can set work for this student, and the one instrument it can be for. Answers
// the request itself and returns null when not. Students practise the one instrument the school has on
// file for them, so that's the only one work can be set for: assigning never opens another's part.
async function studentToTeach(req, res, studentId) {
  if (!(await isLinked(req.user.id, studentId))) {
    res.status(403).json({ error: "You can only set work for your own students." });
    return null;
  }
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, instrument: true, isMinor: true } });
  const instrument = canonicalInstrument(student?.instrument);
  if (!instrument) {
    res.status(400).json({ error: "This student has no instrument set yet. Ask the admin to set it first." });
    return null;
  }
  return { ...student, instrument };
}

async function publishedSong(songId) {
  if (typeof songId !== "string" || !songId) return null;
  const song = await prisma.song.findUnique({ where: { id: songId } });
  return song && song.published ? song : null;
}

router.get("/students", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const instrument = typeof req.query.instrument === "string" ? req.query.instrument : "";
  const links = await prisma.teacherStudent.findMany({
    where: {
      teacherId: req.user.id,
      student: {
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(instrument ? { OR: [{ instrument }, { instruments: { some: { instrument } } }] } : {}),
      },
    },
    include: {
      student: {
        select: { id: true, name: true, instrument: true, level: true, instruments: { select: { instrument: true, primary: true, selfLevel: true, teacherLevel: true } } },
      },
    },
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
      select: { id: true, title: true, artist: true, chart: true, _count: { select: { tracks: true } } },
    }),
    prisma.lesson.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      select: { id: true, title: true, artist: true },
    }),
  ]);
  res.json({
    songs: songs.map(({ _count, chart, ...s }) => ({ ...s, hasTracks: _count.tracks > 0, hasChart: sectionsOf(chart).length > 0 })),
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

  const student = await studentToTeach(req, res, data.studentId);
  if (!student) return;
  if (data.instrument !== student.instrument) {
    return res.status(400).json({ error: `This student studies ${student.instrument}, so set the work for ${student.instrument}.` });
  }

  const content = data.songId
    ? await prisma.song.findUnique({ where: { id: data.songId } })
    : await prisma.lesson.findUnique({ where: { id: data.lessonId } });
  if (!content || !content.published) {
    return res.status(400).json({ error: "That song or lesson isn't available." });
  }

  // A week only means something inside a month (POST /months).
  const assignment = await prisma.assignment.create({
    data: { ...data, week: null, teacherId: req.user.id },
    include: ASSIGNMENT_INCLUDE,
  });
  res.status(201).json({ assignment: await presentAssignment(assignment) });
});

// What saving a change to this task would do, for the teacher to see first. Nothing is written.
router.post("/assignments/:id/impact", async (req, res) => {
  const assignment = await findOwnAssignment(req, req.params.id, {
    student: { select: { id: true, name: true } },
    month: { select: { id: true, plan: { select: { id: true, name: true } } } },
    _count: { select: { submissions: true } },
  });
  if (!assignment) return res.status(404).json({ error: "Not found." });
  const { error, data } = validateTaskEdit(req.body, assignment);
  if (error) return res.status(400).json({ error });
  res.json({
    impact: {
      student: assignment.student,
      label: taskLabel(assignment),
      week: assignment.week,
      kind: assignment.kind,
      attempts: assignment._count.submissions,
      fields: Object.keys(data)
        .filter((field) => !same(assignment[field], data[field]))
        .map((field) => ({ field, from: assignment[field] ?? null, to: data[field] ?? null })),
      status: assignment.status,
      statusAfter: statusAfterEdit(assignment, { ...assignment, ...data }),
      plan: assignment.month?.plan ?? null,
    },
  });
});

// Changing what a task asks for. Takes already sent keep how they were made (Submission).
router.put("/assignments/:id", async (req, res) => {
  const assignment = await findOwnAssignment(req, req.params.id, {});
  if (!assignment) return res.status(404).json({ error: "Not found." });
  const { error, data } = validateTaskEdit(req.body, assignment);
  if (error) return res.status(400).json({ error });
  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: { ...data, status: statusAfterEdit(assignment, { ...assignment, ...data }) },
    include: ASSIGNMENT_INCLUDE,
  });
  const changed = Object.keys(data).filter((field) => !same(assignment[field], data[field]));
  if (changed.length) await audit(req.user, "assignment.edit", "assignment", assignment.id, { student: assignment.studentId, changed });
  res.json({ assignment: await presentAssignment(updated, { linkSeconds: RECORDING_LINK_SECONDS }) });
});

// ---------------------------------------------------------------------------------------------
// A month of practice on one song: four weeks of checkpoints and assessments for one student.

const MONTH_INCLUDE = {
  song: { select: { id: true, title: true, artist: true, chart: true } },
  student: { select: { id: true, name: true, instrument: true, isMinor: true } },
  tasks: { include: ASSIGNMENT_INCLUDE, orderBy: [{ week: "asc" }, { position: "asc" }] },
  plan: { select: { id: true, name: true } },
};

// A month this teacher set, for a student they still teach. Anything else is a 404.
async function findOwnMonth(req, id, include = MONTH_INCLUDE) {
  const month = await prisma.practiceMonth.findUnique({ where: { id }, include });
  if (!month || month.teacherId !== req.user.id) return null;
  return (await isLinked(req.user.id, month.studentId)) ? month : null;
}

// Everything the month's page needs. Checkpoint takes come with links, so they can be listened to here
// without entering the queue. sections are the chart's, for choosing what a task covers.
async function presentMonth(month) {
  return {
    id: month.id,
    startsOn: month.startsOn,
    weekTitles: month.weekTitles,
    song: month.song ? { id: month.song.id, title: month.song.title, artist: month.song.artist } : null,
    student: { id: month.student.id, name: month.student.name, instrument: month.student.instrument },
    plan: month.plan ?? null,
    canFilm: await canFilm(month.student),
    sections: sectionsOf(month.song?.chart).map(({ name, start, end }) => ({ name, start, end })),
    transitions: transitionsOf(month.song?.chart),
    tasks: await Promise.all(month.tasks.map((t) => presentAssignment(t, { linkSeconds: RECORDING_LINK_SECONDS }))),
  };
}

// One task of a month, from what the teacher sent. { error } or { data }.
function monthTask(body, index, month) {
  const { error, data } = validateAssignment({ ...body, studentId: month.studentId, songId: month.songId, lessonId: undefined, instrument: month.instrument });
  if (error) return { error: `Task ${index + 1}: ${error}` };
  if (!data.week) return { error: `Task ${index + 1}: choose a week.` };
  return { data };
}

// The template's suggestion for this song, to edit before setting it. Nothing is saved.
router.post("/months/draft", async (req, res) => {
  const { studentId, songId, startsOn, level, readsChart } = req.body || {};
  if (typeof studentId !== "string" || !studentId) return res.status(400).json({ error: "Choose a student." });
  if (!isDateString(startsOn)) return res.status(400).json({ error: "Choose the date the month starts." });
  const n = Number(level);
  if (!Number.isInteger(n) || n < 1 || n > 5) return res.status(400).json({ error: "level must be a whole number from 1 to 5." });
  const student = await studentToTeach(req, res, studentId);
  if (!student) return;
  const song = await publishedSong(songId);
  if (!song) return res.status(400).json({ error: "That song isn't available." });
  res.json({ draft: buildMonth(song.chart, { startsOn, level: n, readsChart: readsChart === true, instrument: student.instrument }), instrument: student.instrument, canFilm: await canFilm(student) });
});

router.post("/months", async (req, res) => {
  const { studentId, songId, startsOn, weekTitles, tasks } = req.body || {};
  if (typeof studentId !== "string" || !studentId) return res.status(400).json({ error: "Choose a student." });
  if (!isDateString(startsOn)) return res.status(400).json({ error: "Choose the date the month starts." });
  const titles = validateWeekTitles(weekTitles ?? WEEK_TITLES);
  if (titles.error) return res.status(400).json({ error: titles.error });
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > MAX_MONTH_TASKS) {
    return res.status(400).json({ error: `A month needs 1 to ${MAX_MONTH_TASKS} tasks.` });
  }

  const student = await studentToTeach(req, res, studentId);
  if (!student) return;
  const song = await publishedSong(songId);
  if (!song) return res.status(400).json({ error: "That song isn't available." });

  const rows = [];
  for (const [i, task] of tasks.entries()) {
    const { error, data } = monthTask(task, i, { studentId, songId, instrument: student.instrument });
    if (error) return res.status(400).json({ error });
    rows.push({ ...data, teacherId: req.user.id, position: i });
  }

  const { id } = await prisma.$transaction(async (tx) => {
    const month = await tx.practiceMonth.create({ data: { teacherId: req.user.id, studentId, songId, startsOn, weekTitles: titles.value } });
    await tx.assignment.createMany({ data: rows.map((row) => ({ ...row, monthId: month.id })) });
    return month;
  });
  res.status(201).json({ month: await presentMonth(await prisma.practiceMonth.findUnique({ where: { id }, include: MONTH_INCLUDE })) });
});

// A student's months, newest first, with how far each has got.
router.get("/months", async (req, res) => {
  const { studentId } = req.query;
  if (typeof studentId !== "string" || !studentId || !(await isLinked(req.user.id, studentId))) return res.json({ months: [] });
  const months = await prisma.practiceMonth.findMany({
    where: { teacherId: req.user.id, studentId },
    orderBy: { startsOn: "desc" },
    include: { song: { select: { id: true, title: true, artist: true } }, tasks: { select: { status: true, kind: true, week: true } } },
  });
  res.json({
    months: months.map((m) => ({
      id: m.id,
      startsOn: m.startsOn,
      weekTitles: m.weekTitles,
      song: m.song,
      tasks: m.tasks.length,
      assessments: m.tasks.filter((t) => t.kind === "assessment").length,
      waiting: m.tasks.filter((t) => t.status === "ready").length,
    })),
  });
});

router.get("/months/:id", async (req, res) => {
  const month = await findOwnMonth(req, req.params.id);
  if (!month) return res.status(404).json({ error: "Not found." });
  res.json({ month: await presentMonth(month) });
});

// The month's start date and week names. Each task keeps its own due date.
router.put("/months/:id", async (req, res) => {
  const month = await findOwnMonth(req, req.params.id, {});
  if (!month) return res.status(404).json({ error: "Not found." });
  const data = {};
  if (req.body?.startsOn !== undefined) {
    if (!isDateString(req.body.startsOn)) return res.status(400).json({ error: "Choose the date the month starts." });
    data.startsOn = req.body.startsOn;
  }
  if (req.body?.weekTitles !== undefined) {
    const titles = validateWeekTitles(req.body.weekTitles);
    if (titles.error) return res.status(400).json({ error: titles.error });
    data.weekTitles = titles.value;
  }
  await prisma.practiceMonth.update({ where: { id: month.id }, data });
  res.json({ month: await presentMonth(await findOwnMonth(req, month.id)) });
});

router.post("/months/:id/tasks", async (req, res) => {
  const month = await findOwnMonth(req, req.params.id, { tasks: { select: { position: true } }, student: { select: { instrument: true } } });
  if (!month) return res.status(404).json({ error: "Not found." });
  if (month.tasks.length >= MAX_MONTH_TASKS) return res.status(400).json({ error: `A month can have up to ${MAX_MONTH_TASKS} tasks.` });
  if (!month.songId) return res.status(400).json({ error: "This month's song has been removed." });
  const { error, data } = monthTask(req.body, month.tasks.length, { studentId: month.studentId, songId: month.songId, instrument: canonicalInstrument(month.student.instrument) });
  if (error) return res.status(400).json({ error: error.replace(/^Task \d+: /, "") });
  const position = Math.max(-1, ...month.tasks.map((t) => t.position)) + 1;
  const task = await prisma.assignment.create({ data: { ...data, teacherId: req.user.id, monthId: month.id, position }, include: ASSIGNMENT_INCLUDE });
  await audit(req.user, "assignment.add", "assignment", task.id, { student: month.studentId, month: month.id });
  res.status(201).json({ assignment: await presentAssignment(task) });
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
  await audit(req.user, "assignment.delete", "assignment", assignment.id, { student: assignment.studentId, month: assignment.monthId, section: assignment.section });
  res.status(204).end();
});

// Saving again replaces the feedback, and the notes tied to moments when they're sent with it.
router.put("/submissions/:id/feedback", async (req, res) => {
  const { error, value } = validateFeedback(req.body?.feedback);
  if (error) return res.status(400).json({ error });
  const notes = validateNotes(req.body?.notes);
  if (notes.error) return res.status(400).json({ error: notes.error });
  const marks = validateMarks(req.body?.marks);
  if (marks.error) return res.status(400).json({ error: marks.error });
  const priorities = validatePriorities(req.body?.priorities);
  if (priorities.error) return res.status(400).json({ error: priorities.error });

  const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
  const assignment = submission && (await findOwnAssignment(req, submission.assignmentId, {}));
  if (!assignment) return res.status(404).json({ error: "Not found." });

  const [updated] = await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: {
        feedback: value,
        reviewedAt: new Date(),
        ...(notes.value !== undefined ? { notes: notes.value } : {}),
        ...(marks.value !== undefined ? { marks: marks.value } : {}),
        ...(priorities.value !== undefined ? { priorities: priorities.value } : {}),
      },
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
