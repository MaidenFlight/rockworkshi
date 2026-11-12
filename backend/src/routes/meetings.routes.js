// Live meetings (admin: schedule, edit, cancel, start, end, host) and, for students and guardians,
// the meetings they're invited to and a pass into the room. Plus the notification inbox, its
// preferences and browser push subscriptions.
const crypto = require("node:crypto");
const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { audit } = require("../lib/audit");
const { REAL } = require("../lib/demoRules");
const { isAdmin, isGuardian } = require("../lib/roles");
const { fromLocal, toLocal } = require("../lib/honolulu");
const {
  validateMeeting,
  seriesStarts,
  resolveInvitees,
  setInvites,
  refreshClassInvites,
  joinRight,
  isLive,
  presentMeeting,
} = require("../lib/meetings");
const notify = require("../lib/notify");
const { roomPass, closeRoom } = require("../lib/liveRoom");

const NO_VIDEO = "Video for meetings isn't set up on the server yet (LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET).";
const PERSON = { id: true, name: true, email: true };

async function loadMeeting(req, res) {
  const meeting = await prisma.meeting.findUnique({ where: { id: String(req.params.id) } });
  if (!meeting) res.status(404).json({ error: "Meeting not found." });
  return meeting;
}

// The admin's view of one meeting: who's invited, and the class.
async function adminView(meeting) {
  const [invites, cls] = await Promise.all([
    prisma.meetingInvite.findMany({ where: { meetingId: meeting.id }, include: { user: { select: PERSON } }, orderBy: { user: { name: "asc" } } }),
    meeting.classId ? prisma.class.findUnique({ where: { id: meeting.classId }, select: { id: true, title: true } }) : null,
  ]);
  return {
    ...presentMeeting(meeting),
    class: cls,
    invited: invites.map((i) => ({ ...i.user, viaClass: i.viaClass })),
    studentIds: invites.filter((i) => !i.viaClass).map((i) => i.user.id),
  };
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------
const admin = express.Router();
admin.use(requireAdmin);

// Upcoming (and live) meetings first; ?scope=past for the ones that are over.
admin.get("/", async (req, res) => {
  const now = new Date();
  const past = req.query.scope === "past";
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const meetings = await prisma.meeting.findMany({
    where: past
      ? { OR: [{ status: { in: ["ended", "cancelled"] } }, { startsAt: { lt: dayAgo } }] }
      : { status: { in: ["scheduled", "live"] }, startsAt: { gte: dayAgo } },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 100,
    include: { _count: { select: { invites: true } } },
  });
  const classIds = [...new Set(meetings.map((m) => m.classId).filter(Boolean))];
  const classes = await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, title: true } });
  const classTitle = new Map(classes.map((c) => [c.id, c.title]));
  res.json({
    meetings: meetings
      .map((m) => ({ ...presentMeeting(m, now), invitedCount: m._count.invites, className: classTitle.get(m.classId) ?? null }))
      .filter((m) => (past ? true : m.status !== "ended")),
  });
});

// What the invite picker offers: active classes with their enrolled counts, and students.
admin.get("/options", async (req, res) => {
  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { status: "active" },
      orderBy: { title: "asc" },
      select: { id: true, title: true, _count: { select: { enrolments: { where: { status: "enrolled" } } } } },
    }),
    prisma.user.findMany({
      // Students only: staff accounts can carry the default role "student" too.
      where: { ...REAL, role: "student", roles: { none: { role: { in: ["admin", "teacher"] } } } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 1000,
      select: PERSON,
    }),
  ]);
  res.json({ classes: classes.map((c) => ({ id: c.id, title: c.title, enrolled: c._count.enrolments })), students });
});

