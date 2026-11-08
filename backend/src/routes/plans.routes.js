// Month plans and templates: a teacher's working documents. A plan is drafted here and previewed, and
// only an explicit publish makes ordinary months and tasks for its students. After that, nothing changes
// for a student until the teacher has seen exactly what a change would do and applied it. The rules
// themselves are in lib/monthPlans.js.
//
// Plans belong to the teacher who made them: anyone else's is a 404, and nothing here reaches past the
// students linked to them.
const express = require("express");
const prisma = require("../lib/prisma");
const clock = require("../lib/clock");
const { requireTeacher } = require("../middleware/auth");
const { audit } = require("../lib/audit");
const { canFilm } = require("../lib/consents");
const { REAL } = require("../lib/demoRules");
const { canonicalInstrument } = require("../lib/instrumentAccess");
const { INSTRUMENTS, LEVEL_NAMES } = require("../lib/lessonVideos");
const { isDateString } = require("../lib/zoned");
const { buildMonth, sectionsOf, transitionsOf, WEEK_TITLES } = require("../lib/weeklyTemplate");
const { cleanText, deleteAssignmentRecordings } = require("../lib/assignments");
const plans = require("../lib/monthPlans");

const router = express.Router();
router.use(requireTeacher);

const today = () => clock.now().toLocaleDateString("en-CA", { timeZone: "Pacific/Honolulu" });
const PERSON = { id: true, name: true, instrument: true, isMinor: true };
// A long write can touch every task of every student in a class; it's worth waiting for.
const LONG_WRITE = { timeout: 60000, maxWait: 10000 };

const PLAN_INCLUDE = {
  song: { select: { id: true, title: true, artist: true, published: true, chart: true, _count: { select: { tracks: true } } } },
  class: { select: { id: true, title: true } },
  template: { select: { id: true, name: true, version: true, archivedAt: true } },
  students: { include: { student: { select: PERSON } }, orderBy: { createdAt: "asc" } },
};

async function ownPlan(req, id, include = PLAN_INCLUDE) {
  const plan = await prisma.monthPlan.findUnique({ where: { id }, include });
  return plan && plan.teacherId === req.user.id ? plan : null;
}

async function linkedSet(teacherId, ids) {
  const links = await prisma.teacherStudent.findMany({ where: { teacherId, ...(ids ? { studentId: { in: ids } } : {}) }, select: { studentId: true } });
  return new Set(links.map((l) => l.studentId));
}

async function ownClass(teacherId, classId) {
  if (typeof classId !== "string" || !classId) return null;
  return prisma.class.findFirst({ where: { id: classId, teacherId } });
}

async function publishedSong(songId) {
  if (typeof songId !== "string" || !songId) return null;
  const song = await prisma.song.findUnique({ where: { id: songId } });
  return song && song.published ? song : null;
}

function planSummary(plan) {
  return {
    id: plan.id,
    kind: plan.kind,
    name: plan.name,
    status: plans.statusOf(plan),
    instrument: plan.instrument,
    level: plan.level,
    levelName: LEVEL_NAMES[plan.level - 1] ?? null,
    startsOn: plan.startsOn,
    version: plan.version,
    song: plan.song ? { id: plan.song.id, title: plan.song.title, artist: plan.song.artist } : null,
    class: plan.class ?? null,
    tasks: Array.isArray(plan.tasks) ? plan.tasks.length : 0,
    students: plan._count?.students ?? plan.students?.length ?? 0,
    months: plan._count?.months ?? 0,
    templateId: plan.templateId,
    publishedAt: plan.publishedAt,
    archivedAt: plan.archivedAt,
    updatedAt: plan.updatedAt,
  };
}

