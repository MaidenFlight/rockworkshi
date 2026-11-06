// The metronome's audio engine. A timer wakes a scheduler every 25ms, but the timer never decides
// when a click sounds: each click is booked on AudioContext.currentTime about a tenth of a second
// ahead, which is exact to the sample. The screen asks `snapshot()` what is sounding *now*, so the
// beat lights follow the audio clock rather than React renders or timers.
//
// It owns its AudioContext, its timer and every click it books, and `stop()` / `dispose()`
// release all of them. Nothing here touches the DOM; the React page drives it.
//
// Honest limits: browsers may slow or pause a page in the background or with the screen locked.
// The timer runs in a worker where one is allowed, which keeps background tabs ticking in most
// desktop browsers, but nothing guarantees it. If the clock stalls, late clicks are skipped
// rather than played in a burst, and if the system takes the audio away (a call, the lock
// screen), the engine stops in an "interrupted" state with a Resume action instead of guessing.
import { Sequencer } from "./sequencer.js";
import { DEFAULT_PREFS, sanitizeConfig, sanitizePrefs } from "./config.js";
import { LEVELS, VOICES, renderVoice } from "./sounds.js";

export const LOOKAHEAD = 0.12; // seconds of clicks booked ahead of the audio clock
const LOOKAHEAD_HIDDEN = 1.5; // with a main-thread timer in a background tab (slowed to ~1/s)
const TICK_MS = 25;
const START_LEAD = 0.08; // the first beat lands this long after Start
const LATE = 0.02; // a click this late is skipped rather than played out of time
const RESUME_TIMEOUT_MS = 3000;
const HISTORY_SECONDS = 4;
const END_TAIL = 0.25; // lets the last click ring before an exercise reports that it finished
const RAMP = 0.015; // time constant for volume changes: smooth, never a step

// A timer that keeps ticking in background tabs: a tiny worker where the browser allows one,
// a plain interval otherwise (which background tabs slow to about once a second).
export function createTicker(intervalMs = TICK_MS) {
  let worker = null;
  let url = null;
  let interval = null;
  let callback = null;
  const fallback = () => {
    clearInterval(interval);
    interval = callback ? setInterval(() => callback && callback(), intervalMs) : null;
  };
  try {
    const code = "let id=0;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}";
    url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onmessage = () => callback && callback();
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      fallback();
    };
  } catch {
    worker = null;
  }
  return {
    get throttled() {
      return !worker;
    },
    start(fn) {
      callback = fn;
      if (worker) worker.postMessage(intervalMs);
      else fallback();
    },
    stop() {
      callback = null;
      if (worker) worker.postMessage(0);
      clearInterval(interval);
      interval = null;
    },
    dispose() {
      this.stop();
      worker?.terminate();
      worker = null;
      if (url) URL.revokeObjectURL(url);
      url = null;
    },
  };
}

function defaultContext() {
  const Ctx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctx) {
    const error = new Error("no web audio");
    error.code = "unsupported";
    throw error;
  }
  return new Ctx({ latencyHint: "interactive" });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      const error = new Error("resume timed out");
      error.code = "blocked";
      reject(error);
    }, ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

const MESSAGES = {
  unsupported: "This browser can't play the click. Visual only still works: turn it on under Sound.",
  blocked: "The browser didn't let the sound start. Press Start again, and check this tab isn't muted.",
  failed: "The sound couldn't start. Press Start again, or turn on Visual only under Sound.",
  interrupted: "The sound was interrupted, maybe by a call, another app or the screen lock.",
  noSoundClock: "Sound wasn't available when this started. Press Start again to play with sound.",
};

function smooth(param, value, now) {
  if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
  else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.setTargetAtTime(value, now, RAMP);
}

export class MetronomeEngine {
  constructor({ createContext = defaultContext, createTicker: makeTicker = createTicker, perfNow, isHidden } = {}) {
    this.createContext = createContext;
    this.makeTicker = makeTicker;
    this.perfNow = perfNow || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.isHidden = isHidden || (() => typeof document !== "undefined" && document.hidden);
    this.config = sanitizeConfig({});
    this.prefs = { ...DEFAULT_PREFS };
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.voices = new Map();
    this.run = null; // this run's gain nodes and every click it has booked
    this.seq = null;
    this.ticker = null;
    this.clock = null; // "audio" or "performance"
    this.perfOrigin = 0;
    this.history = [];
    this.endAt = null;
    this.endReason = null;
    this.last = null; // what the screen showed when playback last stopped
    this.token = 0; // bumped by every start and stop, so stale async work knows to give up
    this.listeners = new Set();
    this.state = { status: "idle", error: null, ended: null, timerDone: false, slipped: false, pending: null, clock: null };
    this.onContextState = () => {
      if (this.state.status === "running" && this.clock === "audio" && this.ctx && this.ctx.state !== "running") this.interrupt();
    };
  }

