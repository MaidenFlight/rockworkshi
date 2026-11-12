// Month plans in the Teacher Studio: dates, ordering and the words for what's changing. The rules
// themselves are the API's (backend lib/monthPlans.js). Kept free of "@/" imports so it can be tested
// directly with node.
import { HELP, dayLabel } from "./months.js";

export const PLAN_STATUS = { draft: "Draft", published: "Published", archived: "Archived" };
export const MAX_DUE_DAY = 90;

const utc = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(day, days) {
  return new Date(utc(day) + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((utc(to) - utc(from)) / 86400000);
}

export function dueOnOf(task, startsOn) {
  return task.dueDay === null || task.dueDay === undefined || !startsOn ? null : addDays(startsOn, task.dueDay);
}

// Days after the start, from a date picked in the form. Blank is no due date; anything out of range
// comes back as the nearest day that's allowed.
export function dueDayFrom(day, startsOn) {
  if (!day || !startsOn) return null;
  return Math.min(MAX_DUE_DAY, Math.max(0, daysBetween(startsOn, day)));
}

export function newTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// A new task starts from the week's others, so only what's different has to be set.
export function blankTask(week, tasks, level = 1) {
  const here = tasks.filter((t) => t.week === week);
  const like = here[here.length - 1] ?? tasks[tasks.length - 1];
  return {
    id: newTaskId(),
    week,
    kind: "checkpoint",
    section: "",
    sectionStart: null,
    sectionEnd: null,
    instruction: "",
    level: like?.level ?? level,
    media: "audio",
    audioAllowed: false,
    support: like?.support ?? null,
    targetSpeed: like?.targetSpeed ?? null,
    dueDay: like?.dueDay ?? week * 7 - 1,
    criteria: [],
    reviewCheckpoint: false,
  };
}

// Moves a task up or down among those of its own week and kind. Anywhere else it would just be
// sorted back. Returns the list unchanged if there's nowhere to go.
export function moveTask(tasks, id, direction) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return tasks;
  const group = tasks.filter((t) => t.week === task.week && t.kind === task.kind);
  const from = group.indexOf(task);
  const to = from + direction;
  if (to < 0 || to >= group.length) return tasks;
  const neighbour = group[to];
  return tasks.map((t) => (t === task ? neighbour : t === neighbour ? task : t));
}

// Where a task sits in its group, for the buttons that move it.
export function placeInGroup(tasks, task) {
  const group = tasks.filter((t) => t.week === task.week && t.kind === task.kind);
  const index = group.findIndex((t) => t.id === task.id);
  return { first: index === 0, last: index === group.length - 1 };
}

// A task's one-line place in the month: "Week 2 assessment".
export function taskPlace({ week, kind }) {
  return `Week ${week} ${kind === "assessment" ? "assessment" : "milestone"}`;
}

const FIELD_NAMES = {
  week: "Week",
  kind: "Kind of task",
  section: "Name",
  sectionStart: "Starts at",
  sectionEnd: "Ends at",
  instruction: "Instructions",
  level: "Level",
  media: "Recording",
  audioAllowed: "Audio alternative",
  support: "Support mode",
  targetSpeed: "Target speed",
  criteria: "Assessment criteria",
  reviewCheckpoint: "In your review queue",
  dueOn: "Due",
  dueDay: "Due",
  startsOn: "First day",
  weekTitles: "Week names",
};

export const fieldName = (field) => FIELD_NAMES[field] ?? field;

const clockOf = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

// A value of one of those fields, as words.
export function fieldValue(field, value) {
  if (field === "audioAllowed" || field === "reviewCheckpoint") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return field === "targetSpeed" || field === "support" ? "Any" : "None";
  if (field === "targetSpeed") return `${value}%`;
  if (field === "support") return HELP[value] ?? value;
  if (field === "media") return value === "video" ? "Video" : "Audio";
  if (field === "kind") return value === "assessment" ? "Weekly assessment" : "Milestone";
  if (field === "week") return `Week ${value}`;
  if (field === "dueOn" || field === "startsOn") return dayLabel(value);
  if (field === "dueDay") return `Day ${value + 1}`;
  if (field === "sectionStart" || field === "sectionEnd") return clockOf(value);
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// What's different about one student's task, in a few words.
export function overrideWords(change) {
  if (!change) return [];
  if (change.skip) return ["Left out"];
  const words = [];
  if (change.media) words.push(fieldValue("media", change.media));
  if (change.audioAllowed) words.push("Audio accepted");
  if (change.support !== undefined) words.push(fieldValue("support", change.support));
  if (change.targetSpeed !== undefined) words.push(change.targetSpeed === null ? "Any speed" : `${change.targetSpeed}% speed`);
  if (change.dueDay !== undefined) words.push("Own due date");
  if (change.instruction !== undefined) words.push("Own instructions");
  return words;
}

// How long something has been waiting, in the largest unit that's useful.
export function waitingFor(since, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  if (minutes < 60) return minutes < 2 ? "Just sent" : `Waiting ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "Waiting 1 hour" : `Waiting ${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Waiting 1 day" : `Waiting ${days} days`;
}

const isMinute = (n) => n === 1;
export const count = (n, one, many = `${one}s`) => `${n} ${isMinute(n) ? one : many}`;

// A recording's format, as the review queue says it: ["Video, MP4", "1:45", "Chart only", "90% speed"].
export function recordingWords(recording) {
  if (!recording) return ["No recording"];
  const type = (recording.type || "").split("/")[1];
  const format = recording.media === "video" ? `Video${type ? `, ${type.toUpperCase()}` : ""}` : "Audio";
  const speed = recording.speed < 1 ? `${Math.round(recording.speed * 100)}% speed` : "Full speed";
  return [format, recording.duration ? clockOf(recording.duration) : null, recording.support ? HELP[recording.support] : null, speed].filter(Boolean);
}

// Query string for the inbox's filters, for links that have to keep them.
export function inboxQuery({ classId, studentId, instrument } = {}) {
  const q = new URLSearchParams();
  if (classId) q.set("classId", classId);
  if (studentId) q.set("studentId", studentId);
  if (instrument) q.set("instrument", instrument);
  return q.toString();
}
