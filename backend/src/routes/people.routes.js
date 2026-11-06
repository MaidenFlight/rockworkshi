// People: a student's own profile and consents, what a teacher can see about their students, roles
// and guardian invites for admins, and the family area for parents and guardians.
//
// Privacy rules enforced here (docs/platform-plan.md, section 8):
//   - every profile field is optional and set by the student;
//   - a minor's profile is stored only after a linked guardian consents ("profile");
//   - a minor's consents are given by their guardian, not by the minor;
//   - teachers see a profile only if the student allows it and the student is linked to them;
//   - guardians are linked only by an admin's invite to the address the school has on file.
const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit").default;
const prisma = require("../lib/prisma");
const { requireAuth, requireTeacher, requireAdmin, requireGuardian } = require("../middleware/auth");
const { REAL, refuseDemo } = require("../lib/demoRules");
const { audit } = require("../lib/audit");
const { GRANTABLE, rolesOf, setRoles } = require("../lib/roles");
const { createToken, hashToken } = require("../lib/emailTokens");
const { guardianInviteEmail } = require("../lib/mailer");
const { INSTRUMENTS } = require("../lib/lessonVideos");
const { canonicalInstrument } = require("../lib/instrumentAccess");
const { isTimeZone } = require("../lib/zoned");

const PURPOSES = ["profile", "share-practice", "band-matching"];
const AGE_BRACKETS = ["under-13", "13-17", "18+"];
const FORMATS = ["online", "in-person", "either"];
const GENRES = ["Rock", "Classic rock", "Pop", "Punk", "Metal", "Blues", "Jazz", "Funk", "Soul", "R&B", "Hip hop", "Reggae", "Hawaiian", "Country", "Folk", "Indie", "Electronic", "Other"];
const INVITE_DAYS = 7;

const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// The latest answer for each consent purpose, or null where none was ever given.
async function consentsFor(userId) {
  const rows = await prisma.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return Object.fromEntries(PURPOSES.map((p) => [p, rows.find((r) => r.purpose === p)?.granted ?? null]));
}

async function profileAllowed(user) {
  return !user.isMinor || (await consentsFor(user.id)).profile === true;
}

function validateProfile(body) {
  const p = body.profile || {};
  if (p.ageBracket != null && !AGE_BRACKETS.includes(p.ageBracket)) return { error: "Choose an age bracket from the list." };
  if (p.rehearsalFormat != null && !FORMATS.includes(p.rehearsalFormat)) return { error: "Choose online, in person or either." };
  if (p.visibility != null && !["teachers", "private"].includes(p.visibility)) return { error: "visibility is teachers or private." };
  if (p.genres != null && (!Array.isArray(p.genres) || p.genres.some((g) => !GENRES.includes(g)))) return { error: "Choose genres from the list." };
  const profile = {
    ageBracket: p.ageBracket ?? null,
    area: text(p.area, 80),
    goals: text(p.goals, 1000),
    rehearsalFormat: p.rehearsalFormat ?? null,
    genres: [...new Set(p.genres || [])],
    favouriteArtists: text(p.favouriteArtists, 500),
    learningPreferences: text(p.learningPreferences, 500),
    bandInterest: p.bandInterest === true,
    performInterest: p.performInterest === true,
    productionInterest: p.productionInterest === true,
    visibility: p.visibility ?? "teachers",
  };

  const list = body.instruments || [];
  if (!Array.isArray(list) || list.length > INSTRUMENTS.length || list.some((i) => !INSTRUMENTS.includes(i?.instrument))) {
    return { error: `Instruments must come from: ${INSTRUMENTS.join(", ")}.` };
  }
  const instruments = list.map((i) => ({ instrument: i.instrument, primary: i.primary === true, selfLevel: text(i.selfLevel, 40) }));
  if (new Set(instruments.map((i) => i.instrument)).size !== instruments.length) return { error: "Each instrument once, please." };

  const timeZone = body.timeZone ?? "Pacific/Honolulu";
  if (!isTimeZone(timeZone)) return { error: "That isn't a time zone." };
  const windows = body.availability || [];
  if (!Array.isArray(windows) || windows.length > 21) return { error: "At most 21 availability windows." };
  for (const w of windows) {
    const ok = Number.isInteger(w?.weekday) && w.weekday >= 0 && w.weekday <= 6 && Number.isInteger(w.startMinute) && Number.isInteger(w.endMinute) && w.startMinute >= 0 && w.endMinute <= 1440 && w.endMinute > w.startMinute;
    if (!ok) return { error: "Each availability window needs a day and a start before its end." };
  }
  return { profile, instruments, availability: windows.map((w) => ({ weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute, timeZone })) };
}