// Why a student can't, or shouldn't be assumed to, get this plan. Worded for the teacher's list.
function studentIssues({ plan, student, linked, filmable }) {
  const issues = [];
  const instrument = canonicalInstrument(student.instrument);
  if (!linked) issues.push({ kind: "not-linked", blocking: true, text: "Not linked to you. The school office links students to teachers in Admin." });
  if (!instrument) issues.push({ kind: "no-instrument", blocking: true, text: "No instrument on file. Ask the school to set it first." });
  else if (instrument !== plan.instrument) issues.push({ kind: "other-instrument", blocking: false, text: `Studies ${instrument}. This plan was written for ${plan.instrument}.` });
  if (!filmable && plan.tasks.some((t) => t.media === "video")) {
    issues.push({ kind: "no-video-consent", blocking: false, text: "Under 18, and a guardian hasn't turned on Practice videos. Video tasks will ask for audio until they do." });
  }
  return issues;
}

// Which version of a template a plan's copy came from, as content.
async function versionOf(planId, version) {
  return prisma.monthPlanVersion.findUnique({ where: { planId_version: { planId, version } } });
}

// Everything each of the plan's published students would get from applying the plan as it stands now.
async function impactOf(plan) {
  const [months, versions, seats, linked] = await Promise.all([
    prisma.practiceMonth.findMany({
      where: { planId: plan.id },
      include: { student: { select: PERSON }, tasks: { include: { _count: { select: { submissions: true } } } } },
    }),
    prisma.monthPlanVersion.findMany({ where: { planId: plan.id } }),
    prisma.monthPlanStudent.findMany({ where: { planId: plan.id } }),
    linkedSet(plan.teacherId),
  ]);
  const byVersion = new Map(versions.map((v) => [v.version, v]));
  const overridesOf = new Map(seats.map((s) => [s.studentId, s.overrides ?? {}]));
  const target = plans.contentOf(plan);

  const students = months
    .map((m) => {
      const base = byVersion.get(m.planVersion);
      if (!base) return null;
      const month = { startsOn: m.startsOn, weekTitles: m.weekTitles, tasks: m.tasks.map((t) => ({ ...t, attempts: t._count.submissions })) };
      const impact = plans.monthImpact({ base, target, month, overrides: overridesOf.get(m.studentId) });
      return {
        studentId: m.studentId,
        name: m.student.name,
        instrument: canonicalInstrument(m.student.instrument),
        monthId: m.id,
        onVersion: m.planVersion,
        linked: linked.has(m.studentId),
        changeCount: plans.changeCount(impact),
        ...impact,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const affected = students.filter((s) => s.linked && s.changeCount > 0);
  const tasksWithTakes = affected.flatMap((s) => s.changes.filter((c) => c.fields.length && c.attempts > 0));
  return {
    students,
    affected,
    totals: {
      students: affected.length,
      tasks: affected.reduce((n, s) => n + s.changes.filter((c) => c.fields.length).length + s.adds.length + s.removes.length, 0),
      withTakes: tasksWithTakes.length,
      unlinked: students.filter((s) => !s.linked && s.changeCount > 0).length,
    },
    basis: plans.basisOf(affected),
  };
}

// The impact as the page shows it: names and words, without the rows it would write.
function presentImpact(impact) {
  const strip = ({ updates, ...c }) => c;
  return {
    totals: impact.totals,
    basis: impact.basis,
    students: impact.students
      .filter((s) => s.changeCount > 0 || s.changes.length > 0 || s.keeps.length > 0)
      .map((s) => ({
        studentId: s.studentId,
        name: s.name,
        instrument: s.instrument,
        monthId: s.monthId,
        linked: s.linked,
        changeCount: s.changeCount,
        reordered: s.reordered,
        monthFields: s.monthFields,
        monthKept: s.monthKept,
        changes: s.changes.map(strip),
        adds: s.adds.map(({ data, ...a }) => a),
        removes: s.removes,
        keeps: s.keeps,
      })),
  };
}

// The plan in full for its page.
async function planPayload(plan) {
  const sections = sectionsOf(plan.song?.chart).map(({ name, start, end }) => ({ name, start, end }));
  const check = plan.kind === "plan" ? plans.checkPlan(plan, { today: today(), song: plan.song }) : { problems: [], warnings: [] };
  const base = {
    ...planSummary(plan),
    startsOn: plan.startsOn,
    weekTitles: plan.weekTitles,
    tasks: plan.tasks.map((t) => ({ ...t, dueOn: plans.dueOnOf(t, plan.startsOn) })),
    revision: plan.revision,
    sections,
    transitions: transitionsOf(plan.song?.chart),
    song: plan.song
      ? { id: plan.song.id, title: plan.song.title, artist: plan.song.artist, published: plan.song.published, hasChart: sections.length > 0, hasTracks: plan.song._count.tracks > 0 }
      : null,
    check,
  };

  if (plan.kind === "template") {
    const copies = await prisma.monthPlan.findMany({
      where: { templateId: plan.id, kind: "plan" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, startsOn: true, templateVersion: true, publishedAt: true, archivedAt: true, _count: { select: { students: true, months: true } } },
    });
    return {
      ...base,
      usedBy: copies.map((c) => ({
        id: c.id,
        name: c.name,
        startsOn: c.startsOn,
        status: plans.statusOf(c),
        templateVersion: c.templateVersion,
        behind: c.templateVersion < plan.version,
        students: c._count.students,
        months: c._count.months,
      })),
    };
  }

  const ids = plan.students.map((s) => s.studentId);
  const [linked, months] = await Promise.all([
    linkedSet(plan.teacherId, ids),
    prisma.practiceMonth.findMany({ where: { planId: plan.id }, include: { tasks: { select: { status: true } } } }),
  ]);
  const monthOf = new Map(months.map((m) => [m.studentId, m]));

  const students = await Promise.all(
    plan.students.map(async ({ student, overrides }) => {
      const month = monthOf.get(student.id);
      return {
        id: student.id,
        name: student.name,
        instrument: canonicalInstrument(student.instrument),
        isMinor: student.isMinor,
        overrides: overrides ?? {},
        issues: studentIssues({ plan, student, linked: linked.has(student.id), filmable: await canFilm(student) }),
        month: month
          ? { id: month.id, planVersion: month.planVersion, tasks: month.tasks.length, done: month.tasks.filter((t) => ["saved", "ready", "reviewed"].includes(t.status)).length }
          : null,
      };
    })
  );

  const impact = months.length ? await impactOf(plan) : null;
  return {
    ...base,
    students,
    pendingChanges: impact ? impact.affected.reduce((n, s) => n + s.changeCount, 0) : 0,
    template: plan.template
      ? { id: plan.template.id, name: plan.template.name, version: plan.templateVersion, latest: plan.template.version, behind: plan.templateVersion < plan.template.version, archived: Boolean(plan.template.archivedAt) }
      : null,
  };
}

// Saves a snapshot of the plan as it stands if it has changed since the last, and returns its version.
async function snapshot(tx, plan, actorId) {
  const latest = plan.version ? await tx.monthPlanVersion.findUnique({ where: { planId_version: { planId: plan.id, version: plan.version } } }) : null;
  if (latest && plans.sameContent(latest, plan)) return plan.version;
  const version = plan.version + 1;
  await tx.monthPlanVersion.create({ data: { planId: plan.id, version, startsOn: plan.startsOn, weekTitles: plan.weekTitles, tasks: plan.tasks, createdById: actorId } });
  await tx.monthPlan.update({ where: { id: plan.id }, data: { version } });
  return version;
}

// ---------------------------------------------------------------------------------------------
// Who a teacher can plan for.

router.get("/roster", async (req, res) => {
  const [links, classes] = await Promise.all([
    prisma.teacherStudent.findMany({ where: { teacherId: req.user.id, student: REAL }, include: { student: { select: PERSON } } }),
    prisma.class.findMany({
      where: { teacherId: req.user.id, status: "active" },
      orderBy: { title: "asc" },
      include: { enrolments: { where: { status: "enrolled" }, include: { user: { select: PERSON } } } },
    }),
  ]);
  const linked = new Set(links.map((l) => l.studentId));
  const person = (s) => ({ id: s.id, name: s.name, instrument: canonicalInstrument(s.instrument), isMinor: s.isMinor });
  res.json({
    students: links.map((l) => person(l.student)).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    classes: classes.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      instruments: c.instruments,
      members: c.enrolments.map((e) => ({ ...person(e.user), linked: linked.has(e.user.id) })),
    })),
  });
});

