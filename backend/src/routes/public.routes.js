const express = require("express");
const rateLimit = require("express-rate-limit").default;
const prisma = require("../lib/prisma");
const { trialRequestEmails } = require("../lib/mailer");
const { refuseDemo } = require("../lib/demoRules");

const router = express.Router();

// Each trial request sends an email to the address typed in, so one connection can't send a stream.
const trialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from here. Try again in a few minutes." },
});

// Admin wording overrides as { key: value }.
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
  const songs = await prisma.song.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    include: { _count: { select: { tracks: true } } },
  });
  // hasTracks only says a play-along exists; the tracks and chord chart are members-only.
  res.json({ songs: songs.map(({ _count, chart, ...song }) => ({ ...song, hasTracks: _count.tracks > 0 })) });
});

router.get("/onstage", async (req, res) => {
  const posts = await prisma.onStagePost.findMany({ where: { published: true }, orderBy: { order: "asc" } });
  res.json({ posts });
});

// Trim and cap public form input. Non-strings are dropped.
function clean(value, max) {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v ? v.slice(0, max) : undefined;
}


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Someone looking around the student demo books nothing and messages no one (lib/demo.js).
router.post("/trial", refuseDemo("school"), trialLimiter, async (req, res) => {
  const b = req.body || {};
  // The form has a field people never see. Anything in it came from a bot: thank it and keep nothing.
  if (clean(b.website, 200)) return res.status(201).json({ trial: {} });
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
  // Sent in the background: the request is saved and listed in Admin either way.
  trialRequestEmails(trial).catch((err) => console.error("Could not send trial request emails:", err.message));
});

router.post("/contact", refuseDemo("school"), async (req, res) => {
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