// ---------------------------------------------------------------------------------------------
// The signed-in student's own profile and consents.

const me = express.Router();
me.use(requireAuth);

me.get("/profile", async (req, res) => {
  const [profile, instruments, availability, consents] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: req.user.id } }),
    prisma.instrumentSkill.findMany({ where: { userId: req.user.id }, orderBy: [{ primary: "desc" }, { instrument: "asc" }] }),
    prisma.availability.findMany({ where: { userId: req.user.id }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    consentsFor(req.user.id),
  ]);
  const minor = Boolean(req.user.isMinor);
  res.json({
    profile,
    instruments,
    availability,
    consents,
    minor,
    canEdit: !minor || consents.profile === true,
    options: { ageBrackets: AGE_BRACKETS, formats: FORMATS, genres: GENRES, instruments: INSTRUMENTS, purposes: PURPOSES },
  });
});

me.put("/profile", async (req, res) => {
  if (!(await profileAllowed(req.user))) {
    return res.status(403).json({ error: "A parent or guardian needs to agree before we keep a profile for you." });
  }
  const parsed = validateProfile(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const userId = req.user.id;
  const assessed = await prisma.instrumentSkill.findMany({ where: { userId } });
  await prisma.$transaction([
    prisma.studentProfile.upsert({ where: { userId }, create: { userId, ...parsed.profile }, update: parsed.profile }),
    prisma.instrumentSkill.deleteMany({ where: { userId } }),
    // A teacher's assessment survives the student editing their own list.
    prisma.instrumentSkill.createMany({
      data: parsed.instruments.map((i) => {
        const before = assessed.find((a) => a.instrument === i.instrument);
        return { userId, ...i, teacherLevel: before?.teacherLevel ?? null, assessedBy: before?.assessedBy ?? null };
      }),
    }),
    prisma.availability.deleteMany({ where: { userId } }),
    prisma.availability.createMany({ data: parsed.availability.map((w) => ({ userId, ...w })) }),
  ]);
  res.json({ ok: true });
});

// Removes everything the student chose to share. Instruments go too, except a teacher's notes
// about them, which belong to the teacher.
me.delete("/profile", async (req, res) => {
  const userId = req.user.id;
  await prisma.$transaction([
    prisma.studentProfile.deleteMany({ where: { userId } }),
    prisma.availability.deleteMany({ where: { userId } }),
    prisma.instrumentSkill.updateMany({ where: { userId }, data: { selfLevel: null } }),
  ]);
  res.json({ ok: true });
});

// A student asks the school to change the instrument they study. Changing it is a staff action
// (PUT /admin/students/:id/instrument), so this only leaves a note in Admin → Messages. No email.
// The instruments listed in PUT /me/profile are the student's own description and never change it.
const INSTRUMENT_REQUEST = "Instrument change";
const REQUEST_GAP_MS = 10 * 60 * 1000;

me.post("/instrument-request", refuseDemo("school"), async (req, res) => {
  const wanted = canonicalInstrument(req.body?.instrument);
  if (!wanted) return res.status(400).json({ error: `Choose one of: ${INSTRUMENTS.join(", ")}.` });
  const current = canonicalInstrument(req.user.instrument);
  if (wanted === current) return res.status(400).json({ error: `${wanted} is already your instrument.` });
  const recent = await prisma.contactMessage.count({
    where: { email: req.user.email, reason: INSTRUMENT_REQUEST, createdAt: { gt: new Date(Date.now() - REQUEST_GAP_MS) } },
  });
  if (recent) return res.status(429).json({ error: "We've got your request. The school will be in touch." });
  const note = text(req.body?.note, 500);
  const name = req.user.name || req.user.email;
  await prisma.contactMessage.create({
    data: {
      name,
      email: req.user.email,
      phone: req.user.phone || null,
      reason: INSTRUMENT_REQUEST,
      instrument: wanted,
      message: `${name} asks to change their instrument from ${current || "none set"} to ${wanted}.${note ? `\n\n${note}` : ""}`,
    },
  });
  await audit(req.user, "instrument.request", "user", req.user.id, { from: current, to: wanted });
  res.status(201).json({ ok: true });
});

me.post("/consents", async (req, res) => {
  const { purpose, granted } = req.body || {};
  if (!PURPOSES.includes(purpose) || typeof granted !== "boolean") return res.status(400).json({ error: "purpose and granted are required." });
  if (req.user.isMinor) return res.status(403).json({ error: "Your parent or guardian gives this consent." });
  await prisma.consentRecord.create({ data: { userId: req.user.id, givenById: req.user.id, purpose, granted } });
  await audit(req.user, "consent", "user", req.user.id, { purpose, granted });
  res.status(201).json({ consents: await consentsFor(req.user.id) });
});

// ---------------------------------------------------------------------------------------------
// Teachers: one linked student in full, private notes, and an assessed level.

const teacher = express.Router();
teacher.use(requireTeacher);

async function linkFor(teacherId, studentId) {
  return prisma.teacherStudent.findUnique({ where: { teacherId_studentId: { teacherId, studentId } } });
}

teacher.get("/students/:id", async (req, res) => {
  const link = await linkFor(req.user.id, req.params.id);
  if (!link) return res.status(404).json({ error: "Not found." });
  const studentId = req.params.id;
  const [student, profile, instruments, availability, enrolments, assignments] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, instrument: true, level: true, isMinor: true } }),
    prisma.studentProfile.findUnique({ where: { userId: studentId } }),
    prisma.instrumentSkill.findMany({ where: { userId: studentId }, orderBy: [{ primary: "desc" }, { instrument: "asc" }] }),
    prisma.availability.findMany({ where: { userId: studentId }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    prisma.classEnrollment.findMany({
      where: { userId: studentId, class: { teacherId: req.user.id } },
      include: {
        class: {
          include: {
            occurrences: { where: { status: "scheduled" }, orderBy: { startsAt: "asc" }, include: { attendance: { where: { userId: studentId } } } },
          },
        },
      },
    }),
    prisma.assignment.groupBy({ by: ["status"], where: { teacherId: req.user.id, studentId }, _count: { _all: true } }),
  ]);
  const visible = profile?.visibility === "teachers";
  const now = new Date();
  res.json({
    student,
    // A student who keeps their profile private still shows the instruments the school knows.
    profile: visible ? profile : null,
    profileHidden: Boolean(profile) && !visible,
    instruments,
    availability: visible ? availability : [],
    notes: link.notes ?? "",
    classes: enrolments.map((e) => {
      const past = e.class.occurrences.filter((o) => o.startsAt < now);
      const marked = past.filter((o) => o.attendance.length);
      return {
        id: e.class.id,
        title: e.class.title,
        kind: e.class.kind,
        status: e.status,
        next: e.class.occurrences.find((o) => o.startsAt >= now)?.startsAt ?? null,
        // Missing data stays missing: sessions without attendance taken aren't counted as absences.
        attendance: {
          sessionsHeld: past.length,
          recorded: marked.length,
          present: marked.filter((o) => ["present", "late"].includes(o.attendance[0].status)).length,
        },
      };
    }),
    assignments: Object.fromEntries(assignments.map((a) => [a.status, a._count._all])),
  });
});

