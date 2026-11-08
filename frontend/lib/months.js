// A month of weekly practice: words and sums shared by the teacher's pages and the student's dashboard.
// The rules themselves are the API's (backend lib/assignments.js, lib/weeklyTemplate.js).

export const ZONE = "Pacific/Honolulu";
export const WEEKS = [1, 2, 3, 4];
export const HELP = { guide: "Guide me", chart: "Chart only", solo: "On my own" };
// From least help to most.
export const HELP_ORDER = ["solo", "chart", "guide"];
export const MARK_NAMES = { "got-it": "Got it", "getting-there": "Getting there", "work-on": "Work on this" };
export const MARKS = Object.keys(MARK_NAMES);
export const DEFAULT_CRITERIA = ["Steady timing", "Accurate notes or chords", "Clean transitions", "The week's technique goal"];

// "Nov 13" from "2026-11-13". The date itself, so no time zone can move it.
export function dayLabel(day) {
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).replace(" ", " ");
}

export function todayHere(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: ZONE });
}

// Which week of the month a day falls in, 1 to 4. Before the month counts as week 1, after it as week 4.
export function weekOf(startsOn, today) {
  const at = (day) => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const days = Math.floor((at(today) - at(startsOn)) / (24 * 60 * 60 * 1000));
  return Math.min(4, Math.max(1, Math.floor(days / 7) + 1));
}

// The assignments that belong to months, one entry per month, newest first, each month's tasks in the
// order the teacher set them.
export function groupMonths(assignments) {
  const months = new Map();
  for (const a of assignments) {
    if (!a.month) continue;
    if (!months.has(a.month.id)) months.set(a.month.id, { ...a.month, song: a.song, teacher: a.teacher, tasks: [] });
    months.get(a.month.id).tasks.push(a);
  }
  const list = [...months.values()];
  for (const m of list) m.tasks.sort((x, y) => x.week - y.week || x.position - y.position);
  return list.sort((x, y) => y.startsOn.localeCompare(x.startsOn));
}

// The month to show: the newest that has started, or else the one starting soonest.
export function currentMonth(months, today) {
  return months.find((m) => m.startsOn <= today) ?? months[months.length - 1] ?? null;
}

// Something has gone in for this task: a checkpoint saved, or an assessment submitted.
export const isDone = (task) => ["saved", "ready", "reviewed"].includes(task.status);

// The checkpoints that haven't had a take saved yet, from the start of the month up to this week.
export function stillToPractise(month, week) {
  return month.tasks.filter((t) => t.kind === "checkpoint" && t.week <= week && !isDone(t));
}

// What to do next in a month: this week's first open task, then any left from earlier, then what's ahead.
export function nextTask(month, today) {
  const week = weekOf(month.startsOn, today);
  const when = (t) => (t.week === week ? 0 : t.week < week ? 1 : 2);
  return month.tasks.filter((t) => !isDone(t)).sort((a, b) => when(a) - when(b) || a.week - b.week || a.position - b.position)[0] ?? null;
}

// One section, or two joined up: named as the template names them.
export function rangeName(from, to) {
  if (from === to) return from.name;
  return `${from.name} ${Math.abs(from.end - to.start) < 0.01 ? "+" : "to"} ${to.name}`;
}

// What a task asks of its final take, in a few words: ["Video", "On my own", "100% speed"].
export function requirementWords(task) {
  const words = [];
  if (task.media === "video") words.push(task.audioAllowed ? "Video (or audio)" : "Video");
  else words.push("Audio");
  if (task.support) words.push(HELP[task.support]);
  if (task.targetSpeed) words.push(`${task.targetSpeed}% speed`);
  return words;
}

// What the API takes for a task, from what's being edited.
export function taskForSaving(t) {
  return {
    week: t.week,
    kind: t.kind,
    section: t.section || null,
    sectionStart: t.sectionStart ?? null,
    sectionEnd: t.sectionEnd ?? null,
    instruction: t.instruction,
    level: t.level,
    media: t.media,
    audioAllowed: t.media === "video" && Boolean(t.audioAllowed),
    support: t.support ?? null,
    targetSpeed: t.targetSpeed ?? null,
    dueOn: t.dueOn ?? null,
    criteria: t.kind === "assessment" ? (t.criteria ?? []).map((c) => c.trim()).filter(Boolean) : [],
    reviewCheckpoint: t.kind === "checkpoint" && Boolean(t.reviewCheckpoint),
  };
}