// ---------------------------------------------------------------------------------------------
// Listing and starting plans.

router.get("/plans", async (req, res) => {
  const kind = req.query.kind === "template" ? "template" : "plan";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const where = { teacherId: req.user.id, kind };
  if (status === "archived") where.archivedAt = { not: null };
  else {
    where.archivedAt = null;
    if (status === "draft") where.publishedAt = null;
    if (status === "published") where.publishedAt = { not: null };
  }
  const list = await prisma.monthPlan.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { song: { select: { id: true, title: true, artist: true } }, class: { select: { id: true, title: true } }, _count: { select: { students: true, months: true } } },
  });
  res.json({ plans: list.map(planSummary) });
});

// Starts a draft: from a template, from the song's own sections, or empty.
router.post("/plans", async (req, res) => {
  const { templateId, songId, startsOn, level, instrument, readsChart, classId } = req.body || {};
  const studentIds = Array.isArray(req.body?.studentIds) ? [...new Set(req.body.studentIds.filter((id) => typeof id === "string"))] : [];
  if (!isDateString(startsOn)) return res.status(400).json({ error: "Choose the date the month starts." });

  const linked = await linkedSet(req.user.id, studentIds);
  if (studentIds.some((id) => !linked.has(id))) return res.status(403).json({ error: "You can only plan for your own students." });
  if (classId && !(await ownClass(req.user.id, classId))) return res.status(404).json({ error: "That class isn't one of yours." });

  let data;
  if (templateId) {
    const template = await ownPlan(req, templateId, {});
    if (!template || template.kind !== "template") return res.status(404).json({ error: "That template isn't one of yours." });
    if (template.archivedAt) return res.status(400).json({ error: "That template has been archived. Restore it to use it." });
    if (!(await publishedSong(template.songId))) return res.status(400).json({ error: "This template's song is no longer in the library." });
    data = {
      name: template.name,
      instrument: template.instrument,
      level: template.level,
      songId: template.songId,
      weekTitles: template.weekTitles,
      // The same task ids: it's how later changes to the template find their way to this plan.
      tasks: template.tasks,
      templateId: template.id,
      templateVersion: template.version,
    };
  } else {
    const n = Number(level);
    if (!Number.isInteger(n) || n < 1 || n > 5) return res.status(400).json({ error: "level must be a whole number from 1 to 5." });
    if (!INSTRUMENTS.includes(instrument)) return res.status(400).json({ error: "Choose the instrument this plan is for." });
    const song = await publishedSong(songId);
    if (!song) return res.status(400).json({ error: "That song isn't available." });
    const start = req.body?.start === "empty" ? null : buildMonth(song.chart, { startsOn, level: n, readsChart: readsChart === true });
    const tasks = plans.cleanTasks(start ? plans.tasksFromSuggestion(start, startsOn) : []);
    if (tasks.error) return res.status(400).json({ error: tasks.error });
    data = { name: song.title, instrument, level: n, songId: song.id, weekTitles: start?.weekTitles ?? WEEK_TITLES, tasks: tasks.value };
  }

  const name = cleanText(req.body?.name, plans.MAX_NAME);
  const plan = await prisma.monthPlan.create({
    data: {
      ...data,
      ...(name.value ? { name: name.value } : {}),
      kind: "plan",
      teacherId: req.user.id,
      startsOn,
      classId: classId || null,
      students: { create: studentIds.map((studentId) => ({ studentId })) },
    },
    include: PLAN_INCLUDE,
  });
  res.status(201).json({ plan: await planPayload(plan) });
});

