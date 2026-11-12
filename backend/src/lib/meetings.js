// Live meetings: Brian's monthly sing-along, run from the site. An admin schedules them (one date, or
// the same day every month), picks who's invited (a class and/or students by name) and starts them;
// invited students join from the site and their guardians are kept informed. Times are typed and shown
// in Hawaii time (lib/honolulu.js) and stored in UTC.
const prisma = require("./prisma");
const { REAL } = require("./demoRules");
const { isAdmin } = require("./roles");
const { fromLocal, toLocal, addMonthsAndDays, display } = require("./honolulu");

const MAX_DATES = 12; // a monthly series covers at most a year
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MIN_MINUTES = 15;
const MAX_MINUTES = 240;
// A live meeting the host never ended stops counting as live this long after it should have finished.
const LIVE_GRACE_MS = 2 * 60 * 60 * 1000;

const text = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

// What an admin sent, checked. start is "YYYY-MM-DDTHH:mm" in Hawaii time. With partial, only the
// fields given are checked and returned. Returns { data } or { error }.
function validateMeeting(input = {}, { partial = false } = {}) {
  const data = {};
  const has = (k) => input[k] !== undefined;
  if (!partial || has("title")) {
    data.title = text(input.title, MAX_TITLE);
    if (!data.title) return { error: "Give the meeting a name." };
  }
  if (!partial || has("description")) data.description = text(input.description, MAX_DESCRIPTION) || null;
  if (!partial || has("durationMinutes")) {
    const minutes = Number(input.durationMinutes ?? 60);
    if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      return { error: `A meeting lasts between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.` };
    }
    data.durationMinutes = minutes;
  }
  if (!partial || has("start")) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input.start || "")) || !fromLocal(input.start)) {
      return { error: "Pick a date and time." };
    }
    data.start = input.start;
  }
  if (!partial || has("repeat")) {
    data.repeat = input.repeat === "monthly" ? "monthly" : "none";
    if (data.repeat === "monthly") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.repeatUntil || "")) || !fromLocal(input.repeatUntil)) {
        return { error: "Pick the last month for a monthly meeting." };
      }
      data.repeatUntil = input.repeatUntil;
    }
  }
  if (!partial || has("classId")) data.classId = input.classId ? String(input.classId) : null;
  if (!partial || has("studentIds")) {
    if (input.studentIds !== undefined && !Array.isArray(input.studentIds)) return { error: "Students must be a list." };
    data.studentIds = [...new Set((input.studentIds || []).map(String))].slice(0, 500);
  }
  return { data };
}

// The start of each meeting in a series, as UTC Dates. A monthly series keeps the day of the month,
// falling back to the month's last day (the 31st becomes Feb 28), and stops at repeatUntil or a year.
function seriesStarts(start, repeat = "none", repeatUntil = null) {
  const [date, time] = start.split("T");
  if (repeat !== "monthly") return [fromLocal(start)];
  const starts = [];
  for (let i = 0; i < MAX_DATES; i++) {
    const day = addMonthsAndDays(date, i);
    if (repeatUntil && day > repeatUntil) break;
    starts.push(fromLocal(`${day}T${time}`));
  }
  return starts;
}

// The students a meeting is for: the class's enrolled students (not its waitlist) and the students
// picked by name. Demo accounts never count. Unknown ids are an error, so a typo can't vanish.
async function resolveInvitees({ classId, studentIds = [] }, db = prisma) {
  const picked = new Map();
  if (classId) {
    const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) return { error: "That class doesn't exist." };
    const enrolled = await db.classEnrollment.findMany({ where: { classId, status: "enrolled", user: REAL }, select: { userId: true } });
    for (const e of enrolled) picked.set(e.userId, true);
  }
  if (studentIds.length) {
    const found = await db.user.findMany({ where: { id: { in: studentIds }, ...REAL }, select: { id: true } });
    if (found.length !== studentIds.length) return { error: "One of those students couldn't be found." };
    for (const u of found) if (!picked.has(u.id)) picked.set(u.id, false);
  }
  if (!classId && !studentIds.length) return { error: "Invite a class or at least one student." };
  return { invitees: [...picked].map(([userId, viaClass]) => ({ userId, viaClass })) };
}

