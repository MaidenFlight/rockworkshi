// A beat: a tempo, a meter, a few one-bar parts (Verse, Chorus, Fill...) and a song that strings
// them together. Plain data, so it can be saved, shared in a link and tested; every edit returns a
// new beat and leaves the old one alone (that is what Undo keeps).
//
//   notes: { [piece]: [level per step] }, one bar long, levels from kit.js (0 off .. 3 accent)
//   song:  [{ id, part, bars, crash }]  `bars` repeats of the part; `crash` hits the crash on its 1
import { GRID_ORDER, LEVEL, PIECE_BY_ID } from "./kit.js";

export const BEAT_VERSION = 1;
export const TEMPO_MIN = 40;
export const TEMPO_MAX = 240;
export const MAX_PARTS = 8;
export const MAX_BLOCKS = 32;
export const MAX_BLOCK_BARS = 16;
export const NAME_MAX = 40;

// `division`: grid steps per beat. 4/4 and 3/4 are written in sixteenths; 12/8 and 6/8 in
// eighth-note triplets, felt in dotted-quarter beats (so the shuffle is in the grid itself).
export const METERS = {
  "4/4": { id: "4/4", beats: 4, division: 4, pulse: "quarter", name: "4/4", detail: "Rock, pop, funk" },
  "3/4": { id: "3/4", beats: 3, division: 4, pulse: "quarter", name: "3/4", detail: "Waltz" },
  "12/8": { id: "12/8", beats: 4, division: 3, pulse: "dotted", name: "12/8", detail: "Shuffle, blues" },
  "6/8": { id: "6/8", beats: 2, division: 3, pulse: "dotted", name: "6/8", detail: "Ballad in two" },
};
export const METER_IDS = Object.keys(METERS);

export const meterOf = (beat) => METERS[beat?.meter] || METERS["4/4"];
export const stepsPerBar = (meter) => meter.beats * meter.division;

// Swing is only offered where the grid is in pairs; the triplet meters already swing.
export const canSwing = (meter) => meter.division % 2 === 0;

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const clampTempo = (v, fallback = 100) => clampInt(v, TEMPO_MIN, TEMPO_MAX, fallback);

export function cleanName(name, fallback = "") {
  const s = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";
  return s || fallback;
}