router.get("/plans/:id", async (req, res) => {
  const plan = await ownPlan(req, req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found." });
  res.json({ plan: await planPayload(plan) });
});

// Saves the working copy. Only a template's saves make a new version: a plan's changes reach nobody until
// they're applied. A save from an out-of-date copy is refused rather than overwriting newer work.
router.put("/plans/:id", async (req, res) => {
  const plan = await ownPlan(req, req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found." });
  if (plan.archivedAt) return res.status(409).json({ error: "Restore this before changing it." });
  const { error, data } = plans.parseDocument(req.body, plan);
  if (error) return res.status(400).json({ error });

  const saved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.monthPlan.updateMany({ where: { id: plan.id, revision: Number(req.body?.revision) }, data: { ...data, revision: { increment: 1 } } });
    if (!count) return null;
    const fresh = await tx.monthPlan.findUnique({ where: { id: plan.id } });
    if (plan.kind === "template") await snapshot(tx, fresh, req.user.id);
    return tx.monthPlan.findUnique({ where: { id: plan.id }, include: PLAN_INCLUDE });
  });
  if (!saved) return res.status(409).json({ error: "This was changed somewhere else, like another window. Reload to get the latest before saving.", stale: true });
  res.json({ plan: await planPayload(saved) });
});

// ---------------------------------------------------------------------------------------------
// Who it's for, and what's different for each of them.

