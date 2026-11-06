// The metronome's settings: one plain, versioned object that the engine, presets and share links
// all use. `sanitizeConfig` turns anything (old storage, a hand-edited link) into a valid config,
// and the setters below keep the related fields consistent when one of them changes.
import {
  MAX_BEATS,
  NOTES,
  cellsOf,
  convertTempo,
  defaultAccents,
  defaultGroups,
  defaultPulse,
  defaultSubdivision,
  groupsLabel,
  meterLabel,
  pulseNote,
  pulseOptions,
  subdivisionOptions,
  swingApplies,
  validGroups,
} from "./rhythm.js";
import { VOICES } from "./sounds.js";

export const CONFIG_VERSION = 1;
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;
// Twenty clicks a second. Faster than that, clicks blur into a buzz and stop being countable.
export const MAX_CLICKS_PER_MINUTE = 1200;
export const ACCENTS = ["strong", "normal", "silent"];
export const VOICE_IDS = VOICES.map((v) => v.id);
export const TRAINING_MODES = ["off", "builder", "silent"];
export const POLY_NOTES = [2, 3, 4, 5, 6, 7, 8, 9];
export const SWING_STRAIGHT = 50;
export const SWING_TRIPLET = 67; // 2:1, the triplet feel (66.7%, shown rounded)
export const SWING_MAX = 75;
export const TIMER_MAX_MINUTES = 120;

export const DEFAULT_CONFIG = Object.freeze({
  v: CONFIG_VERSION,
  tempo: 96,
  meter: { beats: 4, unit: 4, groups: [4], pulse: "count" },
  subdivision: 1,
  accents: ["strong", "normal", "normal", "normal"],
  sound: { voice: "wood", subVolume: 0.6 },
  practice: { countIn: 0, timerMinutes: 0, timerEnd: "stop" },
  training: {
    mode: "off",
    builder: { start: 60, target: 100, step: 5, bars: 8, atTarget: "hold" },
    silent: { play: 2, rest: 2, showCues: true },
  },
  advanced: { swing: SWING_STRAIGHT, poly: { on: false, notes: 3, voice: "clave", volume: 0.7 } },
});

