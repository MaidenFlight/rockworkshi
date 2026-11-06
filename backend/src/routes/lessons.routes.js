const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { presentLesson } = require("../lib/lessonVideos");
const { loadAccess, denialMessage } = require("../lib/termAccess");
const { scopeFor, canonicalInstrument } = require("../lib/instrumentAccess");

const router = express.Router();
router.use(requirePaid);

// Whose videos to show. A student always gets their own instrument's, whatever the request says
// (none at all without a valid one). Staff see their own by default and may preview any other
// with ?instrument=.
function videoInstrument(req) {
  const scope = scopeFor(req.user);
  if (!scope.staff) return scope.instrument;
  return canonicalInstrument(req.query.instrument) || scope.instrument;
}

router.get("/", async (req, res) => {
  const lessons = await prisma.lesson.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    include: { videos: true },
  });
  const access = await loadAccess(req.user);
  const instrument = videoInstrument(req);
  // Locked term lessons stay in the list (titles aren't secret) but without their content.
  res.json({
    lessons: lessons.map((l) => {
      const a = access.lesson(l.id);
      if (a.allowed) return presentLesson(l, instrument);
      const { videos, levels, ...rest } = l;
      return { ...rest, locked: true, lockedReason: a.reason, videoUrl: null, playthroughVideoUrl: null };
    }),
  });
});

router.get("/:id", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.id },
    include: { videos: true },
  });
  if (!lesson || !lesson.published) return res.status(404).json({ error: "Not found." });
  const access = (await loadAccess(req.user)).lesson(lesson.id);
  if (!access.allowed) {
    return res.status(403).json({ error: denialMessage(access.reason, "lesson"), reason: access.reason });
  }
  res.json({ lesson: presentLesson(lesson, videoInstrument(req)) });
});

module.exports = router;
