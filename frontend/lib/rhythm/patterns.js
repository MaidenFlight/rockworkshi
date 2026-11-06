// The rhythm trainer's vocabulary: levels, rock figures, the random bar generator and the counting
// syllables. Pure functions with no browser APIs, so `node --test` runs them directly. Imports
// inside lib/rhythm carry their `.js` extension for the same reason.
//
// Rhythms are written in ticks, 12 to a beat, so sixteenths (3), triplet eighths (4) and eighths
// (6) are all whole numbers. Every bar is 4/4: 48 ticks. An event is a note or a rest:
// { t: ticks, rest: boolean, tie?: boolean }. `tie` means the note is held into the next event,
// which then sounds no new note.

export const TPB = 12;
export const BEATS = 4;
export const BAR = TPB * BEATS;

const n = (t, tie = false) => (tie ? { t, rest: false, tie: true } : { t, rest: false });
const r = (t) => ({ t, rest: true });

// A level is a set of one-beat and two-beat figures with weights. `focus` marks what the level
// introduces: every generated bar contains at least one, so a sixteenths bar is never all quarters.
// Two-beat figures only start on beats 1 or 3, so the middle of the bar always shows.
export const LEVELS = [
  {
    id: "l1",
    n: 1,
    name: "Quarter notes",
    short: "Quarters",
    blurb: "Quarter notes, half notes and quarter rests. One count each, two for a half note.",
    one: [
      { ev: [n(12)], w: 6, focus: true },
      { ev: [r(12)], w: 2 },
    ],
    two: [{ ev: [n(24)], w: 2, focus: true }],
    minOnsets: 2,
  },
  {
    id: "l2",
    n: 2,
    name: "Eighth notes",
    short: "Eighths",
    blurb: "Two even notes inside one count. Say it as you play: 1 &, 2 &.",
    one: [
      { ev: [n(6), n(6)], w: 5, focus: true },
      { ev: [n(12)], w: 3 },
      { ev: [r(12)], w: 1 },
    ],
    two: [{ ev: [n(24)], w: 1 }],
    minOnsets: 4,
  },
  {
    id: "l3",
    n: 3,
    name: "Off-beats",
    short: "Off-beats",
    blurb: "Notes that start on the &, eighth rests, and the first syncopations that ride across a beat.",
    one: [
      { ev: [r(6), n(6)], w: 4, focus: true },
      { ev: [n(6), n(6)], w: 3 },
      { ev: [n(6), r(6)], w: 1 },
      { ev: [n(12)], w: 2 },
      { ev: [r(12)], w: 1 },
    ],
    two: [
      { ev: [n(6), n(12), n(6)], w: 2, focus: true },
      { ev: [n(18), n(6)], w: 2, focus: true },
    ],
    minOnsets: 4,
  },
  {
    id: "l4",
    n: 4,
    name: "Sixteenths",
    short: "Sixteenths",
    blurb: "Four notes to a count: 1 e & a. Then the gallop and its reverse, built from the same four.",
    one: [
      { ev: [n(3), n(3), n(3), n(3)], w: 3, focus: true },
      { ev: [n(6), n(3), n(3)], w: 3, focus: true },
      { ev: [n(3), n(3), n(6)], w: 3, focus: true },
      { ev: [n(6), n(6)], w: 2 },
      { ev: [n(12)], w: 1 },
    ],
    two: [],
    minOnsets: 6,
  },
  {
    id: "l5",
    n: 5,
    name: "Syncopated sixteenths",
    short: "Syncopation",
    blurb: "Dotted eighths, sixteenth rests, and notes that land on the e and the a.",
    one: [
      { ev: [n(9), n(3)], w: 3, focus: true },
      { ev: [n(3), n(9)], w: 2, focus: true },
      { ev: [n(3), n(6), n(3)], w: 3, focus: true },
      { ev: [r(3), n(3), n(3), n(3)], w: 2, focus: true },
      { ev: [r(6), n(3), n(3)], w: 2, focus: true },
      { ev: [n(6), n(3), n(3)], w: 1 },
      { ev: [n(3), n(3), n(6)], w: 1 },
      { ev: [n(12)], w: 1 },
    ],
    two: [],
    minOnsets: 6,
  },
  {
    id: "l6",
    n: 6,
    name: "Triplets and shuffle",
    short: "Triplets",
    blurb: "Three notes to a count, 1 trip let, and the long-short shuffle that comes from them.",
    one: [
      { ev: [n(4), n(4), n(4)], w: 4, focus: true },
      { ev: [n(8), n(4)], w: 3, focus: true },
      { ev: [r(4), n(4), n(4)], w: 1, focus: true },
      { ev: [r(8), n(4)], w: 1, focus: true },
      { ev: [n(6), n(6)], w: 1 },
      { ev: [n(12)], w: 2 },
    ],
    two: [],
    minOnsets: 5,
  },
];

