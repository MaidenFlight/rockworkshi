const express = require("express");
const prisma = require("../lib/prisma");
const { findPage } = require("../lib/pagination");
const { requireAdmin } = require("../middleware/auth");
const { validateSlot, INSTRUMENTS } = require("../lib/lessonVideos");
const { ROLES, deleteAssignmentRecordings } = require("../lib/assignments");
const { canonicalInstrument } = require("../lib/instrumentAccess");

const { audit } = require("../lib/audit");
const router = express.Router();
router.use(requireAdmin);

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function toSafeUser(user) {
  const { passwordHash, verificationTokenHash, resetTokenHash, ...safe } = user;
  return safe;
}

// ---------- Students ----------

const STUDENT_CSV_COLUMNS = [
  "name",
  "email",
  "phone",
  "age",
  "isMinor",
  "sponsorName",
  "sponsorEmail",
  "instrument",
  "experience",
  "level",
  "instructionType",
  "plan",
  "status",
  "createdAt",
];

// The numbers on the admin home page, counted here because the lists themselves are paged.
router.get("/overview", async (req, res) => {
  const [students, newTrials, messages, lessons, instruments] = await Promise.all([
    prisma.user.count(),
    prisma.trialRequest.count({ where: { status: "New" } }),
    prisma.contactMessage.count(),
    prisma.lesson.count(),
    prisma.user.groupBy({ by: ["instrument"], _count: { _all: true } }),
  ]);

  const counts = {};
  for (const row of instruments) {
    const name = row.instrument || "Unspecified";
    counts[name] = (counts[name] || 0) + row._count._all;
  }
  const breakdown = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / (students || 1)) * 100) }));

  res.json({ students, newTrials, messages, lessons, breakdown });
});

router.get("/students", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const { items, pagination } = await findPage(prisma.user, { where, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }, req.query);
  res.json({ students: items.map(toSafeUser), pagination });
});

// The instrument a student studies decides which part of every song they get (lib/instrumentAccess.js),
// so after signup only the school changes it. Their saved mixers were for the old instrument: resume
// states lose theirs here, and presets are ignored for as long as they don't match (mixerFits).
router.put("/students/:id/instrument", async (req, res) => {
  const value = req.body?.instrument;
  const instrument = value === null || value === "" ? null : canonicalInstrument(value);
  if (instrument === null && value !== null && value !== "") {
    return res.status(400).json({ error: `instrument must be one of: ${INSTRUMENTS.join(", ")}, or empty.` });
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, instrument: true } });
  if (!user) return res.status(404).json({ error: "Not found." });

  const sessions = await prisma.songPractice.findMany({ where: { userId: user.id }, select: { songId: true, session: true } });
  const withMixer = sessions.filter((p) => p.session?.mixer);
  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { instrument } }),
    ...withMixer.map(({ songId, session: { mixer, ...rest } }) =>
      prisma.songPractice.update({ where: { userId_songId: { userId: user.id, songId } }, data: { session: rest } })
    ),
  ]);
  await audit(req.user, "instrument.set", "user", user.id, { from: user.instrument, to: instrument });
  res.json({ student: toSafeUser(updated) });
});

router.patch("/students/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status is required." });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  res.json({ student: toSafeUser(user) });
});

router.delete("/students/:id", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't remove your own account." });
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!user) return res.status(404).json({ error: "Not found." });
  // A student's work goes with them (cascade), recordings included. Work a teacher set
  // stays with the students who did it, with no teacher attached.
  const assignments = await prisma.assignment.findMany({ where: { studentId: user.id }, select: { id: true } });
  await prisma.user.delete({ where: { id: user.id } });
  await deleteAssignmentRecordings(assignments.map((a) => a.id));
  res.status(204).end();
});

