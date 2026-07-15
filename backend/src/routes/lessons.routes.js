const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const lessons = await prisma.lesson.findMany({ where: { published: true }, orderBy: { order: "asc" } });
  res.json({ lessons });
});

router.get("/:id", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
  if (!lesson || !lesson.published) return res.status(404).json({ error: "Not found." });
  res.json({ lesson });
});

module.exports = router;
