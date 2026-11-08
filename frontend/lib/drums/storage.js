// What the beat maker keeps in this browser's localStorage, one set per person (signed-in members
// get their own key, like the metronome's presets): the beat being worked on, the saved beats,
// and this browser's own settings (the mix, the view, the click). Nothing is synced to the
// account yet.
//
// Storage can be missing (private windows), full, or holding something damaged. None of that
// breaks the page: it falls back to memory for this visit and says so once.
import { BEAT_VERSION, NAME_MAX, cleanName, sanitizeBeat } from "./beat.js";
import { PIECE_IDS } from "./kit.js";
import { DEFAULT_MIDI_PREFS, sanitizeMidiPrefs } from "./midiInput.js";

export const MAX_SAVED = 50;
const PREFIX = "rw-beats";

export const keyFor = (scope, what) => `${PREFIX}:v${BEAT_VERSION}:${scope}:${what}`;

// Who the saved data belongs to. No name or email, only the account's id.
export function scopeFor(user) {
  return user?.id ? `user:${user.id}` : "guest";
}

export function browserStorage() {
  try {
    const s = window.localStorage;
    const probe = `${PREFIX}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function read(storage, key) {
  if (!storage) return undefined;
  try {
    const text = storage.getItem(key);
    return text ? JSON.parse(text) : undefined;
  } catch {
    return null; // there, but damaged
  }
}

function write(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_PREFS = {
  view: null, // "grid" or "pads"; null picks by screen size
  click: false,
  volume: 0.9,
  mix: {}, // piece -> volume 0..1.5
  muted: [], // pieces muted in the mix
  introDone: false,
  midi: DEFAULT_MIDI_PREFS, // reconnect on the next visit? and any notes changed by hand
};

export function sanitizePrefs(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const mix = {};
  for (const id of PIECE_IDS) {
    const v = Number(p.mix?.[id]);
    if (Number.isFinite(v) && v >= 0 && v <= 1.5 && v !== 1) mix[id] = Math.round(v * 100) / 100;
  }
  const volume = Number(p.volume);
  return {
    view: p.view === "grid" || p.view === "pads" ? p.view : null,
    click: p.click === true,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_PREFS.volume,
    mix,
    muted: Array.isArray(p.muted) ? PIECE_IDS.filter((id) => p.muted.includes(id)) : [],
    introDone: p.introDone === true,
    midi: sanitizeMidiPrefs(p.midi),
  };
}

function cleanSaved(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const ids = new Set();
  for (const item of list) {
    if (out.length >= MAX_SAVED || !item || typeof item !== "object") continue;
    const name = cleanName(item.name);
    if (!name || typeof item.id !== "string" || !item.id || ids.has(item.id)) continue;
    ids.add(item.id);
    out.push({ id: item.id, name, beat: sanitizeBeat(item.beat), updatedAt: Number(item.updatedAt) || 0 });
  }
  return out;
}

// Opens everything for `scope`. `notice` is one sentence about anything that went wrong.
export function openBeatStore(scope, storage) {
  const keys = { current: keyFor(scope, "current"), saved: keyFor(scope, "saved"), prefs: keyFor(scope, "prefs") };
  let notice = storage ? null : "This browser isn't letting the site save anything, so your beats will only last until you leave the page.";
  const current = read(storage, keys.current);
  const saved = read(storage, keys.saved);
  const prefs = read(storage, keys.prefs);
  if (current === null || saved === null) notice = "Some saved beats couldn't be read in this browser and were left out.";
  let persistent = Boolean(storage);
  const tryWrite = (key, value) => {
    if (!persistent) return false;
    const ok = write(storage, key, value);
    if (!ok) {
      persistent = false;
      notice = "This browser stopped letting the site save, so changes from now on will only last until you leave the page.";
    }
    return ok;
  };
  return {
    get notice() {
      return notice;
    },
    get persistent() {
      return persistent;
    },
    current: current ? sanitizeBeat(current) : null,
    saved: cleanSaved(saved),
    prefs: sanitizePrefs(prefs),
    saveCurrent: (beat) => tryWrite(keys.current, beat),
    saveList: (list) => tryWrite(keys.saved, list),
    savePrefs: (p) => tryWrite(keys.prefs, p),
  };
}

export function makeSavedId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export { NAME_MAX };