// Replaces a meeting's invite list.
async function setInvites(tx, meetingId, invitees) {
  await tx.meetingInvite.deleteMany({ where: { meetingId } });
  if (invitees.length) await tx.meetingInvite.createMany({ data: invitees.map((i) => ({ meetingId, ...i })), skipDuplicates: true });
}

// The class's enrolled students as they are now, plus the students picked by name. Run when a
// meeting starts, so a student enrolled after it was scheduled can still get in.
async function refreshClassInvites(tx, meeting) {
  if (!meeting.classId) return;
  const existing = await tx.meetingInvite.findMany({ where: { meetingId: meeting.id, viaClass: false }, select: { userId: true } });
  const result = await resolveInvitees({ classId: meeting.classId, studentIds: existing.map((e) => e.userId) }, tx);
  if (result.error) return; // the class was deleted: keep who was invited
  await setInvites(tx, meeting.id, result.invitees);
}

// Everyone told about a meeting: each invited student, and each guardian who accepted a link to one.
// A guardian of two invited children is one recipient (with both names), so they get one message.
async function recipientsFor(meetingId, db = prisma) {
  const invites = await db.meetingInvite.findMany({
    where: { meetingId, user: REAL },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  const people = new Map();
  for (const { user } of invites) people.set(user.id, { user, student: true, kids: [], kidIds: [] });
  if (!invites.length) return [];
  const links = await db.guardianLink.findMany({
    where: { studentId: { in: invites.map((i) => i.user.id) }, guardianId: { not: null }, acceptedAt: { not: null }, guardian: REAL },
    select: { student: { select: { id: true, name: true } }, guardian: { select: { id: true, name: true, email: true } } },
  });
  for (const link of links) {
    const entry = people.get(link.guardian.id) ?? { user: link.guardian, student: false, kids: [], kidIds: [] };
    if (entry.student) continue; // a student who is also a guardian hears about it as a student
    entry.kids.push(link.student.name || "your child");
    entry.kidIds.push(link.student.id);
    people.set(link.guardian.id, entry);
  }
  return [...people.values()];
}

// Live, and not left running long after it should have ended.
function isLive(meeting, now = new Date()) {
  if (meeting.status !== "live") return false;
  const end = new Date(meeting.startsAt.getTime() + meeting.durationMinutes * 60000);
  const started = meeting.startedAt ?? meeting.startsAt;
  return now.getTime() < Math.max(end.getTime(), started.getTime() + meeting.durationMinutes * 60000) + LIVE_GRACE_MS;
}

// Who may come in. Admins host. An invited student joins while it's live.
async function joinRight(user, meeting, db = prisma) {
  if (!user) return { ok: false, status: 401, error: "Not signed in." };
  if (isAdmin(user)) return { ok: true, host: true };
  const invite = await db.meetingInvite.findUnique({ where: { meetingId_userId: { meetingId: meeting.id, userId: user.id } } });
  if (!invite) return { ok: false, status: 403, error: "You're not invited to this meeting." };
  if (meeting.status === "cancelled") return { ok: false, status: 409, error: "This meeting was cancelled." };
  if (meeting.status === "ended" || (meeting.status === "live" && !isLive(meeting))) {
    return { ok: false, status: 409, error: "This meeting has finished." };
  }
  if (meeting.status !== "live") return { ok: false, status: 409, error: "This meeting hasn't started yet. Join opens when it starts." };
  return { ok: true, host: false };
}

function presentMeeting(m, now = new Date()) {
  return {
    id: m.id,
    seriesId: m.seriesId,
    title: m.title,
    description: m.description,
    startsAt: m.startsAt.toISOString(),
    startLocal: toLocal(m.startsAt),
    when: display(m.startsAt),
    durationMinutes: m.durationMinutes,
    status: m.status === "live" && !isLive(m, now) ? "ended" : m.status,
    startedAt: m.startedAt?.toISOString() ?? null,
    endedAt: m.endedAt?.toISOString() ?? null,
    classId: m.classId,
  };
}

module.exports = {
  MAX_DATES,
  validateMeeting,
  seriesStarts,
  resolveInvitees,
  setInvites,
  refreshClassInvites,
  recipientsFor,
  isLive,
  joinRight,
  presentMeeting,
};