// Schedule one date, or a monthly series (one row per date).
admin.post("/", async (req, res) => {
  const { data, error } = validateMeeting(req.body);
  if (error) return res.status(400).json({ error });
  const starts = seriesStarts(data.start, data.repeat, data.repeatUntil);
  if (starts[0] <= new Date()) return res.status(400).json({ error: "Pick a time in the future, or use Start now." });
  const resolved = await resolveInvitees(data);
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  const seriesId = starts.length > 1 ? crypto.randomUUID() : null;
  const meetings = await prisma.$transaction(async (tx) => {
    const made = [];
    for (const startsAt of starts) {
      const m = await tx.meeting.create({
        data: {
          seriesId,
          title: data.title,
          description: data.description,
          startsAt,
          durationMinutes: data.durationMinutes,
          classId: data.classId,
          createdById: req.user.id,
        },
      });
      await setInvites(tx, m.id, resolved.invitees);
      made.push(m);
    }
    return made;
  });
  await audit(req.user, "meeting.schedule", "Meeting", meetings[0].id, { dates: meetings.length, invited: resolved.invitees.length });
  await notify.notifyScheduled(meetings);
  notify.kick();
  res.status(201).json({ meetings: meetings.map((m) => presentMeeting(m)), invited: resolved.invitees.length });
});

// Start a meeting that wasn't scheduled: it's live as soon as it's made.
admin.post("/now", async (req, res) => {
  const now = new Date();
  const { data, error } = validateMeeting({ ...req.body, start: toLocal(now), repeat: "none" });
  if (error) return res.status(400).json({ error });
  const resolved = await resolveInvitees(data);
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  const meeting = await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.create({
      data: {
        title: data.title,
        description: data.description,
        startsAt: now,
        durationMinutes: data.durationMinutes,
        classId: data.classId,
        createdById: req.user.id,
        status: "live",
        startedAt: now,
      },
    });
    await setInvites(tx, m.id, resolved.invitees);
    return m;
  });
  await audit(req.user, "meeting.start", "Meeting", meeting.id, { unscheduled: true });
  await notify.notifyStarted(meeting);
  notify.kick();
  res.status(201).json({ meeting: presentMeeting(meeting) });
});

admin.get("/:id", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  res.json({ meeting: await adminView(meeting) });
});

// Edit one date, or (scope "series") this date and every later scheduled date in its series. For a
// series, a new time keeps each date and moves it to that time of day. Moving notifies; adding
// students sends the new ones their invitation.
admin.patch("/:id", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  if (!["scheduled", "live"].includes(meeting.status)) return res.status(409).json({ error: "This meeting is over, so it can't be changed." });
  const { data, error } = validateMeeting(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const series = req.body.scope === "series" && meeting.seriesId;
  const targets = series
    ? await prisma.meeting.findMany({ where: { seriesId: meeting.seriesId, status: "scheduled", startsAt: { gte: meeting.startsAt } }, orderBy: { startsAt: "asc" } })
    : [meeting];
  if (data.start && meeting.status === "live") return res.status(409).json({ error: "It's already started, so its time can't change." });

  let resolved = null;
  if (data.classId !== undefined || data.studentIds !== undefined) {
    const current = await prisma.meetingInvite.findMany({ where: { meetingId: meeting.id, viaClass: false }, select: { userId: true } });
    resolved = await resolveInvitees({
      classId: data.classId !== undefined ? data.classId : meeting.classId,
      studentIds: data.studentIds ?? current.map((c) => c.userId),
    });
    if (resolved.error) return res.status(400).json({ error: resolved.error });
  }
  const before = new Set((await prisma.meetingInvite.findMany({ where: { meetingId: meeting.id }, select: { userId: true } })).map((i) => i.userId));

  const now = new Date();
  const moved = [];
  const updated = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const t of targets) {
      const change = {};
      for (const k of ["title", "description", "durationMinutes"]) if (data[k] !== undefined) change[k] = data[k];
      if (resolved) change.classId = data.classId !== undefined ? data.classId : meeting.classId;
      if (data.start) {
        const start = t.id === meeting.id ? fromLocal(data.start) : fromLocal(`${toLocal(t.startsAt).slice(0, 10)}T${data.start.slice(11)}`);
        if (start.getTime() !== t.startsAt.getTime()) {
          if (start <= now) throw Object.assign(new Error("Pick a time in the future."), { status: 400 });
          change.startsAt = start;
          change.timeSetAt = now;
          moved.push({ id: t.id, previous: t.startsAt });
        }
      }
      const u = await tx.meeting.update({ where: { id: t.id }, data: change });
      if (resolved) await setInvites(tx, t.id, resolved.invitees);
      out.push(u);
    }
    return out;
  }).catch((err) => {
    if (err.status) return res.status(err.status).json({ error: err.message }), null;
    throw err;
  });
  if (!updated) return;

  await audit(req.user, "meeting.edit", "Meeting", meeting.id, { dates: updated.length, moved: moved.length, scope: series ? "series" : "one" });
  if (moved.length) {
    const first = updated.find((u) => u.id === moved[0].id);
    await notify.notifyRescheduled(first, moved[0].previous, { more: moved.length - 1 });
  }
  if (resolved) {
    const added = resolved.invitees.map((i) => i.userId).filter((id) => !before.has(id));
    if (added.length) await notify.notifyScheduled(updated, { onlyFor: new Set(added) });
  }
  notify.kick();
  res.json({ meeting: await adminView(updated.find((u) => u.id === meeting.id)), changed: updated.length });
});