router.put("/plans/:id/students", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  if (plan.archivedAt) return res.status(409).json({ error: "Restore this before changing it." });
  if (!Array.isArray(req.body?.studentIds) || req.body.studentIds.some((id) => typeof id !== "string")) return res.status(400).json({ error: "studentIds has to be a list." });
  const wanted = [...new Set(req.body.studentIds)];
  const linked = await linkedSet(req.user.id, wanted);
  if (wanted.some((id) => !linked.has(id))) return res.status(403).json({ error: "You can only plan for your own students." });

  const classId = req.body.classId === undefined ? plan.classId : req.body.classId || null;
  if (classId && !(await ownClass(req.user.id, classId))) return res.status(404).json({ error: "That class isn't one of yours." });

  // Someone who already has the month stays in the list: taking them off wouldn't take it away from them.
  const published = (await prisma.practiceMonth.findMany({ where: { planId: plan.id }, select: { studentId: true } })).map((m) => m.studentId);
  await prisma.$transaction([
    prisma.monthPlanStudent.deleteMany({ where: { planId: plan.id, studentId: { notIn: [...wanted, ...published] } } }),
    prisma.monthPlanStudent.createMany({ data: wanted.map((studentId) => ({ planId: plan.id, studentId })), skipDuplicates: true }),
    prisma.monthPlan.update({ where: { id: plan.id }, data: { classId } }),
  ]);
  res.json({ plan: await planPayload(await ownPlan(req, plan.id)) });
});

router.put("/plans/:id/students/:studentId", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  if (plan.archivedAt) return res.status(409).json({ error: "Restore this before changing it." });
  const key = { planId_studentId: { planId: plan.id, studentId: req.params.studentId } };
  const seat = await prisma.monthPlanStudent.findUnique({ where: key });
  if (!seat) return res.status(404).json({ error: "That student isn't on this plan." });
  if (await prisma.practiceMonth.findFirst({ where: { planId: plan.id, studentId: seat.studentId }, select: { id: true } })) {
    return res.status(409).json({ error: "This student already has the month. Change it on their month instead." });
  }
  const overrides = plans.cleanOverrides(req.body?.overrides, plan.tasks);
  if (overrides.error) return res.status(400).json({ error: overrides.error });
  await prisma.monthPlanStudent.update({ where: key, data: { overrides: overrides.value } });
  res.json({ plan: await planPayload(await ownPlan(req, plan.id)) });
});