router.get("/students/export.csv", async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  const rows = [STUDENT_CSV_COLUMNS.join(",")];
  for (const u of users) {
    rows.push(
      STUDENT_CSV_COLUMNS.map((c) => {
        const v = u[c];
        const s = v === null || v === undefined ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(",")
    );
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=students.csv");
  res.send(rows.join("\n"));
});

// ---------- Teaching: teacher accounts and their students ----------

const PERSON = { id: true, name: true, email: true, instrument: true, role: true };

router.get("/teaching", async (req, res) => {
  const [teachers, people] = await Promise.all([
    prisma.user.findMany({
      where: { role: "teacher" },
      orderBy: { name: "asc" },
      select: { ...PERSON, myStudents: { select: { student: { select: PERSON } } } },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: PERSON }),
  ]);
  res.json({
    teachers: teachers.map(({ myStudents, ...t }) => ({ ...t, students: myStudents.map((l) => l.student) })),
    people,
  });
});

router.patch("/students/:id/role", async (req, res) => {
  const { role } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(", ")}.` });

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Not found." });

  // Someone who stops teaching loses their students. Their assignments stay as history.
  // The teacher role in UserRole follows, so both ways of granting it agree.
  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role } }),
    ...(role === "teacher"
      ? [prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: "teacher" } }, create: { userId: user.id, role: "teacher", grantedBy: req.user.id }, update: {} })]
      : [prisma.teacherStudent.deleteMany({ where: { teacherId: user.id } }), prisma.userRole.deleteMany({ where: { userId: user.id, role: "teacher" } })]),
  ]);
  await audit(req.user, "role.set", "user", user.id, { role });
  res.json({ student: toSafeUser(updated) });
});

router.post("/teaching/links", async (req, res) => {
  const { teacherId, studentId } = req.body || {};
  if (typeof teacherId !== "string" || typeof studentId !== "string") {
    return res.status(400).json({ error: "teacherId and studentId are required." });
  }
  if (teacherId === studentId) return res.status(400).json({ error: "A teacher can't be their own student." });

  const [teacher, student] = await Promise.all([
    prisma.user.findUnique({ where: { id: teacherId } }),
    prisma.user.findUnique({ where: { id: studentId } }),
  ]);
  if (!teacher || teacher.role !== "teacher") return res.status(400).json({ error: "That account isn't a teacher." });
  if (!student) return res.status(404).json({ error: "Student not found." });

  await prisma.teacherStudent.upsert({
    where: { teacherId_studentId: { teacherId, studentId } },
    create: { teacherId, studentId },
    update: {},
  });
  res.status(201).json({ ok: true });
});

router.delete("/teaching/links/:teacherId/:studentId", async (req, res) => {
  const { teacherId, studentId } = req.params;
  await prisma.teacherStudent.deleteMany({ where: { teacherId, studentId } });
  res.status(204).end();
});

// ---------- Trial requests ----------

const TRIAL_STATUS_CYCLE = ["New", "Contacted", "Trial Scheduled", "Enrolled", "Closed"];

router.get("/trials", async (req, res) => {
  const { items, pagination } = await findPage(prisma.trialRequest, { orderBy: [{ createdAt: "desc" }, { id: "asc" }] }, req.query);
  res.json({ trials: items, pagination });
});

router.post("/trials/:id/cycle-status", async (req, res) => {
  const trial = await prisma.trialRequest.findUnique({ where: { id: req.params.id } });
  if (!trial) return res.status(404).json({ error: "Not found." });
  const idx = TRIAL_STATUS_CYCLE.indexOf(trial.status);
  const next = TRIAL_STATUS_CYCLE[(idx + 1) % TRIAL_STATUS_CYCLE.length];
  const updated = await prisma.trialRequest.update({ where: { id: trial.id }, data: { status: next } });
  res.json({ trial: updated });
});

// ---------- Contact messages ----------

router.get("/messages", async (req, res) => {
  const { items, pagination } = await findPage(prisma.contactMessage, { orderBy: [{ createdAt: "desc" }, { id: "asc" }] }, req.query);
  res.json({ messages: items, pagination });
});

// ---------- Site text ----------

// Keys match the <T k="..."> markers in the frontend, e.g. "format.hero.title".
const SITE_TEXT_KEY = /^[a-z0-9][a-z0-9._-]{0,119}$/i;
const SITE_TEXT_MAX = 5000;

router.put("/site-text/:key", async (req, res) => {
  const { key } = req.params;
  const value = typeof req.body?.value === "string" ? req.body.value : null;
  if (!SITE_TEXT_KEY.test(key)) return res.status(400).json({ error: "That text has no valid name." });
  if (value === null || !value.trim()) return res.status(400).json({ error: "Text can't be empty." });
  if (value.length > SITE_TEXT_MAX) return res.status(400).json({ error: "That text is too long." });
  const row = await prisma.siteText.upsert({ where: { key }, create: { key, value }, update: { value } });
  res.json({ key: row.key, value: row.value });
});

router.delete("/site-text/:key", async (req, res) => {
  await prisma.siteText.deleteMany({ where: { key: req.params.key } });
  res.status(204).end();
});

// ---------- Content CRUD ----------

function contentCrud(path, model, fields, { orderBy = { order: "asc" } } = {}) {
  router.get(`/${path}`, async (req, res) => {
    const items = await model.findMany({ orderBy });
    res.json({ [path]: items });
  });

  router.post(`/${path}`, async (req, res) => {
    const item = await model.create({ data: pick(req.body, fields) });
    res.status(201).json({ item });
  });

  router.put(`/${path}/:id`, async (req, res) => {
    const item = await model.update({ where: { id: req.params.id }, data: pick(req.body, fields) });
    res.json({ item });
  });

  router.delete(`/${path}/:id`, async (req, res) => {
    await model.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });
}

contentCrud("teachers", prisma.teacher, ["name", "bio", "instruments", "photoUrl", "published", "order"]);
contentCrud("faqs", prisma.faq, ["question", "answer", "published", "order"]);
contentCrud("songs", prisma.song, ["title", "artist", "level", "instrument", "notes", "published", "order"]);
contentCrud("onstage", prisma.onStagePost, ["title", "description", "mediaUrl", "date", "published", "order"], {
  orderBy: { order: "asc" },
});
contentCrud(
  "lessons",
  prisma.lesson,
  // videos are managed separately, see below
  ["order", "title", "artist", "key", "difficulty", "estTime", "levels", "published"],
  { orderBy: { order: "asc" } }
);

// ---------- Lesson and song videos ----------
// Videos are addressed by slot (lesson or song, instrument, level, kind). PUT upserts;
// an empty videoId deletes the slot. A song's videos are its tutorials on the song page.

function videoSlots(path, model, ownerKey) {
  router.get(`/${path}/:ownerId/videos`, async (req, res) => {
    const owner = await model.findUnique({ where: { id: req.params.ownerId } });
    if (!owner) return res.status(404).json({ error: "Not found." });
    const videos = await prisma.lessonVideo.findMany({
      where: { [ownerKey]: owner.id },
      orderBy: [{ level: "asc" }, { instrument: "asc" }, { kind: "asc" }],
    });
    res.json({ videos });
  });

  router.put(`/${path}/:ownerId/videos`, async (req, res) => {
    const owner = await model.findUnique({ where: { id: req.params.ownerId } });
    if (!owner) return res.status(404).json({ error: "Not found." });

    const { error, slot } = validateSlot(req.body);
    if (error) return res.status(400).json({ error });

    const { provider, ...key } = slot;
    const identity = { [ownerKey]: owner.id, ...key };

    const videoId = (req.body.videoId || "").trim();
    if (!videoId) {
      // deleteMany so clearing an empty slot doesn't throw
      await prisma.lessonVideo.deleteMany({ where: identity });
      return res.json({ video: null });
    }

    // A new slot is published unless told otherwise; changing an existing slot's id leaves its
    // published state alone, so a draft stays hidden from students until it's published on purpose.
    const published = req.body.published === undefined ? undefined : !!req.body.published;
    const video = await prisma.lessonVideo.upsert({
      where: { [`${ownerKey}_instrument_level_kind`]: identity },
      create: { ...identity, provider, videoId, published: published ?? true },
      update: { provider, videoId, ...(published === undefined ? {} : { published }) },
    });
    res.json({ video });
  });
}

videoSlots("lessons", prisma.lesson, "lessonId");
videoSlots("songs", prisma.song, "songId");

// ---------- Pages / Resources / Media ----------

contentCrud("pages", prisma.page, ["title", "slug", "nav", "status", "body"], { orderBy: { updatedAt: "desc" } });
contentCrud("resources", prisma.resource, ["name", "type", "url"], { orderBy: { updatedAt: "desc" } });
contentCrud("media", prisma.media, ["label", "kind", "url"], { orderBy: { updatedAt: "desc" } });

router.patch("/pages/:id/publish", async (req, res) => {
  const page = await prisma.page.findUnique({ where: { id: req.params.id } });
  if (!page) return res.status(404).json({ error: "Not found." });
  const status = page.status === "Published" ? "Draft" : "Published";
  const updated = await prisma.page.update({ where: { id: page.id }, data: { status } });
  res.json({ item: updated });
});

module.exports = router;
