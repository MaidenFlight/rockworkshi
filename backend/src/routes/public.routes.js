const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

router.get("/teachers", async (req, res) => {
  const teachers = await prisma.teacher.findMany({ where: { published: true }, orderBy: { order: "asc" } });
  res.json({ teachers });
});

router.get("/faqs", async (req, res) => {
  const faqs = await prisma.faq.findMany({ where: { published: true }, orderBy: { order: "asc" } });
  res.json({ faqs });
});

router.get("/songs", async (req, res) => {
  const songs = await prisma.song.findMany({ where: { published: true }, orderBy: { order: "asc" } });
  res.json({ songs });
});

router.get("/onstage", async (req, res) => {
  const posts = await prisma.onStagePost.findMany({ where: { published: true }, orderBy: { order: "asc" } });
  res.json({ posts });
});

router.post("/trial", async (req, res) => {
  const { studentName, email } = req.body;
  if (!studentName || !email) {
    return res.status(400).json({ error: "Student name and email are required." });
  }
  const trial = await prisma.trialRequest.create({
    data: {
      studentName,
      email,
      age: req.body.age,
      guardian: req.body.guardian,
      phone: req.body.phone,
      instrument: req.body.instrument,
      format: req.body.format,
      experience: req.body.experience,
      availability: req.body.availability,
      favorites: req.body.favorites,
      goals: req.body.goals,
      notes: req.body.notes,
    },
  });
  res.status(201).json({ trial });
});

router.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  const contactMessage = await prisma.contactMessage.create({
    data: {
      name,
      email,
      message,
      phone: req.body.phone,
      reason: req.body.reason,
      age: req.body.age,
      instrument: req.body.instrument,
      prefer: req.body.prefer,
    },
  });
  res.status(201).json({ message: contactMessage });
});

module.exports = router;
