const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

// Every wording override, as one { key: value } map. The frontend fetches this
// once per page build and falls back to the text in its own code for any key
// that is absent.
router.get("/site-text", async (req, res) => {
  const rows = await prisma.siteText.findMany();
  res.json({ text: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

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

// The two public forms take whatever anyone posts, so every field is coerced to
// a trimmed string and capped before it reaches the database. A non-string
// (an object, an array) becomes absent rather than being stored as "[object
// Object]". Caps match the maxLength the forms already set.
function clean(value, max) {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v ? v.slice(0, max) : undefined;
}

// Loose: something@something.something. The frontend checks the same thing.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/trial", async (req, res) => {
  const b = req.body || {};
  const studentName = clean(b.studentName, 120);
  const email = clean(b.email, 254);
  if (!studentName || !email) {
    return res.status(400).json({ error: "Student name and email are required." });
  }
  if (!EMAIL.test(email)) {
    return res.status(400).json({ error: "That email address doesn’t look complete." });
  }
  const trial = await prisma.trialRequest.create({
    data: {
      studentName,
      email,
      age: clean(b.age, 20),
      guardian: clean(b.guardian, 120),
      phone: clean(b.phone, 40),
      instrument: clean(b.instrument, 40),
      format: clean(b.format, 120),
      experience: clean(b.experience, 40),
      availability: clean(b.availability, 500),
      favorites: clean(b.favorites, 500),
      goals: clean(b.goals, 2000),
      notes: clean(b.notes, 2000),
    },
  });
  res.status(201).json({ trial: { id: trial.id } });
});

router.post("/contact", async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 120);
  const email = clean(b.email, 254);
  const message = clean(b.message, 5000);
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  if (!EMAIL.test(email)) {
    return res.status(400).json({ error: "That email address doesn’t look complete." });
  }
  const contactMessage = await prisma.contactMessage.create({
    data: {
      name,
      email,
      message,
      phone: clean(b.phone, 40),
      reason: clean(b.reason, 60),
      age: clean(b.age, 20),
      instrument: clean(b.instrument, 40),
      prefer: clean(b.prefer, 60),
    },
  });
  res.status(201).json({ message: { id: contactMessage.id } });
});

module.exports = router;
