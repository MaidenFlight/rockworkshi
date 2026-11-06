// The metronome's rhythm maths: meters, groupings, what the BPM counts, subdivisions, counting
// syllables and where every click falls inside a beat. Pure functions with no browser APIs, so
// `node --test` runs them directly. Imports inside lib/metronome carry their `.js` extension
// for the same reason.

// Note values as fractions of a whole note. `whole` is what makes tempo conversion exact.
export const NOTES = {
  quarter: { id: "quarter", whole: 1 / 4, name: "quarter note", plural: "quarter notes" },
  "dotted-quarter": { id: "dotted-quarter", whole: 3 / 8, name: "dotted quarter note", plural: "dotted quarter notes" },
  eighth: { id: "eighth", whole: 1 / 8, name: "eighth note", plural: "eighth notes" },
};

export const MAX_BEATS = 16;
const GROUP_MAX = 9;

// The common meters offered as one-press choices. Custom meters use the same shape.
export const METER_PRESETS = [
  { beats: 2, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 4, unit: 4 },
  { beats: 5, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 7, unit: 8 },
  { beats: 9, unit: 8 },
  { beats: 12, unit: 8 },
];

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];

export function numberWord(n) {
  return WORDS[n] ?? String(n);
}

const sum = (list) => list.reduce((a, b) => a + b, 0);

export function gcd(a, b) {
  return b ? gcd(b, a % b) : Math.abs(a);
}

// The grouping a meter gets when nobody has chosen one. Groups are counted in the bottom
// number's note value: 7/8 is 2+2+3 eighths. A /4 meter is one group, so only beat 1 is strong.
export function defaultGroups(beats, unit) {
  if (unit === 4 || beats <= 3) return [beats];
  if (beats % 3 === 0) return Array(beats / 3).fill(3);
  if (beats === 5) return [3, 2];
  if (beats === 8) return [3, 3, 2];
  if (beats % 2 === 0) return Array(beats / 2).fill(2);
  // Odd: twos, then a three at the end (7/8 = 2+2+3).
  return [...Array((beats - 3) / 2).fill(2), 3];
}

export function validGroups(groups, beats) {
  return (
    Array.isArray(groups) &&
    groups.length >= 1 &&
    groups.length <= MAX_BEATS &&
    groups.every((g) => Number.isInteger(g) && g >= 1 && g <= GROUP_MAX) &&
    sum(groups) === beats
  );
}

// Compound time: every group is three eighths (6/8, 9/8, 12/8), so the felt beat can be the
// dotted quarter that holds them.
export function isCompound(meter) {
  return meter.unit === 8 && meter.groups.length >= 1 && meter.groups.every((g) => g === 3);
}

// What the BPM may count. "group" means each beat is a whole group (a dotted quarter in 6/8);
// "count" means each beat is one note of the bottom number (a quarter in 4/4, an eighth in 7/8).
// Uneven groups can't be the beat, because the BPM would then mean two different lengths.
export function pulseOptions(meter) {
  return isCompound(meter) ? ["group", "count"] : ["count"];
}

export function defaultPulse(meter) {
  return isCompound(meter) ? "group" : "count";
}

// The note value the BPM refers to.
export function pulseNote(meter) {
  if (meter.unit === 4) return "quarter";
  return meter.pulse === "group" ? "dotted-quarter" : "eighth";
}

// The beat cells. Each is one beat the BPM counts, with where it sits in its group.
export function cellsOf(meter) {
  const cells = [];
  meter.groups.forEach((size, groupIndex) => {
    if (meter.pulse === "group") {
      cells.push({ index: cells.length, groupIndex, groupStart: true, inGroup: 0, groupSize: size });
      return;
    }
    for (let k = 0; k < size; k += 1) {
      cells.push({ index: cells.length, groupIndex, groupStart: k === 0, inGroup: k, groupSize: size });
    }
  });
  return cells;
}

// Beat 1 is strong; so is the start of every other group when the beat is the note inside it
// (7/8 = 2+2+3 is strong on 1, 3 and 5). Every other beat is normal.
export function defaultAccents(meter) {
  const many = meter.groups.length > 1 && meter.pulse === "count";
  return cellsOf(meter).map((c) => (c.index === 0 || (many && c.groupStart) ? "strong" : "normal"));
}

// The subdivisions each kind of beat offers, as clicks per beat. A dotted quarter already holds
// three eighths, so it offers threes and sixes (and duplets) rather than an even split.
const SUBDIVISIONS = {
  quarter: [
    { n: 1, name: "Beats only", per: "1 per beat", notes: { count: 1, beams: 0 } },
    { n: 2, name: "Eighths", per: "2 per beat", notes: { count: 2, beams: 1 } },
    { n: 3, name: "Triplets", per: "3 per beat", notes: { count: 3, beams: 1, tuplet: 3 } },
    { n: 4, name: "Sixteenths", per: "4 per beat", notes: { count: 4, beams: 2 } },
  ],
  "dotted-quarter": [
    { n: 1, name: "Beats only", per: "1 per beat", notes: { count: 1, beams: 0, dotted: true } },
    { n: 3, name: "Eighths", per: "3 per beat", notes: { count: 3, beams: 1 } },
    { n: 6, name: "Sixteenths", per: "6 per beat", notes: { count: 6, beams: 2 } },
    { n: 2, name: "Duplets", per: "2 per beat", notes: { count: 2, beams: 1, tuplet: 2 } },
  ],
  eighth: [
    { n: 1, name: "Beats only", per: "1 per beat", notes: { count: 1, beams: 0, flag: true } },
    { n: 2, name: "Sixteenths", per: "2 per beat", notes: { count: 2, beams: 2 } },
    { n: 3, name: "Triplets", per: "3 per beat", notes: { count: 3, beams: 2, tuplet: 3 } },
    { n: 4, name: "Thirty-seconds", per: "4 per beat", notes: { count: 4, beams: 3 } },
  ],
};

