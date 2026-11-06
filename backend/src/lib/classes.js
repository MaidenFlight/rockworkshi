// Classes: validating what a teacher enters, turning a weekly or monthly rule into dated sessions,
// spotting clashes in a teacher's calendar, and moving waitlisted students into free places.
const prisma = require("./prisma");
const { INSTRUMENTS } = require("./lessonVideos");
const { isTimeZone, isDateString, toInstant, addDays, weekdayOf } = require("./zoned");

const KINDS = ["lesson", "group", "workshop", "rehearsal", "performance"];
const REPEATS = ["none", "weekly", "monthly"];
const ATTENDANCE = ["present", "late", "absent", "excused"];
const MAX_SESSIONS = 120; // a weekly class for over two years; more is almost certainly a mistake
const MAX_SPAN_DAYS = 400;

const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Returns { data } with only known fields, or { error }. `partial` checks only what's given.
function validateClass(input, { partial = false } = {}) {
  const data = {};
  const has = (k) => input[k] !== undefined;
  const need = (k) => !partial || has(k);

  if (need("kind")) {
    if (!KINDS.includes(input.kind)) return { error: `kind must be one of: ${KINDS.join(", ")}.` };
    data.kind = input.kind;
  }
  if (need("title")) {
    data.title = text(input.title, 120);
    if (!data.title) return { error: "A class needs a title." };
  }
  if (has("description")) data.description = text(input.description, 2000);
  if (has("level")) data.level = text(input.level, 40);
  if (has("topics")) data.topics = text(input.topics, 300);
  if (has("instruments")) {
    if (!Array.isArray(input.instruments) || input.instruments.some((i) => !INSTRUMENTS.includes(i))) {
      return { error: `instruments must come from: ${INSTRUMENTS.join(", ")}.` };
    }
    data.instruments = [...new Set(input.instruments)];
  }
  if (has("capacity")) {
    if (input.capacity !== null && !(Number.isInteger(input.capacity) && input.capacity >= 1 && input.capacity <= 200)) {
      return { error: "capacity must be a whole number from 1 to 200, or empty for no limit." };
    }
    data.capacity = input.capacity;
  }
  if (need("timeZone")) {
    if (!isTimeZone(input.timeZone)) return { error: "timeZone must be a time zone name such as Pacific/Honolulu." };
    data.timeZone = input.timeZone;
  }
  if (need("firstDate")) {
    if (!isDateString(input.firstDate)) return { error: "firstDate must be a date as YYYY-MM-DD." };
    data.firstDate = input.firstDate;
  }
  if (need("startMinute")) {
    if (!(Number.isInteger(input.startMinute) && input.startMinute >= 0 && input.startMinute < 1440)) {
      return { error: "startMinute must be minutes after midnight, 0 to 1439." };
    }
    data.startMinute = input.startMinute;
  }
  if (need("durationMinutes")) {
    if (!(Number.isInteger(input.durationMinutes) && input.durationMinutes >= 5 && input.durationMinutes <= 480)) {
      return { error: "durationMinutes must be from 5 to 480." };
    }
    data.durationMinutes = input.durationMinutes;
  }
  if (need("repeat")) {
    const repeat = input.repeat ?? "none";
    if (!REPEATS.includes(repeat)) return { error: `repeat must be one of: ${REPEATS.join(", ")}.` };
    data.repeat = repeat;
  }
  if (has("repeatUntil")) {
    if (input.repeatUntil !== null && !isDateString(input.repeatUntil)) return { error: "repeatUntil must be a date as YYYY-MM-DD." };
    data.repeatUntil = input.repeatUntil;
  }
  if (has("meetingUrl")) {
    const url = text(input.meetingUrl, 500);
    if (url && !/^https:\/\/\S+$/.test(url)) return { error: "The meeting link must start with https://." };
    data.meetingUrl = url;
  }
  if (has("songId")) data.songId = typeof input.songId === "string" && input.songId ? input.songId : null;
  return { data };
}

// Checks the rule as a whole, once partial changes are merged with the class as it was.
function checkSchedule(c) {
  if (c.repeat === "none") return null;
  if (!c.repeatUntil) return "A repeating class needs an end date.";
  if (c.repeatUntil < c.firstDate) return "The end date is before the first class.";
  if (c.repeatUntil > addDays(c.firstDate, MAX_SPAN_DAYS)) return "A repeating class can run for at most about a year at a time.";
  return null;
}