// What one student would see. Nothing is created, so looking can't mark, count or send anything.
router.get("/plans/:id/preview", async (req, res) => {
  const plan = await ownPlan(req, req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found." });
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
  const seat = studentId ? plan.students.find((s) => s.studentId === studentId) : null;
  if (studentId && !seat) return res.status(404).json({ error: "That student isn't on this plan." });

  const startsOn = plan.startsOn ?? today();
  const overrides = seat?.overrides ?? {};
  const song = plan.song ? { id: plan.song.id, title: plan.song.title, artist: plan.song.artist } : null;
  const teacher = { id: req.user.id, name: req.user.name };
  const month = { id: "preview", startsOn, weekTitles: plan.weekTitles };
  const assignments = plans.forStudent(plan.tasks, overrides).map((task) => {
    const { planTaskId, ...fields } = plans.assignmentData(task, startsOn);
    return {
      id: `preview-${task.id}`,
      taskId: task.id,
      status: "assigned",
      ...fields,
      levelName: LEVEL_NAMES[task.level - 1] ?? null,
      instrument: seat ? canonicalInstrument(seat.student.instrument) : plan.instrument,
      song,
      lesson: null,
      teacher,
      month,
      submissions: [],
      attempts: 0,
      createdAt: new Date(0).toISOString(),
      // What's different from the plan, for the teacher's eye only.
      changedFor: Object.keys(overrides[task.id] ?? {}),
    };
  });
  const left = plan.tasks.filter((t) => overrides[t.id]?.skip).map((t) => ({ taskId: t.id, label: plans.taskLabel(t), week: t.week, kind: t.kind }));

  res.json({
    preview: {
      name: plan.name,
      startsOn,
      assumedStart: !plan.startsOn,
      weekTitles: plan.weekTitles,
      song,
      student: seat ? { id: seat.student.id, name: seat.student.name, instrument: canonicalInstrument(seat.student.instrument) } : null,
      canFilm: seat ? await canFilm(seat.student) : true,
      assignments,
      leftOut: left,
    },
  });
});

// ---------------------------------------------------------------------------------------------
// Publishing, and changing what has been published.

// Publishes to the students named in the request, which is the list the teacher has just confirmed.
router.post("/plans/:id/publish", async (req, res) => {
  const plan = await ownPlan(req, req.params.id);
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  if (plan.archivedAt) return res.status(409).json({ error: "Restore this before publishing it." });

  const requested = Array.isArray(req.body?.studentIds) ? [...new Set(req.body.studentIds)] : [];
  if (!requested.length) return res.status(400).json({ error: "Choose who to publish this to." });

  const { problems } = plans.checkPlan(plan, { today: today(), song: plan.song });
  if (problems.length) return res.status(400).json({ error: "This plan isn't ready to publish yet.", problems });

  const seats = new Map(plan.students.map((s) => [s.studentId, s]));
  const [linked, already] = await Promise.all([linkedSet(req.user.id, requested), prisma.practiceMonth.findMany({ where: { planId: plan.id }, select: { studentId: true } })]);
  const has = new Set(already.map((m) => m.studentId));

  const recipients = [];
  for (const id of requested) {
    const seat = seats.get(id);
    if (!seat) return res.status(400).json({ error: "Everyone you publish to has to be on the plan first." });
    if (!linked.has(id)) return res.status(403).json({ error: `${seat.student.name || "That student"} isn't linked to you any more.` });
    if (has.has(id)) return res.status(409).json({ error: `${seat.student.name || "That student"} already has this month.` });
    const instrument = canonicalInstrument(seat.student.instrument);
    if (!instrument) return res.status(400).json({ error: `${seat.student.name || "That student"} has no instrument set yet. Ask the school to set it first.` });
    const tasks = plans.forStudent(plan.tasks, seat.overrides);
    if (!tasks.length) return res.status(400).json({ error: `Every task is left out for ${seat.student.name || "that student"}.` });
    recipients.push({ student: seat.student, instrument, tasks });
  }

  let published;
  try {
    published = await prisma.$transaction(async (tx) => {
      const version = await snapshot(tx, plan, req.user.id);
      if (!plan.publishedAt) await tx.monthPlan.update({ where: { id: plan.id }, data: { publishedAt: clock.now() } });
      const made = [];
      for (const { student, instrument, tasks } of recipients) {
        const month = await tx.practiceMonth.create({ data: { teacherId: req.user.id, studentId: student.id, songId: plan.songId, startsOn: plan.startsOn, weekTitles: plan.weekTitles, planId: plan.id, planVersion: version } });
        await tx.assignment.createMany({
          data: tasks.map((task) => ({ ...plans.assignmentData(task, plan.startsOn), teacherId: req.user.id, studentId: student.id, songId: plan.songId, instrument, monthId: month.id })),
        });
        made.push({ studentId: student.id, name: student.name, monthId: month.id });
      }
      return made;
    }, LONG_WRITE);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That was just published." });
    throw err;
  }

  await audit(req.user, "plan.publish", "plan", plan.id, { name: plan.name, students: published.map((p) => p.studentId) });
  res.status(201).json({ published, plan: await planPayload(await ownPlan(req, plan.id)) });
});

// Exactly what applying the plan as it stands would do, student by student.
router.get("/plans/:id/impact", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  res.json({ impact: presentImpact(await impactOf(plan)) });
});

