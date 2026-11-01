import { API_URL } from "@/lib/api";

// Shared by the /teacher pages.

export async function teacherRequest(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const STATUS_LABELS = {
  assigned: "Practising",
  ready: "Ready for review",
  reviewed: "Reviewed",
};

export function contentTitle(assignment) {
  const item = assignment.song || assignment.lesson;
  if (!item) return "Removed song or lesson";
  return item.artist ? `${item.title} · ${item.artist}` : item.title;
}

// Which stem belongs to an instrument. Mirrors PART_FOR_INSTRUMENT in backend/src/lib/songTracks.js.
const PART_FOR_INSTRUMENT = {
  Guitar: "Guitar",
  Ukulele: "Guitar",
  Piano: "Keys",
  Bass: "Bass",
  Drums: "Drums",
  Voice: "Vocals",
};

export function partForInstrument(instrument) {
  return PART_FOR_INSTRUMENT[instrument] || null;
}

export function studentName(student) {
  return student?.name || "Unnamed student";
}

// "1:05" -> 65. Plain seconds ("65") work too. Returns null for blank, NaN for nonsense.
export function parseClock(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const m = /^(\d+):([0-5]\d)(\.\d+)?$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || 0);
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function formatClock(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "";
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
