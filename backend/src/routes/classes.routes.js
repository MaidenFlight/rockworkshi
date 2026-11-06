// Classes and the calendar. Teachers schedule their own classes and take attendance; only an
// admin enrols students (decided 2026-11-05). Everyone sees their own calendar: what they teach,
// what they're enrolled in, and, for a guardian, what their children are enrolled in.
const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireTeacher, requireAdmin } = require("../middleware/auth");
const { audit } = require("../lib/audit");
const { REAL, isDemo } = require("../lib/demoRules");
const { isTeacher, isGuardian } = require("../lib/roles");
const { toInstant, isDateString } = require("../lib/zoned");
const {
  ATTENDANCE,
  validateClass,
  checkSchedule,
  sessionTimes,
  findConflicts,
  regenerate,
  fillPlaces,
  presentClass,
} = require("../lib/classes");

const MAX_RANGE_DAYS = 120;
const TIMING = ["timeZone", "firstDate", "startMinute", "durationMinutes", "repeat", "repeatUntil"];
const PERSON = { id: true, name: true, instrument: true, level: true };

const teacher = express.Router();
teacher.use(requireTeacher);

// A class this teacher teaches. Anything else is a 404, so nobody learns what exists.
async function ownClass(req, id, include = {}) {
  const cls = await prisma.class.findUnique({ where: { id }, include });
  return cls && cls.teacherId === req.user.id ? cls : null;
}

async function ownOccurrence(req, id) {
  const o = await prisma.classOccurrence.findUnique({ where: { id }, include: { class: true } });
  return o && o.class.teacherId === req.user.id ? o : null;
}

async function songExists(songId) {
  return !songId || Boolean(await prisma.song.findUnique({ where: { id: songId }, select: { id: true } }));
}

function presentOccurrence(o) {
  return { id: o.id, startsAt: o.startsAt, endsAt: o.endsAt, status: o.status, moved: Boolean(o.movedFrom), notes: o.notes ?? null };
}

