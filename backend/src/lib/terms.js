// Term groups: what students see of their term, and what staff see while preparing it.
const clock = require("./clock");
const { isOpen } = require("./termAccess");
const { fromLocal, toLocal, toLocalDate, endOfLocalDay, addMonthsAndDays, display } = require("./honolulu");

const MONTHS = [1, 2, 3];
const MAX_NAME = 80;

const SLOT_INCLUDE = {
  song: { select: { id: true, title: true, artist: true, published: true, _count: { select: { tracks: true } } } },
  lesson: { select: { id: true, title: true, published: true } },
};

// ---------- Validation (staff input is Honolulu local time) ----------

// { name, startDate: "YYYY-MM-DD", endDate } -> { data } or { error }
function validateGroup(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME) return { error: `Give the term a name of up to ${MAX_NAME} characters.` };
  const startsAt = fromLocal(body.startDate);
  const endsAt = endOfLocalDay(body.endDate);
  if (!startsAt || !endsAt || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
    return { error: "Start and end dates must be real dates (YYYY-MM-DD)." };
  }
  if (endsAt <= startsAt) return { error: "The term must end after it starts." };
  return { data: { name, startsAt, endsAt } };
}

// The default unlock for month n: midnight Honolulu, n-1 calendar months after the start date.
function defaultUnlock(startDate, month) {
  return fromLocal(addMonthsAndDays(startDate, month - 1));
}

// ---------- Staff view ----------

// Problems to fix before (or after) publishing. `blocking` ones stop publication.
function slotWarnings(slot, group) {
  const warnings = [];
  if (!slot.song) warnings.push({ blocking: true, text: "No song chosen yet." });
  else {
    if (!slot.song.published) warnings.push({ blocking: true, text: "The song is hidden from the song library." });
    if (!slot.song._count.tracks) warnings.push({ blocking: false, text: "No play-along stems uploaded for this song yet." });
  }
  if (slot.lesson && !slot.lesson.published) warnings.push({ blocking: false, text: "The linked lesson is unpublished." });
  if (slot.unlockAt < group.startsAt || slot.unlockAt > group.endsAt) {
    warnings.push({ blocking: false, text: "The unlock date is outside the term's dates." });
  }
  return warnings;
}

function presentStaffSlot(slot, group) {
  return {
    month: slot.month,
    unlockAt: slot.unlockAt,
    unlockAtLocal: toLocal(slot.unlockAt),
    unlockAtDisplay: display(slot.unlockAt),
    song: slot.song ? { id: slot.song.id, title: slot.song.title, artist: slot.song.artist, hasTracks: slot.song._count.tracks > 0 } : null,
    lesson: slot.lesson ? { id: slot.lesson.id, title: slot.lesson.title } : null,
    published: slot.published,
    publishedAt: slot.publishedAt,
    open: isOpen(slot, clock.now()),
    warnings: slotWarnings(slot, group),
  };
}

function presentStaffGroup(group) {
  return {
    id: group.id,
    name: group.name,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
    startDate: toLocalDate(group.startsAt),
    endDate: toLocalDate(group.endsAt),
    period: `${display(group.startsAt)} – ${display(group.endsAt)}`,
    memberCount: group._count?.members ?? group.members?.length ?? 0,
    slots: [...group.slots].sort((a, b) => a.month - b.month).map((s) => presentStaffSlot(s, group)),
    members: group.members?.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      instrument: m.user.instrument,
      paid: Boolean(m.user.paidAt),
    })),
  };
}

// ---------- Student view ----------

// What a student may know about one month. A song's title only appears once it's open
// (or the student already reached it and keeps it, see TermGrant): before that the
// student sees a date, or that the song is being prepared.
function presentStudentSlot(slot, now, kept = new Set()) {
  const base = { month: slot.month, unlockAt: slot.unlockAt, unlockAtDisplay: display(slot.unlockAt) };
  const reached = slot.song && kept.has(slot.song.id);
  if (slot.unlockAt.getTime() > now.getTime() && !reached) return { ...base, state: "upcoming" };
  // Published but the song was later hidden from the library: honest "preparing", not a dead link.
  if ((!isOpen(slot, now) && !reached) || !slot.song || !slot.song.published) return { ...base, state: "preparing" };
  return {
    ...base,
    state: "available",
    song: { id: slot.song.id, title: slot.song.title, artist: slot.song.artist, hasTracks: slot.song._count.tracks > 0 },
    lesson: slot.lesson?.published ? { id: slot.lesson.id, title: slot.lesson.title } : null,
  };
}

function termStatus(group, now) {
  if (now < group.startsAt) return "upcoming";
  if (now > group.endsAt) return "ended";
  return "active";
}

// The term to show: the running one, else the next to start, else the latest finished.
function pickGroup(groups, now) {
  const byStart = [...groups].sort((a, b) => b.startsAt - a.startsAt);
  return (
    byStart.find((g) => termStatus(g, now) === "active") ||
    [...byStart].reverse().find((g) => termStatus(g, now) === "upcoming") ||
    byStart.find((g) => termStatus(g, now) === "ended") ||
    null
  );
}

// keptSongIds: songs this student already reached (TermGrant), which stay theirs.
function presentStudentTerm(groups, now, keptSongIds = new Set()) {
  const group = pickGroup(groups, now);
  if (!group) return { state: "none" };
  const slots = [...group.slots].sort((a, b) => a.month - b.month).map((s) => presentStudentSlot(s, now, keptSongIds));
  const opened = slots.filter((s) => s.unlockAt.getTime() <= now.getTime());
  // Other terms the student was in, with whatever opened there. Nothing is taken away at term end.
  const earlier = groups
    .filter((g) => g.id !== group.id && now > g.endsAt)
    .map((g) => ({
      id: g.id,
      name: g.name,
      songs: [...g.slots]
        .sort((a, b) => a.month - b.month)
        .map((s) => presentStudentSlot(s, now, keptSongIds))
        .filter((s) => s.state === "available"),
    }))
    .filter((g) => g.songs.length);
  return {
    state: termStatus(group, now),
    group: {
      id: group.id,
      name: group.name,
      startsAt: group.startsAt,
      endsAt: group.endsAt,
      startDisplay: display(group.startsAt),
      endDisplay: display(group.endsAt),
    },
    currentMonth: opened.length ? opened[opened.length - 1].month : null,
    slots,
    earlier,
  };
}

module.exports = {
  MONTHS,
  SLOT_INCLUDE,
  validateGroup,
  defaultUnlock,
  slotWarnings,
  presentStaffGroup,
  presentStudentTerm,
};
