// Who may open which songs and lessons, given term groups. One place, used by every route
// that hands out song stems or lesson videos, so hiding a button is never the only guard.
//
// A song or lesson is "term-managed" once any term slot (in any group) points at it.
// Term-managed content is open to:
//   - staff (the ADMIN_EMAIL account and teachers), as before;
//   - a student in a group whose slot for it is published AND whose unlockAt has passed
//     (server time). Once that happens it's recorded as a TermGrant and the student keeps it
//     ("once they pass the song, they should have access"): after the term ends, after they
//     leave the group, and after staff change or unpublish that month;
//   - a student a linked teacher has assigned it to: a teacher's choice is its own
//     entitlement, so a slot unlocking later in someone's term never blocks it.
// Anything no slot points at keeps the old rule: open to every paying member.
// The paid-membership check itself stays in requirePaid.
const prisma = require("./prisma");
const clock = require("./clock");

const { isAdmin, isTeacher } = require("./roles");

// Signed links for term-managed songs last this long instead of the usual hour, so a link
// handed out just before staff unpublish a month or remove a student stops working soon after.
const TERM_LINK_SECONDS = 10 * 60;
const DEFAULT_LINK_SECONDS = 60 * 60;

function isStaff(user) {
  return Boolean(user) && (isAdmin(user) || isTeacher(user));
}

function isOpen(slot, now) {
  return slot.published && slot.unlockAt.getTime() <= now.getTime();
}

// Loads everything needed to answer access questions for one user at one moment.
async function loadAccess(user, now = clock.now()) {
  const slots = await prisma.termSlot.findMany({
    where: { OR: [{ songId: { not: null } }, { lessonId: { not: null } }] },
    select: { groupId: true, songId: true, lessonId: true, unlockAt: true, published: true },
  });
  const managedSongs = new Set(slots.map((s) => s.songId).filter(Boolean));
  const managedLessons = new Set(slots.map((s) => s.lessonId).filter(Boolean));
  const staff = isStaff(user);

  const openSongs = new Set();
  const openLessons = new Set();
  const pendingSongs = new Map(); // songId -> "locked" | "preparing", for the student's own groups
  const pendingLessons = new Map();

  if (!staff && user) {
    const [enrollments, assignments, grants] = await Promise.all([
      prisma.termEnrollment.findMany({ where: { userId: user.id }, select: { groupId: true } }),
      prisma.assignment.findMany({
        where: {
          studentId: user.id,
          // Only while the teacher who set it still teaches this student.
          teacher: { myStudents: { some: { studentId: user.id } } },
        },
        select: { songId: true, lessonId: true },
      }),
      prisma.termGrant.findMany({ where: { userId: user.id }, select: { songId: true, lessonId: true } }),
    ]);
    const granted = { songs: new Set(grants.map((g) => g.songId).filter(Boolean)), lessons: new Set(grants.map((g) => g.lessonId).filter(Boolean)) };
    const myGroups = new Set(enrollments.map((e) => e.groupId));
    const newGrants = [];
    for (const slot of slots) {
      if (!myGroups.has(slot.groupId)) continue;
      if (isOpen(slot, now)) {
        if (slot.songId) openSongs.add(slot.songId);
        if (slot.lessonId) openLessons.add(slot.lessonId);
        if ((slot.songId && !granted.songs.has(slot.songId)) || (slot.lessonId && !granted.lessons.has(slot.lessonId))) {
          newGrants.push(slot);
        }
      } else {
        const reason = slot.unlockAt.getTime() > now.getTime() ? "locked" : "preparing";
        if (slot.songId) pendingSongs.set(slot.songId, reason);
        if (slot.lessonId) pendingLessons.set(slot.lessonId, reason);
      }
    }
    for (const a of assignments) {
      if (a.songId) openSongs.add(a.songId);
      if (a.lessonId) openLessons.add(a.lessonId);
    }
    for (const id of granted.songs) openSongs.add(id);
    for (const id of granted.lessons) openLessons.add(id);
    // Remember what's open now, so it stays open whatever happens to the term later.
    if (newGrants.length) await recordGrants(newGrants.map((slot) => ({ userId: user.id, slot })));
  }

  const check = (managed, open, pending) => (id) => {
    if (staff || !managed.has(id) || open.has(id)) return { allowed: true, managed: managed.has(id) };
    return { allowed: false, managed: true, reason: pending.get(id) || "not_in_term" };
  };

  return {
    staff,
    song: check(managedSongs, openSongs, pendingSongs),
    lesson: check(managedLessons, openLessons, pendingLessons),
  };
}

// Saves grants for (userId, slot) pairs; existing ones are left alone.
async function recordGrants(pairs) {
  const songs = pairs.filter((p) => p.slot.songId).map((p) => ({ userId: p.userId, songId: p.slot.songId, groupId: p.slot.groupId }));
  const lessons = pairs
    .filter((p) => p.slot.lessonId)
    .map((p) => ({ userId: p.userId, lessonId: p.slot.lessonId, groupId: p.slot.groupId }));
  if (songs.length) await prisma.termGrant.createMany({ data: songs, skipDuplicates: true });
  if (lessons.length) await prisma.termGrant.createMany({ data: lessons, skipDuplicates: true });
}

// Before staff remove a student, delete a term, or change or unpublish a month, record what
// is open right now for the affected students, so nobody loses a song they've reached.
// Grants are otherwise recorded when the student next loads anything.
async function grantOpenSlots({ groupId, userIds, month } = {}) {
  const now = clock.now();
  const [slots, members] = await Promise.all([
    prisma.termSlot.findMany({ where: { groupId, ...(month ? { month } : {}) } }),
    prisma.termEnrollment.findMany({ where: { groupId, ...(userIds ? { userId: { in: userIds } } : {}) }, select: { userId: true } }),
  ]);
  const open = slots.filter((s) => isOpen(s, now) && (s.songId || s.lessonId));
  await recordGrants(members.flatMap((m) => open.map((slot) => ({ userId: m.userId, slot }))));
}

const MESSAGES = {
  locked: "This song unlocks later in your term.",
  preparing: "This month's song is still being prepared.",
  not_in_term: "This is part of a term you're not enrolled in.",
};

function denialMessage(reason, kind = "song") {
  const text = MESSAGES[reason] || MESSAGES.not_in_term;
  return kind === "lesson" ? text.replace("song", "lesson") : text;
}

function linkSeconds(access) {
  return access.managed ? TERM_LINK_SECONDS : DEFAULT_LINK_SECONDS;
}

module.exports = { loadAccess, grantOpenSlots, isStaff, isOpen, denialMessage, linkSeconds, TERM_LINK_SECONDS };