  // ---- state, for React's useSyncExternalStore ----

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  setState(patch) {
    const next = { ...this.state, ...patch };
    if (Object.keys(next).every((k) => next[k] === this.state[k])) return;
    this.state = next;
    this.listeners.forEach((fn) => fn());
  }

  // ---- settings ----

  setConfig(config) {
    const prev = this.config;
    this.config = config;
    if (!this.seq || (this.state.status !== "running" && this.state.status !== "interrupted")) return;
    this.seq.update(config);
    this.setState({ pending: this.seq.pending() });
    if (this.run && this.ctx) {
      const now = this.ctx.currentTime;
      if (prev.sound.subVolume !== config.sound.subVolume) smooth(this.run.sub.gain, config.sound.subVolume, now);
      if (prev.advanced.poly.volume !== config.advanced.poly.volume) smooth(this.run.poly.gain, config.advanced.poly.volume, now);
    }
  }

  setPrefs(prefs) {
    const prev = this.prefs;
    this.prefs = sanitizePrefs(prefs);
    if (this.master && this.ctx) smooth(this.master.gain, this.muted ? 0 : this.prefs.volume, this.ctx.currentTime);
    if (prev.visualOnly === this.prefs.visualOnly || this.state.status !== "running") return;
    if (this.prefs.visualOnly) {
      this.endRun();
    } else if (this.clock === "audio") {
      this.run = this.makeRun();
    } else {
      this.stop();
      this.setState({ error: MESSAGES.noSoundClock });
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) smooth(this.master.gain, this.muted ? 0 : this.prefs.volume, this.ctx.currentTime);
  }

  // ---- transport ----

  // Starts playback. Safe to call repeatedly: a second call while starting or running does
  // nothing, and a stop() during the wait for the audio wins.
  async start() {
    if (this.state.status === "starting" || this.state.status === "running") return;
    const token = ++this.token;
    this.setState({ status: "starting", error: null, ended: null, timerDone: false, slipped: false, pending: null });
    let clock = "audio";
    try {
      // Create and resume inside the click that called us: iOS only unlocks audio there.
      const ctx = this.ensureContext();
      const resumed = ctx.state === "running" ? null : ctx.resume();
      this.unlock(ctx);
      if (resumed) await withTimeout(resumed, RESUME_TIMEOUT_MS);
      if (token !== this.token) return;
      if (ctx.state !== "running") {
        const error = new Error("not running");
        error.code = "blocked";
        throw error;
      }
    } catch (error) {
      if (token !== this.token) return;
      if (!this.prefs.visualOnly) {
        this.setState({ status: "error", error: MESSAGES[error?.code] || MESSAGES.failed });
        return;
      }
      clock = "performance"; // visual only needs no audio, so a page clock will do
    }
    this.begin(clock);
  }

  stop() {
    this.token += 1;
    if (this.state.status === "idle" || this.state.status === "error") {
      this.setState({ status: "idle", pending: null });
      return;
    }
    this.halt();
    this.seq = null;
    this.setState({ status: "idle", pending: null });
  }

  // After an interruption: starts again on a fresh bar, keeping bar numbers, training progress
  // and elapsed time.
  async resume() {
    if (this.state.status !== "interrupted" || !this.seq) return;
    const token = ++this.token;
    this.setState({ status: "starting", error: null });
    try {
      const resumed = this.ctx.state === "running" ? null : this.ctx.resume();
      if (resumed) await withTimeout(resumed, RESUME_TIMEOUT_MS);
      if (token !== this.token) return;
      if (this.ctx.state !== "running") throw Object.assign(new Error("not running"), { code: "blocked" });
    } catch (error) {
      if (token !== this.token) return;
      this.setState({ status: "interrupted", error: MESSAGES[error?.code] || MESSAGES.failed });
      return;
    }
    this.seq.restartAt(this.now() + START_LEAD);
    this.seq.update(this.config);
    this.history = [];
    this.endAt = null;
    if (!this.prefs.visualOnly) this.run = this.makeRun();
    this.ticker.start(this.tick);
    this.setState({ status: "running", pending: this.seq.pending() });
    this.tick();
  }

  // Plays one bar-strong-normal-sub phrase of a voice, so a sound can be heard before choosing it.
  async preview(voice) {
    try {
      const ctx = this.ensureContext();
      const resumed = ctx.state === "running" ? null : ctx.resume();
      this.unlock(ctx);
      if (resumed) await withTimeout(resumed, RESUME_TIMEOUT_MS);
      if (ctx.state !== "running") return false;
      this.ensureVoices();
      const at = ctx.currentTime + 0.05;
      ["bar", "normal", "sub", "normal"].forEach((level, i) => {
        const src = ctx.createBufferSource();
        src.buffer = this.voices.get(voice)?.[level];
        src.connect(this.master);
        src.start(at + i * 0.28);
        src.onended = () => src.disconnect();
      });
      return true;
    } catch {
      return false;
    }
  }