teacher.get("/classes", async (req, res) => {
  const now = new Date();
  const classes = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    include: {
      song: { select: { id: true, title: true } },
      occurrences: { where: { startsAt: { gte: now }, status: "scheduled" }, orderBy: { startsAt: "asc" }, take: 1 },
      _count: { select: { enrolments: { where: { status: "enrolled" } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const waiting = await prisma.classEnrollment.groupBy({
    by: ["classId"],
    where: { classId: { in: classes.map((c) => c.id) }, status: "waitlisted" },
    _count: { _all: true },
  });
  res.json({
    classes: classes.map((c) => ({
      ...presentClass(c),
      next: c.occurrences[0] ? presentOccurrence(c.occurrences[0]) : null,
      enrolled: c._count.enrolments,
      waitlisted: waiting.find((w) => w.classId === c.id)?._count._all ?? 0,
    })),
  });
});

teacher.post("/classes", async (req, res) => {
  const { data, error } = validateClass(req.body || {});
  if (error) return res.status(400).json({ error });
  const problem = checkSchedule(data);
  if (problem) return res.status(400).json({ error: problem });
  if (!(await songExists(data.songId))) return res.status(400).json({ error: "That song doesn't exist." });

  const times = sessionTimes(data).filter((t) => t.endsAt > new Date());
  if (!times.length) return res.status(400).json({ error: "Every session of this class is in the past." });
  const conflicts = await findConflicts(req.user.id, times);
  if (conflicts.length && req.body.allowConflicts !== true) {
    return res.status(409).json({ error: "This clashes with classes you already teach.", conflicts });
  }

  const cls = await prisma.$transaction(async (tx) => {
    const created = await tx.class.create({ data: { ...data, teacherId: req.user.id } });
    await tx.classOccurrence.createMany({ data: times.map((t) => ({ classId: created.id, startsAt: t.startsAt, endsAt: t.endsAt })) });
    return created;
  });
  res.status(201).json({ class: presentClass(cls), sessions: times.length, conflicts });
});

teacher.get("/classes/:id", async (req, res) => {
  const cls = await ownClass(req, req.params.id, {
    song: { select: { id: true, title: true } },
    occurrences: { orderBy: { startsAt: "asc" }, include: { attendance: true } },
    enrolments: { orderBy: { createdAt: "asc" }, include: { user: { select: PERSON } } },
  });
  if (!cls) return res.status(404).json({ error: "Not found." });
  res.json({
    class: presentClass(cls),
    occurrences: cls.occurrences.map((o) => ({
      ...presentOccurrence(o),
      attendance: Object.fromEntries(o.attendance.map((a) => [a.userId, a.status])),
    })),
    roster: cls.enrolments.map((e) => ({ ...e.user, status: e.status, since: e.createdAt })),
  });
});

teacher.patch("/classes/:id", async (req, res) => {
  const cls = await ownClass(req, req.params.id);
  if (!cls) return res.status(404).json({ error: "Not found." });
  const { data, error } = validateClass(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });
  const merged = { ...cls, ...data };
  const problem = checkSchedule(merged);
  if (problem) return res.status(400).json({ error: problem });
  if (!(await songExists(data.songId))) return res.status(400).json({ error: "That song doesn't exist." });

  const retimed = TIMING.some((k) => k in data && data[k] !== cls[k]);
  if (retimed) {
    const times = sessionTimes(merged).filter((t) => t.startsAt >= new Date());
    const conflicts = await findConflicts(req.user.id, times, { exceptClassId: cls.id });
    if (conflicts.length && req.body.allowConflicts !== true) {
      return res.status(409).json({ error: "The new time clashes with classes you already teach.", conflicts });
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.class.update({ where: { id: cls.id }, data });
    if (retimed) await regenerate(tx, saved);
    // A bigger class has room for people waiting.
    if ("capacity" in data) await fillPlaces(tx, cls.id);
    return saved;
  });
  res.json({ class: presentClass(updated) });
});

// A copy to schedule again: same details, a new first date, nobody enrolled.
teacher.post("/classes/:id/duplicate", async (req, res) => {
  const cls = await ownClass(req, req.params.id);
  if (!cls) return res.status(404).json({ error: "Not found." });
  const { id, createdAt, updatedAt, status, ...copy } = cls;
  const firstDate = req.body?.firstDate ?? cls.firstDate;
  const { data, error } = validateClass({ ...copy, title: `${cls.title} (copy)`, firstDate, repeatUntil: req.body?.repeatUntil ?? cls.repeatUntil });
  if (error) return res.status(400).json({ error });
  const problem = checkSchedule(data);
  if (problem) return res.status(400).json({ error: problem });
  const times = sessionTimes(data).filter((t) => t.endsAt > new Date());
  const created = await prisma.$transaction(async (tx) => {
    const made = await tx.class.create({ data: { ...data, teacherId: req.user.id } });
    if (times.length) await tx.classOccurrence.createMany({ data: times.map((t) => ({ classId: made.id, startsAt: t.startsAt, endsAt: t.endsAt })) });
    return made;
  });
  res.status(201).json({ class: presentClass(created), sessions: times.length });
});

// Calls off the whole class from now on. Past sessions and their attendance stay.
teacher.post("/classes/:id/cancel", async (req, res) => {
  const cls = await ownClass(req, req.params.id);
  if (!cls) return res.status(404).json({ error: "Not found." });
  await prisma.$transaction([
    prisma.class.update({ where: { id: cls.id }, data: { status: "cancelled" } }),
    prisma.classOccurrence.updateMany({ where: { classId: cls.id, startsAt: { gte: new Date() } }, data: { status: "cancelled" } }),
  ]);
  res.json({ ok: true });
});

teacher.post("/occurrences/:id/cancel", async (req, res) => {
  const o = await ownOccurrence(req, req.params.id);
  if (!o) return res.status(404).json({ error: "Not found." });
  const saved = await prisma.classOccurrence.update({ where: { id: o.id }, data: { status: "cancelled" } });
  res.json({ occurrence: presentOccurrence(saved) });
});

teacher.post("/occurrences/:id/restore", async (req, res) => {
  const o = await ownOccurrence(req, req.params.id);
  if (!o) return res.status(404).json({ error: "Not found." });
  const conflicts = await findConflicts(req.user.id, [o], { exceptOccurrenceId: o.id });
  if (conflicts.length && req.body?.allowConflicts !== true) return res.status(409).json({ error: "Something else is now booked at this time.", conflicts });
  const saved = await prisma.classOccurrence.update({ where: { id: o.id }, data: { status: "scheduled" } });
  res.json({ occurrence: presentOccurrence(saved) });
});

// Moves one session. The time is given as a local date and minute in the class's time zone.
teacher.post("/occurrences/:id/move", async (req, res) => {
  const o = await ownOccurrence(req, req.params.id);
  if (!o) return res.status(404).json({ error: "Not found." });
  const { date, startMinute } = req.body || {};
  if (!isDateString(date) || !(Number.isInteger(startMinute) && startMinute >= 0 && startMinute < 1440)) {
    return res.status(400).json({ error: "Give the new date as YYYY-MM-DD and the time as minutes after midnight." });
  }
  const startsAt = toInstant(date, startMinute, o.class.timeZone);
  const endsAt = new Date(startsAt.getTime() + (o.endsAt - o.startsAt));
  if (endsAt <= new Date()) return res.status(400).json({ error: "That time has already passed." });
  const conflicts = await findConflicts(req.user.id, [{ startsAt, endsAt }], { exceptOccurrenceId: o.id });
  if (conflicts.length && req.body.allowConflicts !== true) return res.status(409).json({ error: "That clashes with another class.", conflicts });
  const saved = await prisma.classOccurrence.update({
    where: { id: o.id },
    data: { startsAt, endsAt, status: "scheduled", movedFrom: o.movedFrom ?? o.startsAt },
  });
  res.json({ occurrence: presentOccurrence(saved) });
});

// Attendance for students enrolled in the class. A teacher's entry always wins over any
// provider's automatic one.
teacher.put("/occurrences/:id/attendance", async (req, res) => {
  const o = await ownOccurrence(req, req.params.id);
  if (!o) return res.status(404).json({ error: "Not found." });
  const entries = req.body?.entries;
  if (!Array.isArray(entries) || entries.some((e) => typeof e?.userId !== "string" || !ATTENDANCE.includes(e.status))) {
    return res.status(400).json({ error: `entries must be a list of { userId, status } with status one of: ${ATTENDANCE.join(", ")}.` });
  }
  const enrolled = new Set(
    (await prisma.classEnrollment.findMany({ where: { classId: o.classId, status: "enrolled" }, select: { userId: true } })).map((e) => e.userId)
  );
  if (entries.some((e) => !enrolled.has(e.userId))) return res.status(400).json({ error: "Attendance is only for students enrolled in this class." });
  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendance.upsert({
        where: { occurrenceId_userId: { occurrenceId: o.id, userId: e.userId } },
        create: { occurrenceId: o.id, userId: e.userId, status: e.status, source: "teacher" },
        update: { status: e.status, source: "teacher" },
      })
    )
  );
  res.json({ ok: true });
});

teacher.put("/occurrences/:id/notes", async (req, res) => {
  const o = await ownOccurrence(req, req.params.id);
  if (!o) return res.status(404).json({ error: "Not found." });
  const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 5000) : null;
  await prisma.classOccurrence.update({ where: { id: o.id }, data: { notes: notes || null } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------
// Admin: every class, rosters, enrolment and waitlists.

const admin = express.Router();
admin.use(requireAdmin);

admin.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const classes = await prisma.class.findMany({
    // Not the student demo's made-up classes (lib/demo.js). A class whose teacher has gone stays listed.
    where: { ...(search ? { title: { contains: search, mode: "insensitive" } } : {}), OR: [{ teacherId: null }, { teacher: REAL }] },
    include: { teacher: { select: { id: true, name: true } }, _count: { select: { enrolments: { where: { status: "enrolled" } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  res.json({ classes: classes.map((c) => ({ ...presentClass(c), enrolled: c._count.enrolments })) });
});

admin.get("/:id", async (req, res) => {
  const cls = await prisma.class.findUnique({
    where: { id: req.params.id },
    include: {
      teacher: { select: { id: true, name: true } },
      enrolments: { orderBy: { createdAt: "asc" }, include: { user: { select: { ...PERSON, email: true } } } },
      occurrences: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 5 },
    },
  });
  if (!cls) return res.status(404).json({ error: "Not found." });
  res.json({
    class: presentClass(cls),
    roster: cls.enrolments.map((e) => ({ ...e.user, status: e.status, since: e.createdAt })),
    upcoming: cls.occurrences.map(presentOccurrence),
  });
});

admin.post("/:id/enrolments", async (req, res) => {
  const userId = req.body?.userId;
  if (typeof userId !== "string") return res.status(400).json({ error: "userId is required." });
  const [cls, student] = await Promise.all([
    prisma.class.findUnique({ where: { id: req.params.id } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!cls) return res.status(404).json({ error: "Not found." });
  if (!student || isDemo(student)) return res.status(404).json({ error: "Student not found." });
  if (cls.status !== "active") return res.status(400).json({ error: "This class has been cancelled." });
  if (cls.teacherId === userId) return res.status(400).json({ error: "The teacher can't enrol in their own class." });
  if (student.role === "guardian") return res.status(400).json({ error: "Only students can be enrolled." });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.classEnrollment.findUnique({ where: { classId_userId: { classId: cls.id, userId } } });
    if (existing) return existing;
    const enrolled = await tx.classEnrollment.count({ where: { classId: cls.id, status: "enrolled" } });
    const status = cls.capacity != null && enrolled >= cls.capacity ? "waitlisted" : "enrolled";
    return tx.classEnrollment.create({ data: { classId: cls.id, userId, status } });
  });
  await audit(req.user, "class.enrol", "class", cls.id, { userId, status: result.status });
  res.status(201).json({ status: result.status });
});

admin.delete("/:id/enrolments/:userId", async (req, res) => {
  const where = { classId_userId: { classId: req.params.id, userId: req.params.userId } };
  const existing = await prisma.classEnrollment.findUnique({ where });
  if (!existing) return res.status(404).json({ error: "Not found." });
  const promoted = await prisma.$transaction(async (tx) => {
    await tx.classEnrollment.delete({ where });
    return fillPlaces(tx, req.params.id);
  });
  await audit(req.user, "class.unenrol", "class", req.params.id, { userId: req.params.userId, promoted });
  res.json({ promoted });
});

// ---------------------------------------------------------------------------------------------
// Everyone's calendar: what they teach, what they're enrolled in, and their children's classes.

const calendar = express.Router();
calendar.use(requireAuth);

calendar.get("/", async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to - from > MAX_RANGE_DAYS * 86400000) {
    return res.status(400).json({ error: `Give from and to as dates, at most ${MAX_RANGE_DAYS} days apart.` });
  }
  const user = req.user;
  const children = isGuardian(user)
    ? (await prisma.guardianLink.findMany({ where: { guardianId: user.id, acceptedAt: { not: null } }, include: { student: { select: { id: true, name: true } } } })).map((l) => l.student)
    : [];
  const learnerIds = [user.id, ...children.map((c) => c.id)];
  const enrolments = await prisma.classEnrollment.findMany({ where: { userId: { in: learnerIds } } });

  const occurrences = await prisma.classOccurrence.findMany({
    where: {
      startsAt: { lt: to },
      endsAt: { gt: from },
      class: {
        OR: [
          ...(isTeacher(user) ? [{ teacherId: user.id }] : []),
          { id: { in: enrolments.map((e) => e.classId) } },
        ],
      },
    },
    include: {
      class: { include: { teacher: { select: { id: true, name: true } }, song: { select: { id: true, title: true } } } },
      attendance: { where: { userId: { in: learnerIds } } },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
  });

  res.json({
    events: occurrences.flatMap((o) => {
      const teaching = o.class.teacherId === user.id;
      const mine = enrolments.filter((e) => e.classId === o.classId);
      const base = {
        id: o.id,
        classId: o.classId,
        title: o.class.title,
        kind: o.class.kind,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        status: o.status,
        moved: Boolean(o.movedFrom),
        timeZone: o.class.timeZone,
        teacher: o.class.teacher,
        song: o.class.song,
      };
      const out = [];
      if (teaching) out.push({ ...base, as: "teaching", meetingUrl: o.class.meetingUrl });
      for (const e of mine) {
        const child = children.find((c) => c.id === e.userId);
        out.push({
          ...base,
          as: child ? "child" : "learning",
          child: child || undefined,
          enrolment: e.status,
          // Only people with a place get the link; someone waiting doesn't.
          meetingUrl: e.status === "enrolled" ? o.class.meetingUrl : null,
          attendance: o.attendance.find((a) => a.userId === e.userId)?.status ?? null,
        });
      }
      return out;
    }),
  });
});

module.exports = { teacher, admin, calendar };
