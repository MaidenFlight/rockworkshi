import { File, Paths } from "expo-file-system";
import type { Effects } from "@/lib/audio/takeEffects";
import type { Mix, Mode } from "@/lib/audio/mix";

// The student's practice library. Search and filter rules match the website's
// (frontend/lib/practice.js). Keep the two in step.

export type LibrarySong = {
  id: string;
  title: string;
  artist: string | null;
  level: string | null;
  parts: string[];
  hasTracks: boolean;
  favorite: boolean;
  hasNotes: boolean;
  lastOpenedAt: string | null;
  locked?: boolean; // a term song that hasn't opened for this student
};

export type ContinueItem = { song: LibrarySong; position: number | null; lastOpenedAt: string };
export type Library = { songs: LibrarySong[]; continue: ContinueItem | null; savedAt?: string };

// Resume state as the API stores it (backend/src/lib/practice.js).
export type SessionMixer = Mix & { mode: Mode; focus: string | null; effects: Effects | null };
export type Session = {
  position?: number;
  speed?: number;
  loop?: { start: number; end: number | null } | null;
  mixer?: SessionMixer;
};
export type Practice = { favorite: boolean; notes: string | null; lastOpenedAt: string | null; session: Session | null };

export type Filters = { query: string; level: string; stems: string; favorites: boolean };
export const EMPTY_FILTERS: Filters = { query: "", level: "", stems: "any", favorites: false };

export const STEM_FILTERS = [
  { id: "any", label: "Any" },
  { id: "stems", label: "With stems" },
  { id: "Vocals", label: "Vocals" },
  { id: "Guitar", label: "Guitar" },
  { id: "Keys", label: "Keys" },
  { id: "Bass", label: "Bass" },
  { id: "Drums", label: "Drums" },
];

// Case- and accent-insensitive, so "beyonce" finds "Beyoncé".
function normalise(text: string | null) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filterSongs(songs: LibrarySong[], { query, level, stems, favorites }: Filters) {
  const q = normalise(query);
  return songs.filter((s) => {
    if (favorites && !s.favorite) return false;
    if (level && s.level !== level) return false;
    if (stems === "stems" && !s.hasTracks) return false;
    if (stems !== "any" && stems !== "stems" && !s.parts.includes(stems)) return false;
    if (q && !normalise(`${s.title} ${s.artist || ""}`).includes(q)) return false;
    return true;
  });
}

// Difficulty options come from the songs themselves (Song.level is free text).
export function levelsIn(songs: LibrarySong[]) {
  return [...new Set(songs.map((s) => s.level).filter((l): l is string => Boolean(l)))].sort();
}

export function formatClock(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The last good library response, per user, so the screen still shows something offline.
function cacheFile(userId: string) {
  return new File(Paths.cache, `library-${userId}.json`);
}

export function readLibraryCache(userId: string): Library | null {
  try {
    const file = cacheFile(userId);
    return file.exists ? (JSON.parse(file.textSync()) as Library) : null;
  } catch {
    return null;
  }
}

export async function writeLibraryCache(userId: string, library: Library) {
  try {
    const file = cacheFile(userId);
    file.create({ overwrite: true });
    await file.write(JSON.stringify({ ...library, savedAt: new Date().toISOString() }));
  } catch {
    // The screen works without the cache.
  }
}