  // Releases the AudioContext, the timer and every booked click. The engine can start again
  // afterwards and builds fresh ones (React's development mode unmounts and remounts once).
  dispose() {
    this.stop();
    this.ticker?.dispose();
    this.ticker = null;
    if (this.ctx) {
      this.ctx.removeEventListener?.("statechange", this.onContextState);
      try {
        this.ctx.close?.();
      } catch {
        // Already closed.
      }
    }
    this.ctx = null;
    this.master = null;
    this.voices = new Map();
  }

  // ---- what the screen shows ----

  // What is sounding right now (or what was showing when playback stopped). The page reads this
  // on animation frames; it never makes React render.
  snapshot() {
    if (this.state.status !== "running" || !this.history.length) return this.last;
    const t = this.audibleNow();
    let bar = null;
    let main = null;
    let poly = null;
    for (let i = this.history.length - 1; i >= 0 && !(bar && main && (poly || !bar.polyNotes)); i -= 1) {
      const e = this.history[i];
      if (e.t > t) continue;
      if (!bar && e.type === "bar") bar = e;
      else if (!main && e.type === "main") main = e;
      else if (!poly && e.type === "poly") poly = e;
    }
    if (!bar) return { ...(this.last || {}), running: true, waiting: true, t };
    if (main && main.t < bar.t) main = null;
    if (poly && poly.t < bar.t) poly = null;
    const beat = main ? main.beat : 60 / bar.tempo;
    const barLength = bar.duration ?? beat * bar.cells;
    const elapsed = bar.countIn || !main ? bar.elapsed : main.elapsed + Math.min(main.beat, Math.max(0, t - main.beatStart));
    return {
      running: true,
      waiting: false,
      t,
      bar: bar.bar,
      countIn: bar.countIn,
      countInBar: bar.countInBar,
      countInBars: bar.countInBars,
      tempo: main ? main.tempo : bar.tempo,
      phase: bar.phase,
      builder: bar.builder,
      silent: bar.silent,
      timerLeft: bar.timerLeft === null ? null : Math.max(0, bar.timerLeft - (elapsed - bar.elapsed)),
      elapsed,
      cell: main ? main.cell : null,
      sub: main ? main.sub : null,
      subs: main ? main.subs : 1,
      level: main ? main.level : null,
      polyNote: poly ? poly.note : null,
      polyNotes: bar.polyNotes,
      barPos: Math.min(1, Math.max(0, (t - bar.t) / barLength)),
    };
  }

  // ---- internals ----

  now() {
    if (this.clock === "performance") return this.perfNow() / 1000 - this.perfOrigin;
    return this.ctx.currentTime;
  }