// What belongs to this device rather than to an exercise. Remembered, never shared or put in a preset.
export const DEFAULT_PREFS = Object.freeze({ volume: 0.8, visualOnly: false });

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function int(value, min, max, fallback) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function unit01(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

// Turns anything into a valid config. Unknown fields are dropped; missing or out-of-range ones
// fall back to the defaults, so a damaged preset still opens as something playable.
export function sanitizeConfig(raw) {
  const src = isObject(raw) ? raw : {};
  const d = DEFAULT_CONFIG;

  // A meter outside the range is damage, not a request, so it falls back instead of clamping.
  const m = isObject(src.meter) ? src.meter : {};
  const unit = m.unit === 8 || m.unit === 4 ? m.unit : d.meter.unit;
  const beats = Number.isInteger(m.beats) && m.beats >= 1 && m.beats <= MAX_BEATS ? m.beats : unit === d.meter.unit ? d.meter.beats : 6;
  const groups = validGroups(m.groups, beats) ? [...m.groups] : defaultGroups(beats, unit);
  const shape = { beats, unit, groups, pulse: "count" };
  const meter = { ...shape, pulse: oneOf(m.pulse, pulseOptions(shape), defaultPulse(shape)) };
  const cellCount = cellsOf(meter).length;

  const accents =
    Array.isArray(src.accents) && src.accents.length === cellCount && src.accents.every((a) => ACCENTS.includes(a))
      ? [...src.accents]
      : defaultAccents(meter);

  const subs = subdivisionOptions(meter).map((o) => o.n);
  const subdivision = subs.includes(src.subdivision) ? src.subdivision : defaultSubdivision(meter);

  const s = isObject(src.sound) ? src.sound : {};
  const sound = { voice: oneOf(s.voice, VOICE_IDS, d.sound.voice), subVolume: unit01(s.subVolume, d.sound.subVolume) };

  const p = isObject(src.practice) ? src.practice : {};
  const practice = {
    countIn: oneOf(p.countIn, [0, 1, 2], d.practice.countIn),
    timerMinutes: int(p.timerMinutes, 0, TIMER_MAX_MINUTES, 0),
    timerEnd: oneOf(p.timerEnd, ["stop", "continue"], d.practice.timerEnd),
  };

  const t = isObject(src.training) ? src.training : {};
  const b = isObject(t.builder) ? t.builder : {};
  const sl = isObject(t.silent) ? t.silent : {};
  const training = {
    mode: oneOf(t.mode, TRAINING_MODES, "off"),
    builder: {
      start: int(b.start, TEMPO_MIN, TEMPO_MAX, d.training.builder.start),
      target: int(b.target, TEMPO_MIN, TEMPO_MAX, d.training.builder.target),
      step: int(b.step, 1, 50, d.training.builder.step),
      bars: int(b.bars, 1, 64, d.training.builder.bars),
      atTarget: oneOf(b.atTarget, ["hold", "stop"], d.training.builder.atTarget),
    },
    silent: {
      play: int(sl.play, 1, 16, d.training.silent.play),
      rest: int(sl.rest, 1, 16, d.training.silent.rest),
      showCues: typeof sl.showCues === "boolean" ? sl.showCues : d.training.silent.showCues,
    },
  };

  const a = isObject(src.advanced) ? src.advanced : {};
  const po = isObject(a.poly) ? a.poly : {};
  const advanced = {
    swing: int(a.swing, SWING_STRAIGHT, SWING_MAX, SWING_STRAIGHT),
    poly: {
      on: po.on === true,
      notes: oneOf(po.notes, POLY_NOTES, d.advanced.poly.notes),
      voice: oneOf(po.voice, VOICE_IDS, d.advanced.poly.voice),
      volume: unit01(po.volume, d.advanced.poly.volume),
    },
  };

  const config = { v: CONFIG_VERSION, tempo: 0, meter, subdivision, accents, sound, practice, training, advanced };
  const top = maxTempo(config);
  config.tempo = Math.min(top, int(src.tempo, TEMPO_MIN, TEMPO_MAX, d.tempo));
  config.training.builder.start = Math.min(top, config.training.builder.start);
  config.training.builder.target = Math.min(top, config.training.builder.target);
  return config;
}

export function sanitizePrefs(raw) {
  const src = isObject(raw) ? raw : {};
  return { volume: unit01(src.volume, DEFAULT_PREFS.volume), visualOnly: src.visualOnly === true };
}

export function cloneConfig(config) {
  return sanitizeConfig(JSON.parse(JSON.stringify(config)));
}

// The fastest tempo that keeps every layer at or under twenty clicks a second.
export function maxTempo(config, subdivision = config.subdivision) {
  const polyOn = config.advanced?.poly?.on;
  let top = Math.floor(MAX_CLICKS_PER_MINUTE / (polyOn ? 1 : subdivision));
  if (polyOn) top = Math.min(top, Math.floor((MAX_CLICKS_PER_MINUTE * cellsOf(config.meter).length) / config.advanced.poly.notes));
  return Math.min(TEMPO_MAX, top);
}

// ---- Setters. Each returns { config, notice }, where notice explains a side effect in words. ----

export function setTempo(config, bpm) {
  return { config: sanitizeConfig({ ...config, tempo: bpm }), notice: null };
}

const noteWord = (note) => NOTES[note].plural;

// Keeps the music at the same speed when the note the BPM counts changes, and says so.
function retime(prev, next) {
  const from = pulseNote(prev.meter);
  const to = pulseNote(next.meter);
  if (from === to) return { config: next, notice: null };
  const exact = convertTempo(prev.tempo, from, to);
  const top = maxTempo(next);
  const tempo = Math.min(top, Math.max(TEMPO_MIN, Math.round(exact)));
  const config = sanitizeConfig({ ...next, tempo });
  let notice = `The tempo now counts ${noteWord(to)}. ${config.tempo} is the same speed as ${prev.tempo} ${noteWord(from)}.`;
  if (Math.abs(tempo - exact) >= 1) {
    notice = `The tempo now counts ${noteWord(to)}. ${config.tempo} is as close as the metronome goes to ${prev.tempo} ${noteWord(from)}.`;
  }
  return { config, notice };
}

// A new time signature resets the grouping, the beat and the accents to that meter's own.
export function setMeter(config, beats, unit, groups) {
  const shape = { beats, unit, groups: validGroups(groups, beats) ? groups : defaultGroups(beats, unit), pulse: "count" };
  const meter = { ...shape, pulse: defaultPulse(shape) };
  const sameNote = pulseNote(meter) === pulseNote(config.meter);
  const subdivision = sameNote ? config.subdivision : defaultSubdivision(meter);
  const next = sanitizeConfig({ ...config, meter, accents: defaultAccents(meter), subdivision });
  return retime(config, next);
}

// Count the same meter in a different note (6/8 in two dotted quarters, or in six eighths).
export function setPulse(config, pulse) {
  if (!pulseOptions(config.meter).includes(pulse) || pulse === config.meter.pulse) return { config, notice: null };
  const meter = { ...config.meter, pulse };
  const next = sanitizeConfig({ ...config, meter, accents: defaultAccents(meter), subdivision: defaultSubdivision(meter) });
  return retime(config, next);
}

export function setGroups(config, groups) {
  if (!validGroups(groups, config.meter.beats)) return { config, notice: null };
  const shape = { ...config.meter, groups, pulse: "count" };
  const pulse = pulseOptions(shape).includes(config.meter.pulse) ? config.meter.pulse : defaultPulse(shape);
  const meter = { ...shape, pulse };
  const sameNote = pulseNote(meter) === pulseNote(config.meter);
  const next = sanitizeConfig({
    ...config,
    meter,
    accents: defaultAccents(meter),
    subdivision: sameNote ? config.subdivision : defaultSubdivision(meter),
  });
  return retime(config, next);
}

export function setSubdivision(config, n) {
  return { config: sanitizeConfig({ ...config, subdivision: n }), notice: null };
}

const NEXT_ACCENT = { strong: "normal", normal: "silent", silent: "strong" };

// Strong, then Normal, then Silent, then Strong again.
export function cycleAccent(config, index) {
  const accents = config.accents.map((a, i) => (i === index ? NEXT_ACCENT[a] : a));
  return { config: { ...config, accents }, notice: null };
}

export function setAccent(config, index, level) {
  if (!ACCENTS.includes(level)) return { config, notice: null };
  const accents = config.accents.map((a, i) => (i === index ? level : a));
  return { config: { ...config, accents }, notice: null };
}

// Sets one nested field ("training.builder.start") and re-validates everything.
export function setField(config, path, value) {
  const keys = path.split(".");
  const copy = JSON.parse(JSON.stringify(config));
  let node = copy;
  for (const key of keys.slice(0, -1)) {
    if (!isObject(node[key])) node[key] = {};
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
  return { config: sanitizeConfig(copy), notice: null };
}

// ---- What can be combined. Each answer says why, so a disabled control can explain itself. ----

export function subdivisionChoices(config) {
  const polyOn = config.advanced.poly.on;
  return subdivisionOptions(config.meter).map((option) => {
    if (polyOn && option.n !== 1) {
      return { ...option, disabled: true, reason: "Off while the polyrhythm plays, so the two layers stay clear." };
    }
    const top = Math.floor(MAX_CLICKS_PER_MINUTE / option.n);
    if (config.tempo > top) {
      return { ...option, disabled: true, reason: `Too many clicks to hear apart at this tempo. Go to ${top} or slower first.` };
    }
    return { ...option, disabled: false, reason: null };
  });
}

export function swingState(config) {
  if (config.advanced.poly.on) {
    return { available: false, reason: "Swing is off while a polyrhythm plays, so both layers stay even." };
  }
  if (pulseNote(config.meter) === "dotted-quarter") {
    return { available: false, reason: `Each beat of ${meterLabel(config.meter)} already holds three eighths, which is the swung feel. Swing needs beats split in two.` };
  }
  if (!swingApplies(config.meter, config.subdivision)) {
    const pair = pulseNote(config.meter) === "eighth" ? "Sixteenths (2 per beat)" : "Eighths (2 per beat) or Sixteenths";
    return { available: false, reason: `Swing moves the second note of each pair. Choose ${pair} under Subdivision to use it.` };
  }
  return { available: true, reason: null };
}

export function polyChoices(config) {
  const cells = cellsOf(config.meter).length;
  return POLY_NOTES.map((notes) => {
    if (notes === cells) {
      return { notes, disabled: true, reason: `Your bar already has ${cells} beats, so ${notes} would just double them.` };
    }
    const top = Math.floor((MAX_CLICKS_PER_MINUTE * cells) / notes);
    if (config.tempo > top) return { notes, disabled: true, reason: `Too fast at this tempo. Go to ${top} or slower first.` };
    return { notes, disabled: false, reason: null };
  });
}

// What the engine actually plays, after the combinations above are resolved.
export function effective(config) {
  const polyOn = config.advanced.poly.on && config.advanced.poly.notes !== cellsOf(config.meter).length;
  const subdivision = polyOn ? 1 : config.subdivision;
  const swing = !polyOn && swingApplies(config.meter, subdivision) ? config.advanced.swing : SWING_STRAIGHT;
  return { ...config, subdivision, swing, polyNotes: polyOn ? config.advanced.poly.notes : 0 };
}

// A short line for preset lists: "7/8 (2+2+3) · 200 eighths · Sixteenths · Silent bars".
export function describeConfig(config) {
  const parts = [];
  const groups = config.meter.groups.length > 1 && config.meter.pulse === "count" ? ` (${groupsLabel(config.meter.groups)})` : "";
  parts.push(`${meterLabel(config.meter)}${groups}`);
  parts.push(`${config.tempo} ${NOTES[pulseNote(config.meter)].plural}`);
  const sub = subdivisionOptions(config.meter).find((o) => o.n === config.subdivision);
  if (sub && sub.n !== 1 && !config.advanced.poly.on) parts.push(sub.name);
  if (config.advanced.poly.on) parts.push(`${config.advanced.poly.notes} against ${cellsOf(config.meter).length}`);
  else if (config.advanced.swing > SWING_STRAIGHT && swingApplies(config.meter, config.subdivision)) parts.push(`Swing ${config.advanced.swing}%`);
  if (config.training.mode === "builder") {
    const b = config.training.builder;
    parts.push(`Tempo builder ${b.start} to ${b.target}`);
  }
  if (config.training.mode === "silent") parts.push(`${config.training.silent.play} on, ${config.training.silent.rest} silent`);
  return parts.join(" · ");
}