export function subdivisionOptions(meter) {
  return SUBDIVISIONS[pulseNote(meter)];
}

// What a beat naturally splits into when a meter is first chosen: compound beats into their
// three eighths, everything else not at all.
export function defaultSubdivision(meter) {
  return pulseNote(meter) === "dotted-quarter" ? 3 : 1;
}

// Swing moves the second note of each pair later. It needs pairs: two or four clicks in a beat
// that is not already a dotted (three-part) beat.
export function swingApplies(meter, subdivision) {
  return pulseNote(meter) !== "dotted-quarter" && (subdivision === 2 || subdivision === 4);
}

// Where each click falls inside one beat, as fractions of the beat. `swing` is the percentage of
// the pair at which the second note lands: 50 is straight, 66.7 is triplet swing (2:1), 75 is a
// dotted-eighth-and-sixteenth feel. Sixteenths swing within each half of the beat.
export function subPositions(n, swing = 50) {
  const r = Math.min(75, Math.max(50, swing)) / 100;
  if (n === 2) return [0, r];
  if (n === 4) return [0, r / 2, 0.5, 0.5 + r / 2];
  return Array.from({ length: n }, (_, k) => k / n);
}

// The same musical speed, counted in a different note: dotted quarter = 60 is eighth = 180.
export function convertTempo(tempo, fromNote, toNote) {
  return (tempo * NOTES[fromNote].whole) / NOTES[toNote].whole;
}

export function beatSeconds(tempo) {
  return 60 / tempo;
}

export function barSeconds(meter, tempo) {
  return cellsOf(meter).length * beatSeconds(tempo);
}

// A second layer of `notes` evenly spaced clicks across one bar (the shared cycle), as fractions.
export function polyPositions(notes) {
  return Array.from({ length: notes }, (_, j) => j / notes);
}

// Counting syllables per beat cell, or null where no standard count exists (sixteenths in 6/8).
// 4/4 eighths: 1 & 2 &. Sixteenths: 1 e & a. Triplets: 1 trip let. 6/8 in two: 1 & a 2 & a.
// Uneven groups count inside each group (7/8 = 1 2 1 2 1 2 3); 6/8 counted in eighths runs 1-6.
const SYLLABLES = { 1: [], 2: ["&"], 3: ["trip", "let"], 4: ["e", "&", "a"] };

export function countingText(meter, subdivision) {
  const note = pulseNote(meter);
  const cells = cellsOf(meter);
  if (note === "dotted-quarter") {
    const tail = { 1: [], 3: ["&", "a"], 2: ["&"] }[subdivision];
    if (!tail) return null;
    return cells.map((c) => [String(c.index + 1), ...tail]);
  }
  const tail = SYLLABLES[subdivision];
  if (!tail) return null;
  const withinGroups = meter.unit === 8 && !isCompound(meter) && meter.groups.length > 1;
  return cells.map((c) => [String(withinGroups ? c.inGroup + 1 : c.index + 1), ...tail]);
}

export function meterLabel(meter) {
  return `${meter.beats}/${meter.unit}`;
}

export function groupsLabel(groups) {
  return groups.join("+");
}

// One plain sentence a beginner can read: what the numbers mean for this meter.
export function describeMeter(meter) {
  const label = meterLabel(meter);
  const cells = cellsOf(meter).length;
  const note = NOTES[pulseNote(meter)];
  if (meter.pulse === "group") {
    return `${label}: ${numberWord(cells)} ${cells === 1 ? "beat" : "beats"} in each bar. Each beat is a ${note.name}, which holds three eighth notes.`;
  }
  const beats = `${numberWord(cells)} ${note.name} ${cells === 1 ? "beat" : "beats"} in each bar`;
  if (meter.groups.length > 1) return `${label}: ${beats}, grouped ${groupsLabel(meter.groups)}.`;
  return `${label}: ${beats}.`;
}

// Ways to group a meter into twos and threes, for the quick choices beside "Custom".
export function groupingChoices(beats, unit, limit = 4) {
  if (beats < 4 || (unit === 4 && beats < 5)) return [];
  const out = [];
  const walk = (left, acc) => {
    if (out.length >= 64) return;
    if (left === 0) {
      out.push(acc);
      return;
    }
    if (left >= 3) walk(left - 3, [...acc, 3]);
    if (left >= 2) walk(left - 2, [...acc, 2]);
  };
  walk(beats, []);
  const first = defaultGroups(beats, unit);
  const key = (g) => g.join("+");
  // The default first, then the fewest groups (the most common way to feel a meter).
  const rest = out.filter((g) => key(g) !== key(first)).sort((a, b) => a.length - b.length);
  const choices = [first, ...rest].slice(0, limit);
  return choices.length > 1 ? choices : [];
}

// Parses "2+2+3" (or "2 2 3", "2-2-3") into groups, or null.
export function parseGroups(text) {
  if (typeof text !== "string") return null;
  const parts = text.trim().split(/\s*[+\-\s,]\s*/).filter(Boolean);
  if (!parts.length || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  return parts.map(Number);
}