// Every local date a class meets on. Monthly classes meet on the same day of the month and skip
// months without that day (no 31 February).
function sessionDates(c) {
  if (c.repeat === "none") return [c.firstDate];
  const dates = [];
  if (c.repeat === "weekly") {
    for (let d = c.firstDate; d <= c.repeatUntil && dates.length < MAX_SESSIONS; d = addDays(d, 7)) dates.push(d);
    return dates;
  }
  const [y, m, day] = c.firstDate.split("-").map(Number);
  for (let i = 0; dates.length < MAX_SESSIONS; i++) {
    const year = y + Math.floor((m - 1 + i) / 12);
    const month = ((m - 1 + i) % 12) + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date > c.repeatUntil) break;
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day) dates.push(date);
  }
  return dates;
}

// The real start and end of each session, as instants.
function sessionTimes(c) {
  return sessionDates(c).map((date) => {
    const startsAt = toInstant(date, c.startMinute, c.timeZone);
    return { date, startsAt, endsAt: new Date(startsAt.getTime() + c.durationMinutes * 60000) };
  });
}

// The teacher's other scheduled sessions that overlap any of these times.
async function findConflicts(teacherId, times, { exceptClassId = null, exceptOccurrenceId = null } = {}) {
  if (!teacherId || !times.length) return [];
  const found = await prisma.classOccurrence.findMany({
    where: {
      status: "scheduled",
      class: { teacherId, status: "active", ...(exceptClassId ? { id: { not: exceptClassId } } : {}) },
      ...(exceptOccurrenceId ? { id: { not: exceptOccurrenceId } } : {}),
      OR: times.map((t) => ({ startsAt: { lt: t.endsAt }, endsAt: { gt: t.startsAt } })),
    },
    include: { class: { select: { id: true, title: true } } },
    orderBy: { startsAt: "asc" },
    take: 10,
  });
  return found.map((o) => ({ occurrenceId: o.id, classId: o.class.id, title: o.class.title, startsAt: o.startsAt, endsAt: o.endsAt }));
}

// Makes the future sessions match the class's rule again after its time changes. Past sessions,
// sessions with attendance taken, and ones the teacher cancelled or moved are left alone.
async function regenerate(tx, cls, now = new Date()) {
  const kept = await tx.classOccurrence.findMany({ where: { classId: cls.id } });
  const touched = (o) => o.startsAt < now || o.status !== "scheduled" || o.movedFrom;
  const withAttendance = new Set(
    (await tx.attendance.findMany({ where: { occurrence: { classId: cls.id } }, select: { occurrenceId: true } })).map((a) => a.occurrenceId)
  );
  const removable = kept.filter((o) => !touched(o) && !withAttendance.has(o.id));
  await tx.classOccurrence.deleteMany({ where: { id: { in: removable.map((o) => o.id) } } });
  const remaining = kept.filter((o) => !removable.includes(o));
  const taken = new Set(remaining.flatMap((o) => [o.startsAt.getTime(), o.movedFrom?.getTime()]).filter(Boolean));
  const fresh = sessionTimes(cls).filter((t) => t.startsAt >= now && !taken.has(t.startsAt.getTime()));
  if (fresh.length) {
    await tx.classOccurrence.createMany({ data: fresh.map((t) => ({ classId: cls.id, startsAt: t.startsAt, endsAt: t.endsAt })) });
  }
}

// Moves the longest-waiting students into any free places.
async function fillPlaces(tx, classId) {
  const cls = await tx.class.findUnique({ where: { id: classId } });
  const waiting = await tx.classEnrollment.findMany({ where: { classId, status: "waitlisted" }, orderBy: { createdAt: "asc" } });
  if (!waiting.length) return [];
  const enrolled = await tx.classEnrollment.count({ where: { classId, status: "enrolled" } });
  const free = cls.capacity == null ? waiting.length : Math.max(0, cls.capacity - enrolled);
  const moving = waiting.slice(0, free);
  for (const e of moving) {
    await tx.classEnrollment.update({ where: { classId_userId: { classId, userId: e.userId } }, data: { status: "enrolled" } });
  }
  return moving.map((e) => e.userId);
}

function presentClass(c) {
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    description: c.description,
    level: c.level,
    instruments: c.instruments,
    topics: c.topics,
    capacity: c.capacity,
    timeZone: c.timeZone,
    firstDate: c.firstDate,
    startMinute: c.startMinute,
    durationMinutes: c.durationMinutes,
    repeat: c.repeat,
    repeatUntil: c.repeatUntil,
    meetingUrl: c.meetingUrl,
    songId: c.songId,
    song: c.song ? { id: c.song.id, title: c.song.title } : undefined,
    status: c.status,
    teacher: c.teacher ? { id: c.teacher.id, name: c.teacher.name } : undefined,
  };
}

module.exports = {
  KINDS,
  REPEATS,
  ATTENDANCE,
  validateClass,
  checkSchedule,
  sessionDates,
  sessionTimes,
  findConflicts,
  regenerate,
  fillPlaces,
  presentClass,
  weekdayOf,
};