const rep = (beat, times = BEATS) => Array.from({ length: times }, () => beat.map((e) => ({ ...e }))).flat();

// Named one-bar figures from rock and its relatives. Fixed, not generated.
export const FIGURES = [
  {
    id: "straight",
    name: "Straight eighths",
    blurb: "Eight even notes a bar: the steady drive under a lot of rock rhythm guitar and bass.",
    bar: rep([n(6), n(6)]),
  },
  {
    id: "backbeat",
    name: "Backbeat",
    blurb: "Beats 2 and 4, where the snare lands in a rock beat. Clap it and the song starts to move.",
    bar: [r(12), n(12), r(12), n(12)],
  },
  {
    id: "charleston",
    name: "Charleston",
    blurb: "A dotted quarter and an eighth: 1, then the & of 2. Short, punchy, and everywhere.",
    bar: [n(18), n(6), r(24)],
  },
  {
    id: "push",
    name: "The push",
    blurb: "The chord arrives an eighth early, on the & of 2, and rings through beat 3.",
    bar: [n(12), r(6), n(6, true), n(12), n(12)],
  },
  {
    id: "tresillo",
    name: "Tresillo (3 + 3 + 2)",
    blurb: "Eight eighths grouped 3 + 3 + 2. A staple of early rock and roll and R&B.",
    bar: [n(18), n(18), n(12)],
  },
  {
    id: "gallop",
    name: "Gallop",
    blurb: "An eighth and two sixteenths on every count, the galloping figure of a lot of metal.",
    bar: rep([n(6), n(3), n(3)]),
  },
  {
    id: "reverse-gallop",
    name: "Reverse gallop",
    blurb: "Two sixteenths and an eighth on every count. The gallop turned around.",
    bar: rep([n(3), n(3), n(6)]),
  },
  {
    id: "shuffle",
    name: "Shuffle",
    blurb: "Long-short on every count, three to the beat: the feel of a blues shuffle.",
    bar: rep([n(8), n(4)]),
  },
  {
    id: "sixteenths",
    name: "Sixteenth drive",
    blurb: "Sixteen even notes a bar, for funk rhythm and fast strumming. Keep it light.",
    bar: rep([n(3), n(3), n(3), n(3)]),
  },
];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function figureById(id) {
  return FIGURES.find((f) => f.id === id) ?? null;
}

// A small seeded generator for tests; Math.random everywhere else.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rand) {
  const total = list.reduce((s, f) => s + f.w, 0);
  let x = rand() * total;
  for (const f of list) {
    x -= f.w;
    if (x < 0) return f;
  }
  return list[list.length - 1];
}

// Two quarter rests that fill half a bar (beats 1-2 or 3-4) are written as one half rest.
export function mergeRests(events) {
  const out = [];
  let tick = 0;
  for (const e of events) {
    const prev = out[out.length - 1];
    if (e.rest && e.t === 12 && prev && prev.rest && prev.t === 12 && (tick - 12) % 24 === 0) {
      out[out.length - 1] = r(24);
    } else {
      out.push({ ...e });
    }
    tick += e.t;
  }
  return out;
}

export function barTicks(events) {
  return events.reduce((s, e) => s + e.t, 0);
}

// Where each sounded note starts, in ticks from the bar's start. Tied continuations don't sound.
export function onsets(events) {
  const out = [];
  let tick = 0;
  let held = false;
  events.forEach((e, i) => {
    if (!e.rest && !held) out.push({ tick, index: i });
    held = !e.rest && Boolean(e.tie);
    tick += e.t;
  });
  return out;
}

export function sameBar(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((e, i) => e.t === b[i].t && e.rest === b[i].rest && Boolean(e.tie) === Boolean(b[i].tie));
}

// One random bar from a level. Tries until the bar has enough notes, includes something the level
// is about, and differs from `avoid` (the bar it replaces).
export function generateBar(level, rand = Math.random, avoid = null) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const events = [];
    let beat = 0;
    let focus = false;
    while (beat < BEATS) {
      const canTwo = level.two.length > 0 && (beat === 0 || beat === 2) && rand() < 0.3;
      const f = canTwo ? pick(level.two, rand) : pick(level.one, rand);
      events.push(...f.ev.map((e) => ({ ...e })));
      if (f.focus) focus = true;
      beat += canTwo ? 2 : 1;
    }
    const bar = mergeRests(events);
    if (!focus) continue;
    if (onsets(bar).length < level.minOnsets) continue;
    if (bar[0].rest && bar.length > 1 && bar[0].t >= 24) continue;
    if (avoid && avoid.some((b) => sameBar(b, bar))) continue;
    return bar;
  }
  // Unreachable in practice; a level's first focus figure, repeated, is always valid.
  return mergeRests(rep(level.one.find((f) => f.focus)?.ev ?? [n(12)]));
}