// Cancel one date, or (scope "series") it and every later scheduled date in its series.
admin.post("/:id/cancel", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  if (meeting.status !== "scheduled") return res.status(409).json({ error: meeting.status === "cancelled" ? "It's already cancelled." : "Only a meeting that hasn't started can be cancelled. End it instead." });
  const series = req.body?.scope === "series" && meeting.seriesId;
  const where = series ? { seriesId: meeting.seriesId, status: "scheduled", startsAt: { gte: meeting.startsAt } } : { id: meeting.id };
  const count = (await prisma.meeting.updateMany({ where, data: { status: "cancelled" } })).count;
  await audit(req.user, "meeting.cancel", "Meeting", meeting.id, { dates: count });
  await notify.notifyCancelled({ ...meeting, status: "cancelled" }, { more: count - 1 });
  notify.kick();
  res.json({ cancelled: count });
});

// Go live now, early or on time. Students enrolled in the class since it was scheduled get in too.
admin.post("/:id/start", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  if (meeting.status === "live" && isLive(meeting)) return res.json({ meeting: presentMeeting(meeting) });
  if (meeting.status !== "scheduled") return res.status(409).json({ error: "This meeting is over or cancelled." });
  const now = new Date();
  const started = await prisma.$transaction(async (tx) => {
    await refreshClassInvites(tx, meeting);
    return tx.meeting.update({ where: { id: meeting.id }, data: { status: "live", startedAt: now } });
  });
  await audit(req.user, "meeting.start", "Meeting", meeting.id);
  await notify.notifyStarted(started);
  notify.kick();
  res.json({ meeting: presentMeeting(started) });
});

admin.post("/:id/end", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  if (meeting.status !== "live") return res.status(409).json({ error: "This meeting isn't running." });
  const ended = await prisma.meeting.update({ where: { id: meeting.id }, data: { status: "ended", endedAt: new Date() } });
  await closeRoom(meeting);
  await audit(req.user, "meeting.end", "Meeting", meeting.id);
  res.json({ meeting: presentMeeting(ended) });
});

// The host's pass into the room. The meeting has to be started first.
admin.post("/:id/pass", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  if (!isLive(meeting)) return res.status(409).json({ error: "Start the meeting first." });
  const pass = await roomPass(meeting, req.user, { host: true });
  if (!pass) return res.status(503).json({ error: NO_VIDEO });
  res.json(pass);
});

// ---------------------------------------------------------------------------------------------
// Students and guardians
// ---------------------------------------------------------------------------------------------
const member = express.Router();
member.use(requireAuth);

