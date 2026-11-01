const express = require("express");
const prisma = require("../lib/prisma");
const clock = require("../lib/clock");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { isStaff, grantOpenSlots } = require("../lib/termAccess");
const { fromLocal } = require("../lib/honolulu");
const {
  MONTHS,
  SLOT_INCLUDE,
  validateGroup,
  defaultUnlock,
  slotWarnings,
  presentStaffGroup,
  presentStudentTerm,
} = require("../lib/terms");

// ---------- Student: GET /term ----------
// requireAuth rather than requirePaid, so a lapsed member gets an honest answer instead of a 402.
const student = express.Router();

student.get("/", requireAuth, async (req, res) => {
  const now = clock.now();
  const paid = Boolean(req.user.paidAt) || isStaff(req.user);
  const groups = await prisma.termGroup.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: { slots: { include: SLOT_INCLUDE } },
  });
  if (!paid) {
    // No song details for a lapsed membership, just enough to say which term it was.
    const hadPayments = await prisma.payment.count({ where: { userId: req.user.id } });
    const term = presentStudentTerm(groups, now);
    return res.json({
      membership: hadPayments ? "expired" : "none",
      term: term.group ? { state: term.state, group: term.group } : { state: "none" },
    });
  }
  res.json({ membership: "active", term: presentStudentTerm(groups, now), now });
});

// ---------- Staff: /admin/terms ----------
const admin = express.Router();
admin.use(requireAdmin);

const GROUP_INCLUDE = {
  slots: { include: SLOT_INCLUDE },
  members: { include: { user: { select: { id: true, name: true, email: true, instrument: true, paidAt: true } } } },
};

async function findGroup(id) {
  return prisma.termGroup.findUnique({ where: { id }, include: GROUP_INCLUDE });
}

admin.get("/", async (req, res) => {
  const groups = await prisma.termGroup.findMany({
    orderBy: { startsAt: "desc" },
    include: { slots: { include: SLOT_INCLUDE }, _count: { select: { members: true } } },
  });
  res.json({ groups: groups.map(presentStaffGroup) });
});

// Creates the group with its three months in draft: no songs, nothing published.
admin.post("/", async (req, res) => {
  const { error, data } = validateGroup(req.body);
  if (error) return res.status(400).json({ error });
  const group = await prisma.termGroup.create({
    data: {
      ...data,
      slots: { create: MONTHS.map((month) => ({ month, unlockAt: defaultUnlock(req.body.startDate, month) })) },
    },
  });
  res.status(201).json({ group: presentStaffGroup(await findGroup(group.id)) });
});

admin.get("/:id", async (req, res) => {
  const group = await findGroup(req.params.id);
  if (!group) return res.status(404).json({ error: "Not found." });
  res.json({ group: presentStaffGroup(group) });
});

// Changing the dates doesn't move unlock dates: those are set per month, on purpose.
admin.put("/:id", async (req, res) => {
  const { error, data } = validateGroup(req.body);
  if (error) return res.status(400).json({ error });
  if (!(await prisma.termGroup.findUnique({ where: { id: req.params.id } }))) return res.status(404).json({ error: "Not found." });
  await prisma.termGroup.update({ where: { id: req.params.id }, data });
  res.json({ group: presentStaffGroup(await findGroup(req.params.id)) });
});

admin.delete("/:id", async (req, res) => {
  // Students keep songs that already opened for them (TermGrant), even once the term is gone.
  await grantOpenSlots({ groupId: req.params.id });
  const { count } = await prisma.termGroup.deleteMany({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: "Not found." });
  res.status(204).end();
});

