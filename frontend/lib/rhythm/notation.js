// Lays out one bar of rhythm on a single-line staff: noteheads, stems, beams, flags, rests, dots,
// ties, triplet marks and the counting syllables. Pure geometry in viewBox units; the Notation
// component draws it. Spacing is proportional to time, so the playhead moves at a constant speed
// and passes through each note as it sounds.
import { TPB, BAR, countsFor } from "./patterns.js";

export const BEAT_W = 100;
const PAD_L = 22;
const HEAD_OFF = 8;
export const BAR_W = PAD_L + 4 * BEAT_W + 16;
export const LINE_Y = 66;
export const STEM_TOP = LINE_Y - 34;
export const COUNT_Y = 102;
export const BAR_H = 110;
export const MARK_Y = 11;
const STEM_DX = 5.6;
const BEAM_GAP = 8;

// Where a moment in the bar sits, so a note at that tick is drawn there.
export function tickX(tick) {
  return PAD_L + HEAD_OFF + (tick / TPB) * BEAT_W;
}

const DOTTED = new Set([36, 18, 9]);
const BEAMABLE = new Set([9, 6, 4, 3]);
const HOLLOW = new Set([48, 36, 24]);
const REST_KIND = { 48: "whole", 36: "half", 24: "half", 18: "quarter", 12: "quarter", 8: "quarter", 9: "eighth", 6: "eighth", 4: "eighth", 3: "sixteenth" };

// One beam, or two for a sixteenth.
const beamLevel = (t) => (t === 3 ? 2 : 1);

export function layoutBar(events) {
  const out = { heads: [], stems: [], flags: [], beams: [], dots: [], rests: [], tuplets: [], ties: [], notes: [], counts: [] };
  const starts = [];
  let tick = 0;
  for (const e of events) {
    starts.push(tick);
    tick += e.t;
  }
  if (tick !== BAR) throw new Error(`A bar must be ${BAR} ticks, got ${tick}`);

  let held = false;
  events.forEach((e, i) => {
    const x = tickX(starts[i]);
    if (e.rest) {
      out.rests.push({ x, kind: REST_KIND[e.t] ?? "quarter", dot: DOTTED.has(e.t), index: i });
      if (DOTTED.has(e.t)) out.dots.push({ x: x + 11, y: LINE_Y - 5 });
      held = false;
      return;
    }
    out.heads.push({ x, hollow: HOLLOW.has(e.t), index: i });
    if (e.t !== 48) out.stems.push({ x: x + STEM_DX, y1: LINE_Y - 1, y2: STEM_TOP });
    if (DOTTED.has(e.t)) out.dots.push({ x: x + 12, y: LINE_Y - 4 });
    out.notes.push({ index: i, tick: starts[i], x, onset: !held });
    held = Boolean(e.tie);
  });

  // Ties curve under the noteheads to the next note.
  events.forEach((e, i) => {
    if (!e.rest && e.tie && events[i + 1] && !events[i + 1].rest) {
      out.ties.push({ x1: tickX(starts[i]) + 3, x2: tickX(starts[i + 1]) - 3, y: LINE_Y + 7 });
    }
  });

  // Beams: consecutive short notes inside one beat, broken by rests. A group of one gets a flag.
  const groups = [];
  let cur = null;
  events.forEach((e, i) => {
    const beat = Math.floor(starts[i] / TPB);
    const fits = !e.rest && BEAMABLE.has(e.t) && Math.floor((starts[i] + e.t - 1) / TPB) === beat;
    if (fits && cur && cur.beat === beat && cur.last === i - 1) {
      cur.items.push(i);
      cur.last = i;
    } else if (fits) {
      cur = { beat, items: [i], last: i };
      groups.push(cur);
    } else {
      cur = null;
    }
  });

  for (const g of groups) {
    const xs = g.items.map((i) => tickX(starts[i]) + STEM_DX);
    if (g.items.length === 1) {
      out.flags.push({ x: xs[0], y: STEM_TOP, count: beamLevel(events[g.items[0]].t) });
      continue;
    }
    out.beams.push({ x1: xs[0], x2: xs[xs.length - 1], y: STEM_TOP, level: 1 });
    // Second beams join neighbouring sixteenths; a sixteenth on its own gets a stub pointing
    // into the group.
    g.items.forEach((idx, k) => {
      if (beamLevel(events[idx].t) < 2) return;
      const next = g.items[k + 1];
      if (next !== undefined && beamLevel(events[next].t) === 2) {
        out.beams.push({ x1: xs[k], x2: xs[k + 1], y: STEM_TOP + BEAM_GAP, level: 2 });
        return;
      }
      const prev = g.items[k - 1];
      if (prev !== undefined && beamLevel(events[prev].t) === 2) return;
      const stub = 9;
      if (k === 0) out.beams.push({ x1: xs[k], x2: xs[k] + stub, y: STEM_TOP + BEAM_GAP, level: 2 });
      else out.beams.push({ x1: xs[k] - stub, x2: xs[k], y: STEM_TOP + BEAM_GAP, level: 2 });
    });
  }

  // Triplets: a "3" over the beam when the whole beat is one beamed group, otherwise a bracket.
  for (let b = 0; b < 4; b++) {
    const inBeat = events.map((e, i) => i).filter((i) => starts[i] >= b * TPB && starts[i] < (b + 1) * TPB);
    const triplet = inBeat.some((i) => events[i].t === 4 || events[i].t === 8 || (starts[i] % TPB) % 4 === 0 && starts[i] % 6 !== 0);
    if (!triplet) continue;
    const first = tickX(starts[inBeat[0]]);
    const last = tickX(starts[inBeat[inBeat.length - 1]]);
    const oneBeam = groups.some((g) => g.items.length === inBeat.length && g.items.every((i, k) => i === inBeat[k]));
    out.tuplets.push({
      x1: first - 2,
      x2: last + STEM_DX + 4,
      y: STEM_TOP - 7,
      bracket: !oneBeam,
      label: "3",
    });
  }

  out.counts = countsFor(events).map((c) => ({ ...c, x: tickX(c.tick) }));
  return out;
}