export function generateBars(level, count, rand = Math.random, avoid = []) {
  const bars = [];
  for (let i = 0; i < count; i++) bars.push(generateBar(level, rand, [...avoid, ...bars]));
  return bars;
}

// Distractors for "Name the rhythm": the answer with one beat (or two) swapped for another figure
// from the same level, so the choices look alike and only listening tells them apart.
export function nearMiss(level, answer, rand = Math.random, avoid = []) {
  const segs = segments(answer);
  const single = segs.map((s, i) => (s.beats === 1 ? i : -1)).filter((i) => i >= 0);
  for (let attempt = 0; attempt < 200 && single.length; attempt++) {
    const at = single[Math.floor(rand() * single.length)];
    const f = pick(level.one, rand);
    const next = segs.map((s, i) => (i === at ? f.ev.map((e) => ({ ...e })) : s.ev.map((e) => ({ ...e }))));
    // A tie into the swapped beat would now point at something else, so it goes.
    if (at > 0) {
      const before = next[at - 1];
      before[before.length - 1] = { t: before[before.length - 1].t, rest: before[before.length - 1].rest };
    }
    const bar = mergeRests(next.flat());
    if (onsets(bar).length < Math.min(level.minOnsets, onsets(answer).length)) continue;
    if ([answer, ...avoid].some((b) => sameBar(b, bar))) continue;
    return bar;
  }
  return generateBar(level, rand, [answer, ...avoid]);
}

// Undo the half-rest merge so a bar splits on every beat line.
function unmerge(events) {
  return events.flatMap((e) => (e.rest && e.t === 24 ? [r(12), r(12)] : [{ ...e }]));
}

// A bar cut at every beat line nothing crosses: single beats, and figures that ride across one.
export function segments(events) {
  const segs = [];
  let cur = [];
  let start = 0;
  let tick = 0;
  for (const e of unmerge(events)) {
    cur.push({ ...e });
    tick += e.t;
    if (tick % TPB === 0) {
      segs.push({ from: start / TPB, beats: (tick - start) / TPB, ev: cur });
      cur = [];
      start = tick;
    }
  }
  return segs;
}

// The counting syllables for a bar. Each beat counts at the finest grid its notes need: "1",
// "1 &", "1 e & a" or "1 trip let". `onset` marks the syllables a note starts on.
export function countsFor(events) {
  const starts = [];
  let tick = 0;
  for (const e of events) {
    starts.push(tick);
    tick += e.t;
  }
  const sounding = new Set(onsets(events).map((o) => o.tick));
  const out = [];
  for (let b = 0; b < BEATS; b++) {
    const inBeat = starts.filter((s) => s >= b * TPB && s < (b + 1) * TPB).map((s) => s - b * TPB);
    let grid;
    if (inBeat.some((s) => s % 6 !== 0 && s % 4 === 0)) grid = [[0, String(b + 1)], [4, "trip"], [8, "let"]];
    else if (inBeat.some((s) => s % 6 !== 0)) grid = [[0, String(b + 1)], [3, "e"], [6, "&"], [9, "a"]];
    else if (inBeat.includes(6)) grid = [[0, String(b + 1)], [6, "&"]];
    else grid = [[0, String(b + 1)]];
    for (const [off, text] of grid) {
      const at = b * TPB + off;
      out.push({ tick: at, text, beat: off === 0, onset: sounding.has(at) });
    }
  }
  return out;
}

// Swing moves the & of a beat to two-thirds of the way through it, long-short. Only beats whose
// notes sit on the beat and the & swing; a beat with sixteenths or triplets plays as written.
export function swungTick(events, tick) {
  if (tick % TPB !== 6) return tick;
  const b = Math.floor(tick / TPB);
  let at = 0;
  for (const e of events) {
    if (at >= b * TPB && at < (b + 1) * TPB && (at - b * TPB) % 6 !== 0) return tick;
    at += e.t;
  }
  return tick + 2;
}

// A plain-words description of a bar, for screen readers.
const NAMES = {
  48: "whole note",
  36: "dotted half",
  24: "half note",
  18: "dotted quarter",
  12: "quarter",
  9: "dotted eighth",
  8: "triplet quarter",
  6: "eighth",
  4: "triplet eighth",
  3: "sixteenth",
};

export function describeBar(events) {
  return events
    .map((e) => {
      const name = NAMES[e.t] ?? `${e.t / TPB} beats`;
      if (e.rest) return `${name} rest`;
      return e.tie ? `${name} tied to` : name;
    })
    .join(", ")
    .replace(/tied to, /g, "tied to ");
}