// Body (all optional): unlockAtLocal "YYYY-MM-DDTHH:mm" Honolulu, songId (or null),
// lessonId (or null), published. Publishing needs a song that's visible in the library.
admin.put("/:id/slots/:month", async (req, res) => {
  const month = Number(req.params.month);
  if (!MONTHS.includes(month)) return res.status(404).json({ error: "Not found." });
  const group = await prisma.termGroup.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Not found." });
  const slot = await prisma.termSlot.findUnique({ where: { groupId_month: { groupId: group.id, month } } });

  const body = req.body || {};
  const data = {};
  if (body.unlockAtLocal !== undefined) {
    const unlockAt = fromLocal(body.unlockAtLocal);
    if (!unlockAt) return res.status(400).json({ error: "Unlock date must look like 2026-11-01T00:00 (Honolulu time)." });
    data.unlockAt = unlockAt;
  }
  for (const [field, model] of [
    ["songId", prisma.song],
    ["lessonId", prisma.lesson],
  ]) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") data[field] = null;
    else if (typeof body[field] !== "string" || !(await model.findUnique({ where: { id: body[field] } }))) {
      return res.status(400).json({ error: `That ${field === "songId" ? "song" : "lesson"} doesn't exist.` });
    } else data[field] = body[field];
  }
  if (body.published !== undefined) {
    if (typeof body.published !== "boolean") return res.status(400).json({ error: "published must be true or false." });
    data.published = body.published;
    if (body.published && !slot.published) data.publishedAt = clock.now();
  }

  // Check what the slot would look like before saving a publication.
  if ((data.published ?? slot.published) === true) {
    const songId = data.songId !== undefined ? data.songId : slot.songId;
    const lessonId = data.lessonId !== undefined ? data.lessonId : slot.lessonId;
    const preview = {
      unlockAt: data.unlockAt || slot.unlockAt,
      song: songId ? await prisma.song.findUnique({ where: { id: songId }, include: { _count: { select: { tracks: true } } } }) : null,
      lesson: lessonId ? await prisma.lesson.findUnique({ where: { id: lessonId } }) : null,
    };
    const warnings = slotWarnings(preview, group);
    const blocking = warnings.filter((w) => w.blocking);
    if (blocking.length) {
      return res.status(400).json({ error: `Can't publish month ${month}: ${blocking.map((w) => w.text).join(" ")}`, warnings });
    }
  }

  // Students keep this month's song if it was already open for them, whatever changes here.
  await grantOpenSlots({ groupId: group.id, month });
  await prisma.termSlot.update({ where: { id: slot.id }, data });
  res.json({ group: presentStaffGroup(await findGroup(group.id)) });
});

// The explicit setup action: put the existing "Have You Ever Seen the Rain" (Creedence
// Clearwater Revival) into month 1, found by lookup rather than a hard-coded id. Leaves it
// in draft; publishing is a separate step.
admin.post("/:id/setup-first-song", async (req, res) => {
  const group = await prisma.termGroup.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: "Not found." });
  const matches = await prisma.song.findMany({
    where: {
      title: { equals: "Have You Ever Seen the Rain", mode: "insensitive" },
      artist: { contains: "Creedence", mode: "insensitive" },
    },
    include: { _count: { select: { tracks: true } } },
  });
  // Duplicates without stems are seed leftovers; prefer the one with stems.
  const withStems = matches.filter((s) => s._count.tracks > 0);
  const candidates = withStems.length ? withStems : matches;
  if (candidates.length !== 1) {
    return res.status(409).json({
      error: candidates.length
        ? "More than one copy of that song exists. Pick it for month 1 by hand."
        : "Couldn't find “Have You Ever Seen the Rain” by Creedence Clearwater Revival in the song library.",
    });
  }
  await prisma.termSlot.update({
    where: { groupId_month: { groupId: group.id, month: 1 } },
    data: { songId: candidates[0].id },
  });
  res.json({ group: presentStaffGroup(await findGroup(group.id)) });
});

// Enrolment is a staff action only. Billing never calls this.
admin.post("/:id/members", async (req, res) => {
  const ids = req.body?.userIds;
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string")) {
    return res.status(400).json({ error: "userIds must be a list of student ids." });
  }
  if (!(await prisma.termGroup.findUnique({ where: { id: req.params.id } }))) return res.status(404).json({ error: "Not found." });
  const found = await prisma.user.count({ where: { id: { in: ids } } });
  if (found !== new Set(ids).size) return res.status(400).json({ error: "Some of those students don't exist." });
  await prisma.termEnrollment.createMany({
    data: ids.map((userId) => ({ userId, groupId: req.params.id })),
    skipDuplicates: true,
  });
  res.json({ group: presentStaffGroup(await findGroup(req.params.id)) });
});

admin.delete("/:id/members/:userId", async (req, res) => {
  // Leaving a term doesn't take away songs the student already reached in it.
  await grantOpenSlots({ groupId: req.params.id, userIds: [req.params.userId] });
  await prisma.termEnrollment.deleteMany({ where: { groupId: req.params.id, userId: req.params.userId } });
  res.status(204).end();
});

module.exports = { student, admin };
