// The chord and scale library's API (backend/src/routes/chordLibrary.routes.js) and the small
// helpers the page needs to read what it sends. The server decides which instrument a member
// gets; the page only ever shows what came back.
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export class LibraryError extends Error {
  constructor(message, status, reason) {
    super(message);
    this.status = status;
    this.reason = reason || null;
  }
}

// Answers are the same for the whole visit, so each is fetched once.
const cache = new Map();

export function libraryRequest(path, instrument) {
  const query = instrument ? `?instrument=${encodeURIComponent(instrument)}` : "";
  const url = `${API_URL}/chord-library${path}${query}`;
  if (!cache.has(url)) {
    const request = (async () => {
      let res;
      try {
        res = await fetch(url, { credentials: "include" });
      } catch {
        throw new LibraryError("You're offline. Check your connection and try again.", 0, "offline");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new LibraryError(data.error || `Request failed (${res.status})`, res.status, data.reason);
      return data;
    })();
    cache.set(url, request);
    // A failure shouldn't stick: the next try asks again.
    request.catch(() => cache.delete(url));
  }
  return cache.get(url);
}

// { data, error } for one library request, both null while it loads. An answer is kept with the
// request it answers, so a slow reply for an earlier root never shows under a later one.
export function useLibrary(path, instrument, attempt = 0) {
  const key = `${instrument || ""}|${path}|${attempt}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    let live = true;
    libraryRequest(path, instrument).then(
      (data) => live && setResult({ key, data, error: null }),
      (error) => live && setResult({ key, data: null, error })
    );
    return () => {
      live = false;
    };
  }, [key, path, instrument]);
  return result.key === key ? result : { key, data: null, error: null };
}

// "0:maj/11" -> { root: 0, quality: "maj", bass: 11 }
export function parseChordId(id) {
  const m = /^(\d+):([^/]+)(?:\/(\d+))?$/.exec(id || "");
  if (!m) return null;
  return { root: Number(m[1]), quality: m[2], bass: m[3] === undefined ? null : Number(m[3]) };
}

export const chordIdOf = (root, quality, bass = null) => `${root}:${quality}${bass === null ? "" : `/${bass}`}`;

export const mod12 = (n) => ((n % 12) + 12) % 12;

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// A note's name from a MIDI number, using the spelling the chord or scale gave for that pitch.
export function noteName(midi, spelled) {
  return spelled?.get(mod12(midi)) || SHARPS[mod12(midi)];
}

// pc -> name, and pc -> interval, from a chord's or scale's note list.
export function spellings(notes) {
  return new Map((notes || []).map((n) => [n.pc, n.name]));
}
export function intervalsOf(notes) {
  return new Map((notes || []).map((n) => [n.pc, n.interval === "1" ? "R" : n.interval]));
}

// Semitones in each interval the library names, for the sounds the page makes itself.
export const SEMITONES = { 1: 0, b2: 1, 2: 2, b3: 3, 3: 4, 4: 5, "#4": 6, b5: 6, 5: 7, "#5": 8, b6: 8, 6: 9, bb7: 9, b7: 10, 7: 11, b9: 13, 9: 14, "#9": 15, 11: 17, 13: 21 };

// A plain close voicing near middle C, for hearing a progression on any instrument.
export function simpleVoicing(id, qualities) {
  const chord = parseChordId(id);
  const q = qualities.find((x) => x.id === chord.quality);
  const bottom = 55 + mod12(chord.root - 55);
  const right = q.intervals.map((i) => bottom + SEMITONES[i.interval]).filter((m, i, all) => all.indexOf(m) === i);
  const bass = 43 + mod12((chord.bass ?? chord.root) - 43);
  return [bass, ...right];
}

export const ordinalFret = (n) => (n === 0 ? "open" : `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"} fret`);
