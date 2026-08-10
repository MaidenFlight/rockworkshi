const express = require("express");
const prisma = require("../lib/prisma");
const { requireAdmin } = require("../middleware/auth");
const { validateSlot } = require("../lib/lessonVideos");

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
  const { passwordHash, ...safe } = user;
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

router.get("/students", async (req, res) => {
  const search = (req.query.search || "").trim().toLowerCase();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  const filtered = search
    ? users.filter(
        (u) => u.email.toLowerCase().includes(search) || (u.name || "").toLowerCase().includes(search)
      )
    : users;
  res.json({ students: filtered.map(toSafeUser) });
});

router.patch("/students/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status is required." });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  res.json({ student: toSafeUser(user) });
});

router.delete("/students/:id", async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
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

// ---------- Trial requests ----------

const TRIAL_STATUS_CYCLE = ["New", "Contacted", "Trial Scheduled", "Enrolled", "Closed"];

router.get("/trials", async (req, res) => {
  const trials = await prisma.trialRequest.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ trials });
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
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ messages });
});

// ---------- Generic content CRUD (teachers, faqs, songs, onstage, lessons) ----------

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
  // Videos are no longer columns here — they hang off Lesson as LessonVideo
  // rows, one per instrument, and are managed by their own endpoints below.
  ["order", "title", "artist", "key", "difficulty", "estTime", "levels", "published"],
  { orderBy: { order: "asc" } }
);

// ---------- Lesson videos ----------
//
// A video is addressed by its slot — (lesson, instrument, level, kind) — not by
// a row id, because that is how the person filling the library thinks: "the
// guitar level 1 lesson video for Riptide". So there is one write endpoint that
// upserts, rather than a create and an update the caller has to choose between,
// and clearing the id deletes the row instead of leaving an empty one that
// reads as recorded.

router.get("/lessons/:lessonId/videos", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
  if (!lesson) return res.status(404).json({ error: "Not found." });
  const videos = await prisma.lessonVideo.findMany({
    where: { lessonId: lesson.id },
    orderBy: [{ level: "asc" }, { instrument: "asc" }, { kind: "asc" }],
  });
  res.json({ videos });
});

router.put("/lessons/:lessonId/videos", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
  if (!lesson) return res.status(404).json({ error: "Not found." });

  const { error, slot } = validateSlot(req.body);
  if (error) return res.status(400).json({ error });

  // provider is an ordinary column; the slot that identifies the row is the
  // other three plus the lesson.
  const { provider, ...key } = slot;
  const identity = { lessonId: lesson.id, ...key };

  const videoId = (req.body.videoId || "").trim();
  if (!videoId) {
    // deleteMany, not delete, so clearing an already-empty slot is a no-op
    // rather than a 500 — the editor sends every slot it has on screen.
    await prisma.lessonVideo.deleteMany({ where: identity });
    return res.json({ video: null });
  }

  const published = req.body.published === undefined ? true : !!req.body.published;
  const video = await prisma.lessonVideo.upsert({
    where: { lessonId_instrument_level_kind: identity },
    create: { ...identity, provider, videoId, published },
    update: { provider, videoId, published },
  });
  res.json({ video });
});

// ---------- Pages / Resources / Media (draft-editor pattern) ----------

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