// Upcoming and live meetings for me (invited) and, for a guardian, for my children.
member.get("/", async (req, res) => {
  const now = new Date();
  const kids = isGuardian(req.user)
    ? await prisma.guardianLink.findMany({
        where: { guardianId: req.user.id, acceptedAt: { not: null } },
        select: { student: { select: { id: true, name: true } } },
      })
    : [];
  const ids = [req.user.id, ...kids.map((k) => k.student.id)];
  const invites = await prisma.meetingInvite.findMany({
    where: { userId: { in: ids }, meeting: { status: { in: ["scheduled", "live"] }, startsAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } },
    include: { meeting: true },
  });
  const byMeeting = new Map();
  for (const inv of invites) {
    const entry = byMeeting.get(inv.meetingId) ?? { meeting: inv.meeting, me: false, kids: [] };
    if (inv.userId === req.user.id) entry.me = true;
    else entry.kids.push(kids.find((k) => k.student.id === inv.userId)?.student.name || "Your child");
    byMeeting.set(inv.meetingId, entry);
  }
  const meetings = [...byMeeting.values()]
    .map(({ meeting, me, kids: names }) => {
      const view = presentMeeting(meeting, now);
      return { ...view, invited: me, forKids: names, canJoin: me && view.status === "live" };
    })
    .filter((m) => m.status !== "ended")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  res.json({ meetings, admin: isAdmin(req.user) });
});

// One meeting, for the room page: only if I'm invited (or I'm an admin).
member.get("/:id", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  const invited = await prisma.meetingInvite.findUnique({ where: { meetingId_userId: { meetingId: meeting.id, userId: req.user.id } } });
  if (!invited && !isAdmin(req.user)) return res.status(403).json({ error: "You're not invited to this meeting." });
  res.json({ meeting: presentMeeting(meeting), host: isAdmin(req.user) });
});

// A student's pass into the room: invited, and the meeting is live. Admins host from their own page.
member.post("/:id/pass", async (req, res) => {
  const meeting = await loadMeeting(req, res);
  if (!meeting) return;
  const right = await joinRight(req.user, meeting);
  if (!right.ok) return res.status(right.status).json({ error: right.error });
  if (right.host) return res.status(409).json({ error: "Admins run the meeting from the host view.", hostUrl: `/admin/meetings/${meeting.id}/host` });
  const pass = await roomPass(meeting, req.user, { host: false });
  if (!pass) return res.status(503).json({ error: NO_VIDEO });
  res.json(pass);
});

// ---------------------------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------------------------
const notifications = express.Router();
notifications.use(requireAuth);

const presentNotification = (n) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  url: n.url,
  read: Boolean(n.readAt),
  createdAt: n.createdAt.toISOString(),
});

notifications.get("/", async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
  ]);
  res.json({ notifications: items.map(presentNotification), unread });
});

notifications.get("/unread", async (req, res) => {
  res.json({ unread: await prisma.notification.count({ where: { userId: req.user.id, readAt: null } }) });
});

notifications.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ unread: 0 });
});

notifications.get("/preferences", async (req, res) => {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId: req.user.id } });
  const browsers = await prisma.pushSubscription.count({ where: { userId: req.user.id } });
  res.json({
    email: pref?.email ?? true,
    push: pref?.push ?? true,
    pushBrowsers: browsers,
    pushKey: notify.pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
  });
});

notifications.put("/preferences", async (req, res) => {
  const data = {};
  for (const k of ["email", "push"]) if (typeof req.body?.[k] === "boolean") data[k] = req.body[k];
  const pref = await prisma.notificationPreference.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, ...data }, update: data });
  res.json({ email: pref.email, push: pref.push });
});

// This browser said yes to push. The endpoint is the browser's, so it moves to whoever signed in last.
notifications.post("/push", async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
    return res.status(400).json({ error: "That isn't a push subscription." });
  }
  const sub = { userId: req.user.id, p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) };
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...sub }, update: sub });
  res.status(201).json({ ok: true });
});

notifications.delete("/push", async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
  res.json({ ok: true });
});

notifications.post("/:id/read", async (req, res) => {
  await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ unread: await prisma.notification.count({ where: { userId: req.user.id, readAt: null } }) });
});

module.exports = { admin, member, notifications };