let idCounter = 0;
export function makeId(prefix = "p") {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}${Date.now().toString(36).slice(-4)}${rand}${idCounter}`;
}

// ---- Where each step falls ----

// Each step's place inside its beat, in beats (0 up to 1). Straight sixteenths are 0, .25, .5,
// .75. Swing (0-100) moves the off-beats late: on the eighths it pushes the "&" toward the
// triplet (and beyond at 100), carrying the "e" and "a" with it; on the sixteenths it pushes the
// "e" and "a". 67 is a triplet feel.
export function stepOffsets(meter, swing = 0, swingUnit = 8) {
  const d = meter.division;
  const straight = Array.from({ length: d }, (_, i) => i / d);
  if (!canSwing(meter) || !swing) return straight;
  const r = 0.5 + 0.25 * Math.min(100, Math.max(0, swing)) / 100; // where the late note of a pair lands
  if (d === 4 && swingUnit === 8) return [0, r / 2, r, r + (1 - r) / 2];
  // Sixteenth swing (and any other even grid): every second step is late within its pair.
  return straight.map((x, i) => (i % 2 ? x - 1 / d + (2 / d) * r : x));
}

// ---- Notes ----

export function emptyNotes() {
  return {};
}

// A level at a step (0 when there's none).
export function noteAt(part, piece, step) {
  return part?.notes?.[piece]?.[step] || 0;
}

// Sets one note. A level of 0 removes it; a piece left with no notes is dropped.
export function withNote(notes, piece, step, level, steps) {
  const row = notes[piece] ? [...notes[piece]] : new Array(steps).fill(0);
  if ((row[step] || 0) === level) return notes;
  row[step] = level;
  const next = { ...notes };
  if (row.some(Boolean)) next[piece] = row;
  else delete next[piece];
  return next;
}

export function isEmptyNotes(notes) {
  return !Object.values(notes || {}).some((row) => row.some(Boolean));
}

export function countNotes(notes) {
  return Object.values(notes || {}).reduce((n, row) => n + row.filter(Boolean).length, 0);
}

// Moves notes onto another meter's grid by where they fall in the bar, counted in beats. Notes
// past the end of a shorter bar are dropped; two landing on one step keep the louder.
export function remapNotes(notes, from, to) {
  const out = {};
  const toSteps = stepsPerBar(to);
  for (const [piece, row] of Object.entries(notes || {})) {
    const next = new Array(toSteps).fill(0);
    row.forEach((level, step) => {
      if (!level) return;
      const target = Math.round((step / from.division) * to.division);
      if (target >= toSteps) return;
      next[target] = Math.max(next[target], level);
    });
    if (next.some(Boolean)) out[piece] = next;
  }
  return out;
}

// ---- Beats ----

export function newPart(name, notes = {}) {
  return { id: makeId("p"), name: cleanName(name, "Part"), notes };
}

export function blankBeat() {
  const part = newPart("Groove 1");
  return { v: BEAT_VERSION, name: "", tempo: 100, meter: "4/4", swing: 0, swingUnit: 8, parts: [part], song: [] };
}

export const partById = (beat, id) => beat.parts.find((p) => p.id === id) || null;

function setPart(beat, id, fn) {
  let changed = false;
  const parts = beat.parts.map((p) => {
    if (p.id !== id) return p;
    const next = fn(p);
    if (next !== p) changed = true;
    return next;
  });
  return changed ? { ...beat, parts } : beat;
}

export function setNote(beat, partId, piece, step, level) {
  if (!PIECE_BY_ID[piece]) return beat;
  const steps = stepsPerBar(meterOf(beat));
  if (step < 0 || step >= steps) return beat;
  const lvl = clampInt(level, 0, 3, 0);
  return setPart(beat, partId, (p) => {
    const notes = withNote(p.notes, piece, step, lvl, steps);
    return notes === p.notes ? p : { ...p, notes };
  });
}

// Several notes at once (a drag across the grid, a recorded pass): [{ piece, step, level }].
export function setNotes(beat, partId, changes) {
  return changes.reduce((b, c) => setNote(b, partId, c.piece, c.step, c.level), beat);
}

export function replaceNotes(beat, partId, notes) {
  return setPart(beat, partId, (p) => ({ ...p, notes }));
}

export function clearPart(beat, partId) {
  return setPart(beat, partId, (p) => (isEmptyNotes(p.notes) ? p : { ...p, notes: {} }));
}

export function renamePart(beat, partId, name) {
  const clean = cleanName(name);
  if (!clean) return beat;
  return setPart(beat, partId, (p) => (p.name === clean ? p : { ...p, name: clean }));
}

// A name not yet used by a part: "Chorus", then "Chorus 2", ...
export function freshPartName(beat, base) {
  const taken = new Set(beat.parts.map((p) => p.name.toLowerCase()));
  const root = cleanName(base, "Part");
  if (!taken.has(root.toLowerCase())) return root;
  for (let i = 2; ; i += 1) {
    const name = cleanName(`${root.slice(0, NAME_MAX - 3)} ${i}`);
    if (!taken.has(name.toLowerCase())) return name;
  }
}

// Returns { beat, id }; the beat is unchanged (and id null) when it already has MAX_PARTS.
export function addPart(beat, name, notes = {}) {
  if (beat.parts.length >= MAX_PARTS) return { beat, id: null };
  const part = newPart(freshPartName(beat, name), notes);
  return { beat: { ...beat, parts: [...beat.parts, part] }, id: part.id };
}

export function duplicatePart(beat, partId) {
  const part = partById(beat, partId);
  if (!part) return { beat, id: null };
  const copy = Object.fromEntries(Object.entries(part.notes).map(([k, row]) => [k, [...row]]));
  return addPart(beat, `${part.name}`, copy);
}

// Removes a part and every song block that plays it. The last part can't go.
export function removePart(beat, partId) {
  if (beat.parts.length <= 1 || !partById(beat, partId)) return beat;
  return { ...beat, parts: beat.parts.filter((p) => p.id !== partId), song: beat.song.filter((b) => b.part !== partId) };
}

export function movePart(beat, partId, delta) {
  const i = beat.parts.findIndex((p) => p.id === partId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= beat.parts.length) return beat;
  const parts = [...beat.parts];
  [parts[i], parts[j]] = [parts[j], parts[i]];
  return { ...beat, parts };
}

export function setTempo(beat, tempo) {
  const t = clampTempo(tempo, beat.tempo);
  return t === beat.tempo ? beat : { ...beat, tempo: t };
}

export function setSwing(beat, swing, swingUnit = beat.swingUnit) {
  const s = clampInt(swing, 0, 100, 0);
  const u = swingUnit === 16 ? 16 : 8;
  return s === beat.swing && u === beat.swingUnit ? beat : { ...beat, swing: s, swingUnit: u };
}

// Changes the meter, moving every part's notes onto the new grid.
export function setMeter(beat, meterId) {
  const to = METERS[meterId];
  const from = meterOf(beat);
  if (!to || to.id === from.id) return beat;
  return { ...beat, meter: to.id, parts: beat.parts.map((p) => ({ ...p, notes: remapNotes(p.notes, from, to) })) };
}

export function setBeatName(beat, name) {
  const clean = cleanName(name);
  return clean === beat.name ? beat : { ...beat, name: clean };
}

// ---- The song ----

export function addBlock(beat, partId, bars = 4, at = beat.song.length) {
  if (!partById(beat, partId) || beat.song.length >= MAX_BLOCKS) return beat;
  const block = { id: makeId("b"), part: partId, bars: clampInt(bars, 1, MAX_BLOCK_BARS, 4), crash: false };
  const song = [...beat.song];
  song.splice(Math.min(Math.max(0, at), song.length), 0, block);
  return { ...beat, song };
}

function setBlock(beat, blockId, patch) {
  let changed = false;
  const song = beat.song.map((b) => {
    if (b.id !== blockId) return b;
    const next = { ...b, ...patch };
    if (Object.keys(patch).some((k) => next[k] !== b[k])) changed = true;
    return next;
  });
  return changed ? { ...beat, song } : beat;
}

export function setBlockBars(beat, blockId, bars) {
  return setBlock(beat, blockId, { bars: clampInt(bars, 1, MAX_BLOCK_BARS, 1) });
}

export function setBlockCrash(beat, blockId, crash) {
  return setBlock(beat, blockId, { crash: Boolean(crash) });
}

export function setBlockPart(beat, blockId, partId) {
  return partById(beat, partId) ? setBlock(beat, blockId, { part: partId }) : beat;
}

export function moveBlock(beat, blockId, delta) {
  const i = beat.song.findIndex((b) => b.id === blockId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= beat.song.length) return beat;
  const song = [...beat.song];
  [song[i], song[j]] = [song[j], song[i]];
  return { ...beat, song };
}

export function removeBlock(beat, blockId) {
  const song = beat.song.filter((b) => b.id !== blockId);
  return song.length === beat.song.length ? beat : { ...beat, song };
}

// The song bar by bar: [{ block, barInBlock, part, crash }]. `crash` is true on the first bar of a
// block that starts on a crash.
export function songBars(beat) {
  const out = [];
  beat.song.forEach((b, block) => {
    if (!partById(beat, b.part)) return;
    for (let i = 0; i < b.bars; i += 1) out.push({ block, barInBlock: i, part: b.part, crash: Boolean(b.crash) && i === 0 });
  });
  return out;
}

export const songLength = (beat) => songBars(beat).length;

// Seconds in one bar at the beat's tempo (the tempo counts the meter's beat).
export function barSeconds(beat) {
  return (meterOf(beat).beats * 60) / beat.tempo;
}

// ---- Reading a beat from storage or a link ----

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Rebuilds a beat from anything (a saved copy, a share link, an older version), keeping what is
// valid and dropping the rest. Always returns a playable beat.
export function sanitizeBeat(raw) {
  const base = blankBeat();
  if (!isObject(raw)) return base;
  const meter = METERS[raw.meter] ? raw.meter : "4/4";
  const steps = stepsPerBar(METERS[meter]);
  const parts = [];
  const ids = new Set();
  for (const p of Array.isArray(raw.parts) ? raw.parts : []) {
    if (parts.length >= MAX_PARTS || !isObject(p)) continue;
    const id = typeof p.id === "string" && /^[\w-]{1,40}$/.test(p.id) && !ids.has(p.id) ? p.id : makeId("p");
    ids.add(id);
    const notes = {};
    if (isObject(p.notes)) {
      for (const piece of GRID_ORDER) {
        const row = p.notes[piece];
        if (!Array.isArray(row)) continue;
        const clean = Array.from({ length: steps }, (_, i) => clampInt(row[i], 0, 3, 0));
        if (clean.some(Boolean)) notes[piece] = clean;
      }
    }
    parts.push({ id, name: cleanName(p.name, `Part ${parts.length + 1}`), notes });
  }
  if (!parts.length) parts.push(base.parts[0]);
  const partIds = new Set(parts.map((p) => p.id));
  const song = [];
  for (const b of Array.isArray(raw.song) ? raw.song : []) {
    if (song.length >= MAX_BLOCKS || !isObject(b) || !partIds.has(b.part)) continue;
    const id = typeof b.id === "string" && /^[\w-]{1,40}$/.test(b.id) && !song.some((s) => s.id === b.id) ? b.id : makeId("b");
    song.push({ id, part: b.part, bars: clampInt(b.bars, 1, MAX_BLOCK_BARS, 4), crash: Boolean(b.crash) });
  }
  return {
    v: BEAT_VERSION,
    name: cleanName(raw.name),
    tempo: clampTempo(raw.tempo, base.tempo),
    meter,
    swing: clampInt(raw.swing, 0, 100, 0),
    swingUnit: raw.swingUnit === 16 ? 16 : 8,
    parts,
    song,
  };
}

// True when two beats would sound the same (ids aside), so "unsaved changes" can be told apart
// from a beat that only got new ids.
export function sameMusic(a, b) {
  const strip = (beat) => {
    const index = new Map(beat.parts.map((p, i) => [p.id, i]));
    return JSON.stringify({
      tempo: beat.tempo,
      meter: beat.meter,
      swing: beat.swing,
      swingUnit: beat.swingUnit,
      parts: beat.parts.map((p) => ({ name: p.name, notes: GRID_ORDER.map((k) => p.notes[k] || null) })),
      song: beat.song.map((s) => [index.get(s.part), s.bars, s.crash]),
    });
  };
  return strip(a) === strip(b);
}

// A short description for lists: "100 BPM · 4/4 · 3 parts · 16-bar song".
export function describeBeat(beat) {
  const bits = [`${beat.tempo} BPM`, meterOf(beat).name, `${beat.parts.length} ${beat.parts.length === 1 ? "part" : "parts"}`];
  const bars = songLength(beat);
  if (bars) bits.push(`${bars}-bar song`);
  return bits.join(" · ");
}

export { LEVEL };
