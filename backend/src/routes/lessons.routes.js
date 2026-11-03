const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { presentLesson } = require("../lib/lessonVideos");
const { loadAccess, denialMessage } = require("../lib/termAccess");

const router = express.Router();
router.use(requirePaid);

router.get("/", async (req, res) => {
  const lessons = await prisma.lesson.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    include: { videos: true },
  });
  const access = await loadAccess(req.user);
  // Locked term lessons stay in the list (titles aren't secret) but without their content.
  res.json({
    lessons: lessons.map((l) => {
      const a = access.lesson(l.id);
      if (a.allowed) return presentLesson(l, req.user.instrument);
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
  res.json({ lesson: presentLesson(lesson, req.user.instrument) });
});

module.exports = router;
