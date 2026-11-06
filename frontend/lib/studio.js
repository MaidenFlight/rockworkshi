// Shared helpers for the Teacher Studio, admin class pages, the family area and the student's
// classes: API calls, and times shown in the right time zone.
import { teacherRequest } from "@/lib/teaching";

// Any signed-in request with the session cookie; throws the API's own error message.
export const api = teacherRequest;

export function send(path, method, body) {
  return api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

export const KINDS = [
  { id: "lesson", label: "Individual lesson" },
  { id: "group", label: "Group class" },
  { id: "workshop", label: "Workshop" },
  { id: "rehearsal", label: "Band rehearsal" },
  { id: "performance", label: "Performance" },
];
export const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label ?? id;

export const INSTRUMENTS = ["Guitar", "Piano", "Bass", "Drums", "Voice", "Ukulele"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Time zones offered when scheduling: the school's own first, then the browser's.
export function zoneChoices() {
  const mine = viewerZone();
  const common = ["Pacific/Honolulu", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Pacific/Auckland", "Australia/Sydney", "Asia/Tokyo", "Europe/London"];
  return [...new Set(["Pacific/Honolulu", mine, ...common])];
}

export function viewerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Pacific/Honolulu";
  } catch {
    return "Pacific/Honolulu";
  }
}

export const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export function toMinutes(time) {
  const [h, m] = String(time || "").split(":").map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
}

// "Tue 10 Mar, 4:00 PM" in a zone, with the zone's short name when it isn't the viewer's own.
export function when(date, timeZone = viewerZone(), { withZone = timeZone !== viewerZone(), dateOnly = false } = {}) {
  const d = new Date(date);
  const opts = dateOnly ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
  const text = d.toLocaleString("en-US", { ...opts, timeZone });
  if (!withZone || dateOnly) return text;
  const zone = d.toLocaleString("en-US", { timeZone, timeZoneName: "short" }).split(" ").pop();
  return `${text} ${zone}`;
}

export const clock = (date, timeZone = viewerZone()) => new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });

// The local date (YYYY-MM-DD) of an instant in a zone.
export function localDate(date, timeZone = viewerZone()) {
  return new Date(date).toLocaleDateString("en-CA", { timeZone });
}

export function addDays(dateString, days) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Monday of the week a date falls in.
export function weekOf(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dateString, -((day + 6) % 7));
}

export function repeatText(c) {
  if (c.repeat === "weekly") return `Weekly on ${WEEKDAYS[new Date(`${c.firstDate}T12:00:00Z`).getUTCDay()]}s until ${c.repeatUntil}`;
  if (c.repeat === "monthly") return `Monthly on day ${Number(c.firstDate.slice(8))} until ${c.repeatUntil}`;
  return `Once, on ${c.firstDate}`;
}

export const ATTENDANCE = [
  { id: "present", label: "Present" },
  { id: "late", label: "Late" },
  { id: "absent", label: "Absent" },
  { id: "excused", label: "Excused" },
];