  // The audio clock as it reaches the speakers, allowing for output latency (Bluetooth adds a
  // lot), so a light comes on when you hear its click rather than when it was booked.
  audibleNow() {
    const now = this.now();
    if (this.clock !== "audio" || this.prefs.visualOnly) return now;
    const ctx = this.ctx;
    if (typeof ctx.getOutputTimestamp === "function") {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        return Math.min(now, ts.contextTime + (this.perfNow() - ts.performanceTime) / 1000);
      }
    }
    return now - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  ensureContext() {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    const ctx = this.createContext();
    ctx.addEventListener?.("statechange", this.onContextState);
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.prefs.volume;
    // A gentle limiter: when a strong beat, a subdivision and the second layer land together they
    // could add past full scale, and clipping would crackle.
    if (typeof ctx.createDynamicsCompressor === "function") {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;
      master.connect(limiter);
      limiter.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
    this.ctx = ctx;
    this.master = master;
    this.voices = new Map();
    return ctx;
  }

  // A silent sound inside the user's tap: older iOS Safari keeps a context muted without one.
  unlock(ctx) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
      src.onended = () => src.disconnect();
    } catch {
      // Nothing to unlock.
    }
  }

  ensureVoices() {
    if (this.voices.size) return;
    for (const { id } of VOICES) {
      const levels = {};
      for (const level of LEVELS) {
        const samples = renderVoice(id, level, this.ctx.sampleRate);
        const buffer = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
        if (buffer.copyToChannel) buffer.copyToChannel(samples, 0);
        else buffer.getChannelData(0).set(samples);
        levels[level] = buffer;
      }
      this.voices.set(id, levels);
    }
  }

  makeRun() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.master);
    const bus = (value) => {
      const g = ctx.createGain();
      g.gain.value = value;
      g.connect(out);
      return g;
    };
    return {
      out,
      main: bus(1),
      sub: bus(this.config.sound.subVolume),
      poly: bus(this.config.advanced.poly.volume),
      sources: new Set(),
    };
  }

  // Fades this run out over a few milliseconds and cancels every click it booked, including the
  // ones still in the future, so nothing sounds after Stop and nothing pops.
  endRun() {
    const run = this.run;
    this.run = null;
    if (!run || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gain = run.out.gain;
    if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
    }
    gain.setTargetAtTime(0, now, 0.004);
    for (const src of run.sources) {
      try {
        src.stop(now + 0.03);
      } catch {
        // Already stopped.
      }
    }
    run.sources.clear();
    setTimeout(() => {
      try {
        run.out.disconnect();
      } catch {
        // Already gone.
      }
    }, 150);
  }

  begin(clock) {
    this.clock = clock;
    if (clock === "performance") this.perfOrigin = this.perfNow() / 1000;
    else this.ensureVoices();
    if (!this.ticker) this.ticker = this.makeTicker();
    this.seq = new Sequencer(this.config, this.now() + START_LEAD);
    this.history = [];
    this.endAt = null;
    this.endReason = null;
    this.last = null;
    this.run = clock === "audio" && !this.prefs.visualOnly ? this.makeRun() : null;
    this.ticker.start(this.tick);
    this.setState({ status: "running", clock, pending: null });
    this.tick();
  }

  // Stops scheduling, keeps what the screen showed, and releases this run's sound.
  halt() {
    this.ticker?.stop();
    if (this.state.status === "running") this.last = { ...this.snapshot(), running: false };
    else if (this.last) this.last = { ...this.last, running: false };
    this.endRun();
  }

  interrupt() {
    this.halt();
    this.setState({ status: "interrupted", error: MESSAGES.interrupted, pending: null });
  }

  finish(reason) {
    this.halt();
    this.seq = null;
    this.setState({ status: "idle", ended: reason, pending: null });
  }

  lookahead() {
    return this.ticker?.throttled && this.isHidden() ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
  }

  sounding() {
    return Boolean(this.run) && !this.prefs.visualOnly && this.clock === "audio";
  }

  playClick(e) {
    const run = this.run;
    const voice = e.type === "poly" ? this.config.advanced.poly.voice : this.config.sound.voice;
    const buffer = this.voices.get(voice)?.[e.level];
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(e.type === "poly" ? run.poly : e.level === "sub" ? run.sub : run.main);
    src.start(Math.max(e.t, this.ctx.currentTime));
    run.sources.add(src);
    src.onended = () => {
      run.sources.delete(src);
      try {
        src.disconnect();
      } catch {
        // Already gone.
      }
    };
  }

  tick = () => {
    if (this.state.status !== "running" || !this.seq) return;
    if (this.clock === "audio" && this.ctx.state !== "running") {
      this.interrupt();
      return;
    }
    const now = this.now();
    if (this.endAt !== null && now >= this.endAt + END_TAIL) {
      this.finish(this.endReason);
      return;
    }
    const horizon = now + this.lookahead();
    let skipped = 0;
    for (;;) {
      const e = this.seq.peek();
      if (!e || e.t >= horizon) break;
      this.seq.take();
      if (e.type === "end") {
        this.endAt = e.t;
        this.endReason = e.reason;
        continue;
      }
      this.history.push(e);
      if (e.type === "mark") continue;
      if (e.type === "bar") continue;
      // Late (the page was paused or busy): skip it so the beat carries on in time, no burst.
      if (e.t < now - LATE) {
        skipped += 1;
        continue;
      }
      if (e.audible && this.sounding()) this.playClick(e);
    }
    // The timer's "time's up" moment, once it is actually heard.
    for (const e of this.history) {
      if (e.type === "mark" && e.t <= now && !this.state.timerDone) this.setState({ timerDone: true });
    }
    if (skipped) this.setState({ slipped: true });
    this.prune(now);
    const pending = this.seq.pending();
    if (pending !== this.state.pending) this.setState({ pending });
  };

  // Keeps the last few seconds, and always the newest bar, beat and second-layer note that have
  // already sounded (a slow bar can be longer than the window, and the screen needs all three).
  prune(now) {
    const cutoff = now - HISTORY_SECONDS;
    if (!this.history.length || this.history[0].t >= cutoff) return;
    const keep = new Set();
    const seen = new Set();
    for (let i = this.history.length - 1; i >= 0 && seen.size < 3; i -= 1) {
      const e = this.history[i];
      if (e.t > now || seen.has(e.type) || !["bar", "main", "poly"].includes(e.type)) continue;
      seen.add(e.type);
      keep.add(i);
    }
    this.history = this.history.filter((e, i) => e.t >= cutoff || keep.has(i));
  }
}

export function createEngine(deps) {
  return new MetronomeEngine(deps);
}
