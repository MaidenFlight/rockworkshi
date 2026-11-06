// Saved presets and the last setup, kept in this browser's localStorage, one list per person:
// signed-in students get their own key, everyone else shares a guest key. Nothing here is synced
// to the account yet. Each preset records where it came from (`source`), so presets from the
// account, a lesson or an assignment can join the same list later without touching the engine.
//
// Storage can be missing (private windows, blocked cookies), full, or holding something damaged.
// None of those break the metronome: it falls back to memory for this visit and says so.
import { DEFAULT_CONFIG, sanitizeConfig, sanitizePrefs } from "./config.js";

export const STORE_VERSION = 1;
export const MAX_PRESETS = 50;
export const NAME_MAX = 60;
const KEY_PREFIX = "rw-metronome";

export function storageKey(scope) {
  return `${KEY_PREFIX}:v${STORE_VERSION}:${scope}`;
}

// Who the saved data belongs to. No name or email, only the account's id.
export function scopeFor(user) {
  return user?.id ? `user:${user.id}` : "guest";
}

export function cleanName(name) {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function cleanPreset(raw) {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const name = cleanName(raw.name);
  if (!name || !isObject(raw.config)) return null;
  return {
    id: raw.id,
    name,
    config: sanitizeConfig(raw.config),
    source: "local",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

// The browser's localStorage, if it can actually be written. Some browsers throw on access.
export function browserStorage() {
  try {
    const s = window.localStorage;
    const probe = `${KEY_PREFIX}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

// Opens the saved data for `scope`. `notice` explains, in a sentence, anything that had to be
// recovered; `persistent` is false when nothing will outlive this visit.
export function openStore(scope, storage) {
  const key = storageKey(scope);
  const state = { presets: [], last: null, notice: null, persistent: Boolean(storage) };
  if (!storage) {
    state.notice = "This browser isn't letting the site save anything, so presets will only last until you leave the page.";
    return makeStore(state, null, key);
  }
  let text = null;
  try {
    text = storage.getItem(key);
  } catch {
    state.persistent = false;
    state.notice = "Saved presets couldn't be read in this browser, so they will only last until you leave the page.";
    return makeStore(state, null, key);
  }
  if (text) {
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!isObject(data) || !Array.isArray(data.presets)) {
      // Keep the damaged copy beside the real key rather than destroying it, then start clean.
      try {
        storage.setItem(`${key}:damaged`, text);
      } catch {
        // No room to keep it; starting clean matters more.
      }
      state.notice = "Your saved metronome settings were damaged and couldn't be read, so the list has started again.";
    } else {
      const presets = data.presets.map(cleanPreset).filter(Boolean).slice(0, MAX_PRESETS);
      const lost = data.presets.length - presets.length;
      state.presets = presets;
      if (isObject(data.last) && isObject(data.last.config)) {
        state.last = { config: sanitizeConfig(data.last.config), prefs: sanitizePrefs(data.last.prefs) };
      }
      if (lost > 0) state.notice = `${lost === 1 ? "One saved preset was" : `${lost} saved presets were`} damaged and couldn't be opened.`;
    }
  }
  return makeStore(state, storage, key);
}

function makeStore(state, storage, key) {
  let backing = storage;
  const listeners = new Set();
  let snapshot = { ...state };

  function emit() {
    snapshot = { ...state, presets: [...state.presets] };
    listeners.forEach((fn) => fn());
  }

  // Writes everything back. If the browser refuses, the store carries on in memory and says so.
  function flush() {
    if (!backing) return true;
    try {
      backing.setItem(key, JSON.stringify({ v: STORE_VERSION, presets: state.presets, last: state.last }));
      return true;
    } catch {
      backing = null;
      state.persistent = false;
      state.notice = "This browser's storage is full or blocked, so changes will only last until you leave the page.";
      return false;
    }
  }

  function change(mutate) {
    mutate();
    flush();
    emit();
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    // Saves the current setup under a name. Returns the new preset, or null when it can't.
    save(name, config) {
      const clean = cleanName(name);
      if (!clean || state.presets.length >= MAX_PRESETS) return null;
      const now = Date.now();
      const preset = { id: makeId(), name: clean, config: sanitizeConfig(config), source: "local", createdAt: now, updatedAt: now };
      change(() => {
        state.presets = [preset, ...state.presets];
      });
      return preset;
    },
    rename(id, name) {
      const clean = cleanName(name);
      if (!clean) return false;
      change(() => {
        state.presets = state.presets.map((p) => (p.id === id ? { ...p, name: clean, updatedAt: Date.now() } : p));
      });
      return true;
    },
    // Replaces a preset's settings with the current ones, keeping its name.
    overwrite(id, config) {
      change(() => {
        state.presets = state.presets.map((p) => (p.id === id ? { ...p, config: sanitizeConfig(config), updatedAt: Date.now() } : p));
      });
    },
    duplicate(id) {
      const original = state.presets.find((p) => p.id === id);
      if (!original || state.presets.length >= MAX_PRESETS) return null;
      const now = Date.now();
      const copy = { ...original, id: makeId(), name: cleanName(`${original.name} (copy)`), createdAt: now, updatedAt: now };
      change(() => {
        const at = state.presets.findIndex((p) => p.id === id);
        state.presets = [...state.presets.slice(0, at + 1), copy, ...state.presets.slice(at + 1)];
      });
      return copy;
    },
    remove(id) {
      change(() => {
        state.presets = state.presets.filter((p) => p.id !== id);
      });
    },
    // Puts a removed preset back where it was (for Undo).
    restore(preset, index) {
      if (!preset || state.presets.some((p) => p.id === preset.id)) return;
      change(() => {
        const at = Math.max(0, Math.min(index, state.presets.length));
        state.presets = [...state.presets.slice(0, at), preset, ...state.presets.slice(at)];
      });
    },
    // The setup to reopen next time. Never plays by itself; it only fills the controls.
    saveLast(config, prefs) {
      state.last = { config: sanitizeConfig(config), prefs: sanitizePrefs(prefs) };
      if (flush()) return;
      emit();
    },
    dismissNotice() {
      state.notice = null;
      emit();
    },
  };
}

// Built-in starting points. They're exercises, not levels: nothing here claims to know how good
// anyone is. Loading one fills the controls, and everything stays editable.
const exercise = (id, name, description, patch) => ({ id, name, description, config: sanitizeConfig(merge(DEFAULT_CONFIG, patch)) });

function merge(base, patch) {
  if (!isObject(base) || !isObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = merge(base[k], v);
  return out;
}

export const STARTER_EXERCISES = [
  exercise("steady-quarters", "Steady quarter notes", "One even note on every click, with a bar of count-in. Start slow and stay relaxed.", {
    tempo: 70,
    practice: { countIn: 1 },
  }),
  exercise("eighth-counting", "Eighth-note counting", "Count out loud with the clicks: one and two and. The quieter clicks are the ands.", {
    tempo: 72,
    subdivision: 2,
    practice: { countIn: 1 },
  }),
  exercise("triplets", "Triplet practice", "Three even notes in every beat: one trip-let, two trip-let.", {
    tempo: 66,
    subdivision: 3,
    practice: { countIn: 1 },
  }),
  exercise("speed-building", "Gradual speed building", "Starts at 60 and goes up 5 every 8 bars, then stops after 8 bars at 100.", {
    tempo: 60,
    practice: { countIn: 1 },
    training: { mode: "builder", builder: { start: 60, target: 100, step: 5, bars: 8, atTarget: "stop" } },
  }),
  exercise("two-on-two-off", "Two bars on, two bars silent", "Keep the beat going through the silent bars. When the click comes back, you should land right on beat 1.", {
    tempo: 80,
    practice: { countIn: 1 },
    training: { mode: "silent", silent: { play: 2, rest: 2, showCues: true } },
  }),
  exercise("backbeat", "Backbeat in 4/4", "Strong clicks on 2 and 4, where the snare drum hits in most rock songs.", {
    tempo: 90,
    accents: ["normal", "strong", "normal", "strong"],
    subdivision: 2,
    sound: { subVolume: 0.35 },
  }),
];
