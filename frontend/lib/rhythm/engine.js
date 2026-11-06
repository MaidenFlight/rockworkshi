// The rhythm trainer's sound and clock. A run is a chain of segments (a count-in, a bar to play, a
// bar to listen to, a short pause) asked for one at a time from a plan, just before each is due.
// Everything is scheduled on the Web Audio clock a little ahead (a 25 ms timer looking 120 ms
// ahead), so the timing holds while React is busy.
import { TPB, onsets, swungTick } from "./patterns.js";

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

// Synthesised voices, built once as sample buffers, so there is nothing to download or license.
// The pulse is a short high click; the rhythm is a lower stick-on-rim knock, so the two never
// blur together. Each starts with a short fade so it never pops.
function buildVoices(ctx) {
  const sr = ctx.sampleRate;
  const TAU = 2 * Math.PI;
  const make = (seconds, fn) => {
    const len = Math.ceil(seconds * sr);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let seed = 22695477;
    let hp = 0;
    let prev = 0;
    const noise = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const x = seed / 2147483648 - 1;
      // A one-pole high-pass, so the noise is a crack rather than a hiss.
      hp = 0.82 * (hp + x - prev);
      prev = x;
      return hp;
    };
    const attack = Math.max(1, Math.round(0.0008 * sr));
    const release = Math.max(1, Math.round(0.004 * sr));
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / attack, (len - i) / release);
      d[i] = fn(i / sr, noise) * env;
    }
    return buf;
  };
  return {
    accent: make(0.05, (t, nz) => 0.5 * Math.sin(TAU * 1975 * t) * Math.exp(-t / 0.011) + 0.08 * nz() * Math.exp(-t / 0.002)),
    beat: make(0.05, (t, nz) => 0.34 * Math.sin(TAU * 1480 * t) * Math.exp(-t / 0.009) + 0.06 * nz() * Math.exp(-t / 0.002)),
    stick: make(0.16, (t, nz) => {
      const body = 0.42 * Math.sin(TAU * 330 * t) * Math.exp(-t / 0.03) + 0.22 * Math.sin(TAU * 790 * t) * Math.exp(-t / 0.012);
      return body + 0.28 * nz() * Math.exp(-t / 0.012);
    }),
  };
}

export function audioSupported() {
  return typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);
}

export class RhythmEngine {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.sources = [];
    this.segments = [];
    this.running = false;
  }

  // Must be called inside the click or key press that starts sound, or phones stay silent.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.voices = buildVoices(this.ctx);
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.8;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") this.ctx.resume();
    return this.ctx;
  }

  // The moment on the audio clock that was reaching the speakers at a given performance.now()
  // time: an event's timeStamp for a tap, or now for the playhead. Browsers that can say what
  // is playing right now are asked; the rest are estimated from their reported latency.
  heard(perfTime = performance.now()) {
    const ctx = this.ctx;
    if (!ctx) return 0;
    if (typeof ctx.getOutputTimestamp === "function") {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
        return ts.contextTime + (perfTime - ts.performanceTime) / 1000;
      }
    }
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return ctx.currentTime - latency - (performance.now() - perfTime) / 1000;
  }

  // next(index, previous) returns the next segment's spec, or null to end the run after the
  // last one has played. onSegment hears about each segment as it is scheduled.
  async start({ next, onSegment, onEnd }) {
    const ctx = this.ensure();
    this.stop();
    const token = this.token;
    try {
      await ctx.resume();
    } catch {
      // A refused resume shows up below as a context that never runs.
    }
    // Stopped (or restarted) while the audio was waking up.
    if (token !== this.token) return;
    this.next = next;
    this.onSegment = onSegment;
    this.onEnd = onEnd;
    this.index = 0;
    this.cursor = ctx.currentTime + 0.12;
    this.endAt = null;
    this.running = true;
    this.stalled = 0;
    this.timer = setInterval(() => this.pump(), TICK_MS);
    this.pump();
  }

  pump() {
    const ctx = this.ctx;
    if (!ctx || !this.timer) return;
    // A phone locking or another app taking the audio suspends the clock; stop rather than
    // leave a run half-alive.
    if (ctx.state !== "running") {
      this.stalled += 1;
      if (this.stalled > 40) this.finish({ interrupted: true });
      return;
    }
    this.stalled = 0;
    // The timer was held back (a background tab, a busy phone) and the next bar is already due.
    // Playing it now would bunch the clicks up and grade against a broken grid, so stop instead.
    if (this.running && this.cursor < ctx.currentTime - 0.02) {
      this.finish({ interrupted: true, behind: true });
      return;
    }
    while (this.running && this.cursor < ctx.currentTime + LOOKAHEAD) {
      const prev = this.segments[this.segments.length - 1] ?? null;
      const spec = this.next(this.index, prev);
      if (!spec) {
        this.running = false;
        this.endAt = this.cursor;
        break;
      }
      const seg = this.schedule(spec, this.cursor, this.index);
      this.segments.push(seg);
      if (this.segments.length > 24) this.segments.shift();
      this.index += 1;
      this.cursor = seg.end;
      this.onSegment?.(seg);
    }
    this.sources = this.sources.filter((s) => s.when > ctx.currentTime - 0.5);
    if (!this.running && this.endAt !== null && ctx.currentTime > this.endAt + 0.2) this.finish({ interrupted: false });
  }

  schedule(spec, start, index) {
    const beat = 60 / spec.bpm;
    const beats = spec.beats ?? 4;
    const end = start + beats * beat;
    const clicks = spec.clicks ?? "all";
    for (let b = 0; b < beats; b++) {
      const on = clicks === "all" || (clicks === "backbeat" && b % 2 === 1);
      if (on) this.play(b === 0 && beats === 4 ? "accent" : "beat", start + b * beat);
    }
    const notes = spec.bar
      ? onsets(spec.bar).map((o) => {
          const tick = spec.swing ? swungTick(spec.bar, o.tick) : o.tick;
          return { tick: o.tick, index: o.index, time: start + (tick / TPB) * beat };
        })
      : [];
    if (spec.rhythm) for (const n of notes) this.play("stick", n.time);
    return { ...spec, index, start, end, beat, beats, notes };
  }

  play(voice, when) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.voices[voice];
    src.connect(this.out);
    src.start(when);
    this.sources.push({ src, when });
  }

  // Where the run is at a moment on the heard clock: the segment and the tick inside it.
  position(now) {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i];
      if (now >= s.start && now < s.end) {
        return { seg: s, tick: ((now - s.start) / s.beat) * TPB, beatIndex: Math.floor((now - s.start) / s.beat) };
      }
    }
    return null;
  }

  // Silence everything still to come. A user's stop never calls onEnd; the run's own end does.
  stop() {
    this.token = (this.token ?? 0) + 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const s of this.sources) {
      if (s.when >= now - 0.01) {
        try {
          s.src.stop();
        } catch {
          // Already stopped.
        }
      }
    }
    this.sources = [];
    this.segments = [];
  }

  finish(info) {
    const cb = this.onEnd;
    this.stop();
    cb?.(info);
  }

  close() {
    this.stop();
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}