// Applies the plan's changes to the students the teacher ticked. If anything has moved since they looked
// (a student sent a take, say) nothing happens and they're shown the new picture.
router.post("/plans/:id/apply", async (req, res) => {
  const plan = await ownPlan(req, req.params.id);
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  if (plan.archivedAt) return res.status(409).json({ error: "Restore this before changing it." });
  const wanted = Array.isArray(req.body?.studentIds) ? new Set(req.body.studentIds) : null;
  if (!wanted?.size) return res.status(400).json({ error: "Choose who these changes are for." });

  const { problems } = plans.checkPlan(plan, { today: today(), song: plan.song });
  if (problems.length) return res.status(400).json({ error: "Finish the plan before applying it.", problems });

  const impact = await impactOf(plan);
  if (req.body?.basis !== impact.basis) {
    return res.status(409).json({ error: "Something has changed since you reviewed this. Check it again, then apply.", impact: presentImpact(impact) });
  }
  const chosen = impact.affected.filter((s) => wanted.has(s.studentId));
  if (!chosen.length) return res.status(400).json({ error: "None of those students have anything to change." });

  const version = await prisma.$transaction(async (tx) => {
    const latest = await snapshot(tx, plan, req.user.id);
    for (const s of chosen) {
      await tx.practiceMonth.update({ where: { id: s.monthId }, data: { ...s.monthUpdates, planVersion: latest } });
      for (const change of s.changes) {
        if (change.fields.length) await tx.assignment.update({ where: { id: change.assignmentId }, data: { ...change.updates, status: change.statusAfter } });
      }
      for (const { assignmentId, position } of s.positions) await tx.assignment.update({ where: { id: assignmentId }, data: { position } });
      if (s.adds.length && s.instrument) {
        await tx.assignment.createMany({ data: s.adds.map((a) => ({ ...a.data, teacherId: plan.teacherId, studentId: s.studentId, songId: plan.songId, instrument: s.instrument, monthId: s.monthId })) });
      }
      // Asked of the database as well as the impact: a take that arrives at the last moment still saves its task.
      if (s.removes.length) await tx.assignment.deleteMany({ where: { id: { in: s.removes.map((r) => r.assignmentId) }, submissions: { none: {} } } });
    }
    return latest;
  }, LONG_WRITE);

  await deleteAssignmentRecordings(chosen.flatMap((s) => s.removes.map((r) => r.assignmentId)));
  await audit(req.user, "plan.apply", "plan", plan.id, { version, students: chosen.map((s) => s.studentId), tasks: chosen.reduce((n, s) => n + s.changeCount, 0) });
  res.json({ applied: chosen.map((s) => s.studentId), version, plan: await planPayload(await ownPlan(req, plan.id)) });
});

// Goes back to what's been published, throwing away changes that haven't been applied.
router.post("/plans/:id/discard", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  if (!plan.version) return res.status(409).json({ error: "This hasn't been published, so there's nothing to go back to." });
  const latest = await versionOf(plan.id, plan.version);
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { startsOn: latest.startsOn, weekTitles: latest.weekTitles, tasks: latest.tasks, revision: { increment: 1 } } });
  res.json({ plan: await planPayload(await ownPlan(req, plan.id)) });
});

