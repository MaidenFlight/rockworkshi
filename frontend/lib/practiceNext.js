// What the dashboard puts first: one thing to practise, picked only from real data.
// In order: the teacher's open work, this month's term song, the song last opened, then the
// first song this member can open. Nothing here is invented or estimated.

import { currentMonth, groupMonths, nextTask, todayHere } from "./months.js";

const openWork = (a) => a.status !== "ready" && a.status !== "saved" && a.status !== "reviewed" && (a.song || a.lesson);

export function pickPracticeNext({ library, term, assignments }) {
  const songs = library?.songs ?? [];
  const playable = songs.filter((s) => s.hasTracks && !s.locked);
  const resume = library?.continue ?? null;
  const leftOffIn = (songId) => (resume?.song.id === songId ? resume.position : null);
  const isNew = !resume && songs.every((s) => !s.lastOpenedAt) && !(assignments ?? []).length;
  const feedback = (assignments ?? []).find((a) => a.status === "reviewed") ?? null;

  if (term && term.membership !== "active") return { kind: "renew", expired: term.membership === "expired", isNew, feedback: null };

  // This week's next task in the month under way; otherwise the next in the order the teacher set them.
  const today = todayHere();
  const month = currentMonth(groupMonths(assignments ?? []), today);
  const work = (month && nextTask(month, today)) || (assignments ?? []).filter((a) => !a.month && openWork(a)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (work) {
    return {
      kind: "assignment",
      assignment: work,
      song: work.song,
      href: work.song ? `/member/song/${work.song.id}?assignment=${work.id}` : `/member/assignment/${work.id}`,
      leftOff: work.song ? leftOffIn(work.song.id) : null,
      isNew,
      feedback,
    };
  }

  const t = term?.term;
  const current = t?.slots?.find((s) => s.month === t.currentMonth);
  if (current?.state === "available" && current.song) {
    return {
      kind: "term",
      song: current.song,
      lesson: current.lesson ?? null,
      month: current.month,
      group: t.group,
      href: `/member/song/${current.song.id}`,
      leftOff: leftOffIn(current.song.id),
      isNew,
      feedback,
    };
  }

  // A term whose song isn't out yet still says so, but doesn't hide a song they can play now.
  const waiting = t && t.state !== "none" && t.state !== "ended" ? { upcoming: t.state === "upcoming" || !current, unlockShort: (current ?? t.slots?.[0])?.unlockShort } : null;

  if (resume) {
    return { kind: "continue", song: resume.song, href: `/member/song/${resume.song.id}`, leftOff: resume.position, lastOpenedAt: resume.lastOpenedAt, waiting, isNew, feedback };
  }
  if (playable.length) {
    return { kind: "start", song: playable[0], href: `/member/song/${playable[0].id}`, leftOff: null, waiting, isNew, feedback };
  }
  return { kind: "empty", waiting, isNew, feedback };
}

// Songs this member can open right now, which is what "ready to play" should count.
export function openableCount(library) {
  return (library?.songs ?? []).filter((s) => s.hasTracks && !s.locked).length;
}