teacher.put("/students/:id/notes", async (req, res) => {
  const link = await linkFor(req.user.id, req.params.id);
  if (!link) return res.status(404).json({ error: "Not found." });
  const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 10000) : "";
  await prisma.teacherStudent.update({ where: { teacherId_studentId: { teacherId: req.user.id, studentId: req.params.id } }, data: { notes: notes || null } });
  res.json({ ok: true });
});

teacher.put("/students/:id/instruments/:instrument", async (req, res) => {
  const link = await linkFor(req.user.id, req.params.id);
  if (!link) return res.status(404).json({ error: "Not found." });
  if (!INSTRUMENTS.includes(req.params.instrument)) return res.status(400).json({ error: "Unknown instrument." });
  const teacherLevel = text(req.body?.teacherLevel, 40);
  const key = { userId_instrument: { userId: req.params.id, instrument: req.params.instrument } };
  await prisma.instrumentSkill.upsert({
    where: key,
    create: { userId: req.params.id, instrument: req.params.instrument, teacherLevel, assessedBy: req.user.id },
    update: { teacherLevel, assessedBy: req.user.id },
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------
// Admins: everyone and their roles, and guardian invites.

const admin = express.Router();
admin.use(requireAdmin);

admin.get("/people", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const role = typeof req.query.role === "string" ? req.query.role : "";
  const people = await prisma.user.findMany({
    where: { ...REAL, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}) },
    include: { roles: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  const listed = people
    .map((u) => ({ id: u.id, name: u.name, email: u.email, isMinor: u.isMinor, instrument: u.instrument, roles: rolesOf(u) }))
    .filter((u) => !role || u.roles.includes(role));
  res.json({ people: listed, grantable: GRANTABLE });
});

admin.put("/users/:id/roles", async (req, res) => {
  const roles = req.body?.roles;
  if (!Array.isArray(roles) || roles.some((r) => !GRANTABLE.includes(r))) {
    return res.status(400).json({ error: `roles must come from: ${GRANTABLE.join(", ")}.` });
  }
  if (req.params.id === req.user.id && !roles.includes("admin")) {
    return res.status(400).json({ error: "You can't remove your own admin role." });
  }
  const changed = await setRoles(req.params.id, roles, req.user.id);
  if (!changed) return res.status(404).json({ error: "Not found." });
  await audit(req.user, "roles.set", "user", req.params.id, changed);
  res.json({ roles: changed.after });
});

admin.get("/students/:id/guardians", async (req, res) => {
  const links = await prisma.guardianLink.findMany({
    where: { studentId: req.params.id },
    include: { guardian: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json({
    guardians: links.map((l) => ({
      id: l.id,
      email: l.email,
      relationship: l.relationship,
      guardian: l.guardian,
      accepted: Boolean(l.acceptedAt),
      expired: !l.acceptedAt && l.inviteExpiresAt < new Date(),
    })),
  });
});

// Invites a parent or guardian to the address on file (the sponsor email from signup) unless
// the admin gives another one.
admin.post("/students/:id/guardian-invite", async (req, res) => {
  const student = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!student) return res.status(404).json({ error: "Not found." });
  const email = (text(req.body?.email, 200) || student.sponsorEmail || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "There's no parent or guardian email on file. Enter one." });
  if (email === student.email) return res.status(400).json({ error: "That's the student's own address." });
  const relationship = ["parent", "guardian"].includes(req.body?.relationship) ? req.body.relationship : "parent";

  const { token, hash } = createToken();
  const link = await prisma.guardianLink.create({
    data: { studentId: student.id, email, relationship, invitedBy: req.user.id, inviteTokenHash: hash, inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 86400000) },
  });
  const origin = (req.headers.origin && /^https?:\/\//.test(req.headers.origin) ? req.headers.origin : process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  // Sent in the background: the invitation exists either way, and the admin can resend it.
  guardianInviteEmail({ to: email, studentName: student.name || "your student", link: `${origin}/family/accept?token=${token}` }).catch((err) =>
    console.error("Could not send guardian invite:", err.message)
  );
  await audit(req.user, "guardian.invite", "user", student.id, { email, linkId: link.id });
  res.status(201).json({ id: link.id, email });
});

admin.delete("/guardian-links/:id", async (req, res) => {
  const link = await prisma.guardianLink.findUnique({ where: { id: req.params.id } });
  if (!link) return res.status(404).json({ error: "Not found." });
  await prisma.guardianLink.delete({ where: { id: link.id } });
  await audit(req.user, "guardian.remove", "user", link.studentId, { email: link.email, guardianId: link.guardianId });
  res.json({ ok: true });
});

admin.get("/audit", async (req, res) => {
  const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ events });
});

// ---------------------------------------------------------------------------------------------
// Parents and guardians.

const family = express.Router();
const inviteLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

async function openInvite(token) {
  if (typeof token !== "string" || !token) return null;
  const link = await prisma.guardianLink.findUnique({ where: { inviteTokenHash: hashToken(token) }, include: { student: { select: { name: true } } } });
  return link && !link.acceptedAt && link.inviteExpiresAt > new Date() ? link : null;
}

// What the invite page shows before someone accepts: who it's for, and whether to sign in.
family.get("/invite", inviteLimit, async (req, res) => {
  const link = await openInvite(req.query.token);
  if (!link) return res.status(404).json({ error: "This invitation has expired or been used. Ask the school for a new one." });
  const exists = Boolean(await prisma.user.findUnique({ where: { email: link.email }, select: { id: true } }));
  res.json({ email: link.email, student: (link.student.name || "").split(" ")[0] || "your student", accountExists: exists });
});

// Accepting proves the guardian reads that inbox. Someone with an account signs in first; someone
// without one sets a password here, and their address counts as confirmed.
family.post("/accept", inviteLimit, async (req, res) => {
  const link = await openInvite(req.body?.token);
  if (!link) return res.status(404).json({ error: "This invitation has expired or been used. Ask the school for a new one." });

  let guardian = req.user;
  if (guardian) {
    if (guardian.email !== link.email) return res.status(403).json({ error: `This invitation is for ${link.email}. Sign in with that account.` });
  } else {
    if (await prisma.user.findUnique({ where: { email: link.email } })) {
      return res.status(409).json({ error: "You already have an account. Sign in, then open the invitation again." });
    }
    const name = text(req.body?.name, 120);
    const password = req.body?.password;
    if (!name) return res.status(400).json({ error: "Your name, please." });
    if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    guardian = await prisma.user.create({
      data: { email: link.email, name, passwordHash: await bcrypt.hash(password, 10), role: "guardian", emailVerifiedAt: new Date() },
    });
  }

  await prisma.$transaction([
    prisma.guardianLink.update({ where: { id: link.id }, data: { guardianId: guardian.id, acceptedAt: new Date(), inviteTokenHash: null } }),
    prisma.userRole.upsert({ where: { userId_role: { userId: guardian.id, role: "guardian" } }, create: { userId: guardian.id, role: "guardian", grantedBy: link.invitedBy }, update: {} }),
  ]);
  await audit(guardian, "guardian.accept", "user", link.studentId, { linkId: link.id });

  if (req.user) return res.json({ ok: true });
  const withRoles = await prisma.user.findUnique({ where: { id: guardian.id }, include: { roles: true } });
  req.login(withRoles, (err) => (err ? res.status(500).json({ error: "Accepted, but couldn't sign you in. Sign in to continue." }) : res.status(201).json({ ok: true })));
});

async function childOf(req, studentId) {
  const link = await prisma.guardianLink.findFirst({ where: { guardianId: req.user.id, studentId, acceptedAt: { not: null } } });
  return Boolean(link);
}

family.get("/children", requireGuardian, async (req, res) => {
  const links = await prisma.guardianLink.findMany({
    where: { guardianId: req.user.id, acceptedAt: { not: null } },
    include: { student: { select: { id: true, name: true, instrument: true, isMinor: true } } },
  });
  const children = await Promise.all(
    links.map(async ({ student }) => {
      const assignments = await prisma.assignment.findMany({
        where: { studentId: student.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          song: { select: { title: true } },
          lesson: { select: { title: true } },
          teacher: { select: { name: true } },
          submissions: { where: { feedback: { not: null } }, orderBy: { reviewedAt: "desc" }, take: 1, select: { feedback: true, reviewedAt: true } },
        },
      });
      return {
        ...student,
        consents: await consentsFor(student.id),
        assignments: assignments.map((a) => ({
          id: a.id,
          title: a.song?.title || a.lesson?.title || "Practice work",
          section: a.section,
          instruction: a.instruction,
          status: a.status,
          teacher: a.teacher?.name ?? null,
          updatedAt: a.updatedAt,
          feedback: a.submissions[0] ?? null,
        })),
      };
    })
  );
  res.json({ children, purposes: PURPOSES });
});

family.post("/children/:id/consents", requireGuardian, async (req, res) => {
  if (!(await childOf(req, req.params.id))) return res.status(404).json({ error: "Not found." });
  const { purpose, granted } = req.body || {};
  if (!PURPOSES.includes(purpose) || typeof granted !== "boolean") return res.status(400).json({ error: "purpose and granted are required." });
  await prisma.consentRecord.create({ data: { userId: req.params.id, givenById: req.user.id, purpose, granted } });
  // Withdrawing consent for a profile removes the profile itself, not just the permission.
  if (purpose === "profile" && !granted) {
    await prisma.$transaction([
      prisma.studentProfile.deleteMany({ where: { userId: req.params.id } }),
      prisma.availability.deleteMany({ where: { userId: req.params.id } }),
    ]);
  }
  await audit(req.user, "consent", "user", req.params.id, { purpose, granted });
  res.status(201).json({ consents: await consentsFor(req.params.id) });
});

module.exports = { me, teacher, admin, family, PURPOSES };