// ---------------------------------------------------------------------------------------------
// Templates.

// Keeps a plan as a reusable template. New task ids: it's a new thing, and the plan carries on as it was.
router.post("/plans/:id/template", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  const name = cleanText(req.body?.name, plans.MAX_NAME);
  if (name.error || !name.value) return res.status(400).json({ error: `Give the template a name of up to ${plans.MAX_NAME} characters.` });
  const details = plans.parseDocument({ instrument: req.body?.instrument ?? plan.instrument, level: req.body?.level ?? plan.level }, plan);
  if (details.error) return res.status(400).json({ error: details.error });
  const tasks = plans.cleanTasks(plan.tasks.map(({ id, ...task }) => task));
  if (tasks.error) return res.status(400).json({ error: tasks.error });

  const template = await prisma.$transaction(async (tx) => {
    const made = await tx.monthPlan.create({ data: { kind: "template", teacherId: req.user.id, name: name.value, ...details.data, songId: plan.songId, weekTitles: plan.weekTitles, tasks: tasks.value } });
    await snapshot(tx, made, req.user.id);
    return tx.monthPlan.findUnique({ where: { id: made.id }, include: PLAN_INCLUDE });
  });
  await audit(req.user, "template.create", "plan", template.id, { name: template.name, from: plan.id });
  res.status(201).json({ plan: await planPayload(template) });
});

// What a newer version of this plan's template would change in the plan.
async function templateMerge(plan) {
  const template = plan.templateId ? await prisma.monthPlan.findUnique({ where: { id: plan.templateId } }) : null;
  if (!template) return null;
  const base = await versionOf(template.id, plan.templateVersion);
  if (!base) return null;
  return { template, ...plans.mergeTemplate({ base, target: template, plan }) };
}

router.get("/plans/:id/template-changes", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  const merge = await templateMerge(plan);
  if (!merge) return res.status(404).json({ error: "This plan didn't come from a template that's still there." });
  res.json({ from: plan.templateVersion, to: merge.template.version, report: merge.report, changesAnything: merge.changesAnything });
});

// Brings them into the plan, and nothing further. A plan that's been published still needs its changes
// reviewed and applied before any student has them.
router.post("/plans/:id/template-changes", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan || plan.kind !== "plan") return res.status(404).json({ error: "Not found." });
  if (plan.archivedAt) return res.status(409).json({ error: "Restore this before changing it." });
  const merge = await templateMerge(plan);
  if (!merge) return res.status(404).json({ error: "This plan didn't come from a template that's still there." });
  if (Number(req.body?.version) !== merge.template.version) return res.status(409).json({ error: "The template has changed again. Check what's new, then bring it in." });
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { weekTitles: merge.weekTitles, tasks: merge.tasks, templateVersion: merge.template.version, revision: { increment: 1 } } });
  await audit(req.user, "plan.template-update", "plan", plan.id, { template: merge.template.id, from: plan.templateVersion, to: merge.template.version });
  res.json({ plan: await planPayload(await ownPlan(req, plan.id)) });
});

// ---------------------------------------------------------------------------------------------
// Archiving. Nothing is deleted, and published months carry on unaffected.

router.post("/plans/:id/archive", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan) return res.status(404).json({ error: "Not found." });
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { archivedAt: plan.archivedAt ?? clock.now() } });
  await audit(req.user, "plan.archive", "plan", plan.id, { name: plan.name, kind: plan.kind });
  res.json({ plan: await planPayload(await ownPlan(req, plan.id)) });
});

router.post("/plans/:id/restore", async (req, res) => {
  const plan = await ownPlan(req, req.params.id, {});
  if (!plan) return res.status(404).json({ error: "Not found." });
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { archivedAt: null } });
  await audit(req.user, "plan.restore", "plan", plan.id, { name: plan.name, kind: plan.kind });
  res.json({ plan: await planPayload(await ownPlan(req, plan.id)) });
});

module.exports = router;
