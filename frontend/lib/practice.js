import { API_URL } from "@/lib/api";

// The student's practice library: favourites, notes, resume state.
// The phone app has the same search/filter rules in mobile/src/lib/library.ts.

// Thrown when the request never reached the server, so pages can say "offline"
// rather than showing a server error.
export class NetworkError extends Error {
  constructor() {
    super("You're offline. Check your connection and try again.");
    this.name = "NetworkError";
  }
}

export async function practiceRequest(path, { keepalive = false, ...options } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      keepalive,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      ...options,
    });
  } catch {
    throw new NetworkError();
  }
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Last good library response, per user, so the page still shows something offline.
// Browser storage can be missing (private windows, blocked storage), so every access is guarded.
const cacheKey = (userId) => `rw-library:${userId}`;

export function readLibraryCache(userId) {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLibraryCache(userId, data) {
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {
    // Storage full or blocked: the page works without the cache.
  }
}

// Case- and accent-insensitive, so "beyonce" finds "Beyoncé".
function normalise(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export const STEM_FILTERS = [
  { id: "any", label: "Any" },
  { id: "stems", label: "With stems" },
  { id: "Vocals", label: "Vocals stem" },
  { id: "Guitar", label: "Guitar stem" },
  { id: "Keys", label: "Keys stem" },
  { id: "Bass", label: "Bass stem" },
  { id: "Drums", label: "Drums stem" },
];

export const EMPTY_FILTERS = { query: "", level: "", stems: "any", favorites: false };

export function filterSongs(songs, { query, level, stems, favorites }) {
  const q = normalise(query);
  return songs.filter((s) => {
    if (favorites && !s.favorite) return false;
    if (level && s.level !== level) return false;
    if (stems === "stems" && !s.hasTracks) return false;
    if (stems !== "any" && stems !== "stems" && !s.parts.includes(stems)) return false;
    if (q && !normalise(`${s.title} ${s.artist || ""}`).includes(q)) return false;
    return true;
  }).sort((a, b) => Number(b.hasTracks) - Number(a.hasTracks)); // what's ready first, coming soon after
}

// Difficulty options come from the songs themselves (Song.level is free text).
export function levelsIn(songs) {
  return [...new Set(songs.map((s) => s.level).filter(Boolean))].sort();
}

export function formatClock(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatWhen(iso) {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
