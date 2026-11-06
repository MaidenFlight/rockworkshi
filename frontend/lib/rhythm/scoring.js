// Grading taps against the notes they were aimed at. Times are seconds on the audio clock, already
// corrected for the player's measured delay. Pure, so `node --test` runs it.
//
// The windows are fixed rather than scaled to skill, so scores stay comparable from one day to the
// next. Each note's outer window is also capped at 45% of the gap to its neighbours, so at fast
// tempos a tap can only ever belong to one note.

export const ON_TIME = 0.03;
export const CLOSE = 0.06;
export const MAX_WINDOW = 0.11;
const MIN_WINDOW = 0.025;

const POINTS = { on: 1, near: 0.8, off: 0.5 };
const EXTRA_COST = 0.5;

export function grade(error, window = MAX_WINDOW) {
  const a = Math.abs(error);
  if (a > window) return null;
  if (a <= ON_TIME) return { kind: "on", dir: null, error };
  return { kind: a <= CLOSE ? "near" : "off", dir: error < 0 ? "early" : "late", error };
}

export class Scorer {
  constructor() {
    this.targets = [];
    this.passes = new Map();
  }

  // A pass is one run through the rhythm: its targets are the notes the player should hit. A pass
  // of several bars arrives a bar at a time, and each bar extends it.
  addPass({ id, start, end, targets }) {
    const p = this.passes.get(id);
    if (p) {
      p.start = Math.min(p.start, start);
      p.end = Math.max(p.end, end);
    } else {
      this.passes.set(id, { id, start, end, extras: [] });
    }
    for (const t of targets) this.targets.push({ ...t, pass: id, win: MAX_WINDOW, result: null });
    this.targets.sort((a, b) => a.time - b.time);
    this.refreshWindows();
  }

  refreshWindows() {
    const ts = this.targets;
    ts.forEach((t, i) => {
      const gaps = [];
      if (i > 0) gaps.push(t.time - ts[i - 1].time);
      if (i < ts.length - 1) gaps.push(ts[i + 1].time - t.time);
      const gap = gaps.length ? Math.min(...gaps) : Infinity;
      t.win = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, gap * 0.45));
    });
  }

  // Returns what the tap did: hit a note, landed in a pass as an extra, or fell outside every
  // pass (during a count-in or a call), where it counts for nothing.
  tap(time) {
    let best = null;
    for (const t of this.targets) {
      if (t.result) continue;
      const d = Math.abs(time - t.time);
      if (d <= t.win && (!best || d < Math.abs(time - best.time))) best = t;
    }
    if (best) {
      best.result = grade(time - best.time, best.win);
      return { target: best, result: best.result };
    }
    for (const p of this.passes.values()) {
      if (time >= p.start - MAX_WINDOW && time < p.end + MAX_WINDOW) {
        p.extras.push(time);
        return { extra: p.id };
      }
    }
    return null;
  }

  // Notes whose window has closed without a tap become misses. Returns the ones that just did.
  closeUpTo(now) {
    const missed = [];
    for (const t of this.targets) {
      if (!t.result && t.time + t.win < now) {
        t.result = { kind: "missed", dir: null, error: null };
        missed.push(t);
      }
    }
    return missed;
  }

  // Settle a pass now, whatever the clock says: anything not yet hit is missed.
  finishPass(passId) {
    for (const t of this.targets) if (t.pass === passId && !t.result) t.result = { kind: "missed", dir: null, error: null };
    return this.summary(passId);
  }

  isDone(passId, now) {
    const p = this.passes.get(passId);
    return Boolean(p) && now > p.end + MAX_WINDOW && this.targets.every((t) => t.pass !== passId || t.result);
  }

  // Forget passes that ended long ago, so a long session doesn't grow without bound.
  prune(before) {
    for (const [id, p] of this.passes) if (p.end < before) this.passes.delete(id);
    this.targets = this.targets.filter((t) => this.passes.has(t.pass));
  }

  summary(passId) {
    const ts = this.targets.filter((t) => t.pass === passId);
    const p = this.passes.get(passId);
    return summarize(ts.map((t) => t.result), p ? p.extras.length : 0);
  }
}

export function summarize(results, extra = 0) {
  const s = { notes: results.length, on: 0, near: 0, off: 0, missed: 0, extra, early: 0, late: 0, offsets: [] };
  for (const r of results) {
    if (!r || r.kind === "missed") {
      s.missed += 1;
      continue;
    }
    s[r.kind] += 1;
    if (r.dir) s[r.dir] += 1;
    s.offsets.push(Math.round(r.error * 1000));
  }
  const hit = s.offsets.length;
  s.meanMs = hit ? Math.round(s.offsets.reduce((a, b) => a + b, 0) / hit) : 0;
  s.spreadMs = hit > 1 ? Math.round(Math.sqrt(s.offsets.reduce((a, o) => a + (o - s.meanMs) ** 2, 0) / (hit - 1))) : 0;
  const points = s.on * POINTS.on + s.near * POINTS.near + s.off * POINTS.off - extra * EXTRA_COST;
  s.score = s.notes ? Math.max(0, Math.min(100, Math.round((100 * points) / s.notes))) : 0;
  return s;
}

// How the player leans, in words, once there are enough hits to say.
export function tendency(s) {
  if (s.offsets.length < 3) return null;
  if (s.meanMs <= -15) return { kind: "rushing", ms: -s.meanMs };
  if (s.meanMs >= 15) return { kind: "dragging", ms: s.meanMs };
  return { kind: "centred", ms: Math.abs(s.meanMs) };
}

export const CLEAN_PASS = 90;

// The delay check: taps along to plain clicks. The median of the errors is the player's delay
// (screen, Bluetooth, their own habit); the spread says whether the taps were steady enough to
// trust it.
export function calibrate(clicks, taps) {
  const used = new Set();
  const errors = [];
  for (const tap of taps) {
    let best = -1;
    for (let i = 0; i < clicks.length; i++) {
      if (used.has(i)) continue;
      if (best < 0 || Math.abs(tap - clicks[i]) < Math.abs(tap - clicks[best])) best = i;
    }
    if (best >= 0 && Math.abs(tap - clicks[best]) <= 0.25) {
      used.add(best);
      errors.push(tap - clicks[best]);
    }
  }
  if (errors.length < 6) return { ok: false, reason: "few", count: errors.length };
  const sorted = [...errors].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const dev = errors.map((e) => Math.abs(e - median)).sort((a, b) => a - b);
  const spread = dev[Math.floor(dev.length / 2)];
  return {
    ok: spread <= 0.04,
    reason: spread <= 0.04 ? null : "uneven",
    offset: median,
    spread,
    count: errors.length,
  };
}
