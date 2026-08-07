const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { presentLesson } = require("../lib/lessonVideos");

const router = express.Router();
router.use(requirePaid);

router.get("/", async (req, res) => {
  const lessons = await prisma.lesson.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    include: { videos: true },
  });
  res.json({ lessons: lessons.map((l) => presentLesson(l, req.user.instrument)) });
});

router.get("/:id", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.id },
    include: { videos: true },
  });
  if (!lesson || !lesson.published) return res.status(404).json({ error: "Not found." });
  res.json({ lesson: presentLesson(lesson, req.user.instrument) });
});

module.exports = router;
