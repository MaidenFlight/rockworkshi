// The beat maker's audio engine: one AudioContext (made on the first tap or key), the kit's
// voices, the metronome click, and the transport that plays a part on a loop or the whole song.
//
// Scheduling works like the metronome's: a timer wakes about every 25 ms, but the timer never
// decides when a drum sounds. Every hit is booked on AudioContext.currentTime a little ahead,
// exact to the sample, and the screen asks `snapshot()` what is sounding *now*, so the playhead
// and the pad lights follow the audio clock rather than React renders or timers.
//
// It owns its AudioContext, timer and voices, and dispose() releases them. Nothing here touches
// the DOM; the React page drives it.
import { createTicker } from "../metronome/engine.js";
import { renderVoice } from "../metronome/sounds.js";
import { Sequencer, quantize } from "./sequencer.js";
import { getSample, upgradeKit } from "./samples.js";
import { KitVoices } from "./voices.js";

const LOOKAHEAD = 0.12;
const START_LEAD = 0.06; // the first step lands this long after Play
const LATE = 0.03; // a hit this late (the page was busy) is skipped, not played out of time
const HISTORY_SECONDS = 6;
const RESUME_TIMEOUT_MS = 3000;
const CLICK_VOICE = "clave";

const MESSAGES = {
  unsupported: "This browser can't play sound here.",
  blocked: "The browser didn't let the sound start. Press Play again, and check this tab isn't muted.",
  interrupted: "The sound was interrupted, maybe by a call, another app or the screen lock. Press Play to carry on.",
};

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(Object.assign(new Error("timed out"), { code: "blocked" })), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export class DrumEngine {
  constructor() {
    this.beat = null; // the latest beat, read afresh at every step so edits are heard at once
    this.getBeat = () => this.beat;
    this.ctx = null;
    this.master = null;
    this.kit = null;
    this.clickBuffers = null;
    this.prefs = { volume: 0.9, mix: {}, muted: [], click: false };
    this.seq = null;
    this.mode = null;
    this.ticker = null;
    this.history = []; // step events already booked
    this.hits = []; // hit events already booked, for the pad lights
    this.endAt = null;
    this.onRecord = null; // (part, step, piece, level) for each note played while recording
    this.listeners = new Set();
    this.state = { status: "idle", error: null, recording: false, mode: null, countIn: false, ended: false };
    this.onContextState = () => {
      if (this.state.status === "running" && this.ctx && this.ctx.state !== "running") this.interrupt();
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

  setBeat(beat) {
    this.beat = beat;
  }

  setPrefs(prefs) {
    this.prefs = { ...this.prefs, ...prefs };
    if (!this.ctx) return;
    this.kit.setMix(this.prefs.mix, this.prefs.muted);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.prefs.volume, now, 0.015);
  }

  setRecording(on) {
    this.setState({ recording: Boolean(on) });
  }

  // Called with (part, step, piece, level) for every note played while recording.
  setRecordHandler(fn) {
    this.onRecord = fn;
  }

  // ---- the context ----

  // Made inside a tap or key press: iOS only lets audio start there.
  ensureContext() {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    const Ctx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctx) throw Object.assign(new Error("no web audio"), { code: "unsupported" });
    const ctx = new Ctx({ latencyHint: "interactive" });
    ctx.addEventListener?.("statechange", this.onContextState);
    const master = ctx.createGain();
    master.gain.value = this.prefs.volume;
    // A limiter at the end: a kick, a snare and a crash together can add up past full scale.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 2;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.kit = new KitVoices(ctx, master, getSample);
    this.kit.setMix(this.prefs.mix, this.prefs.muted, { immediate: true });
    this.clickBuffers = null;
    // Decode the recordings again at this device's own rate, in the background.
    upgradeKit(ctx);
    return ctx;
  }

  // Older iOS Safari keeps a context muted unless something plays inside the tap.
  unlock(ctx) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Nothing to unlock.
    }
  }

  // Wakes the context inside a gesture. Resolves true once sound can play.
  async wake() {
    let ctx;
    try {
      ctx = this.ensureContext();
    } catch (error) {
      this.setState({ error: MESSAGES[error.code] || MESSAGES.blocked });
      return false;
    }
    if (ctx.state === "running") return true;
    const resumed = ctx.resume();
    this.unlock(ctx);
    try {
      await withTimeout(resumed, RESUME_TIMEOUT_MS);
    } catch {
      // Reported below.
    }
    if (ctx.state !== "running") {
      this.setState({ error: MESSAGES.blocked });
      return false;
    }
    if (this.state.error === MESSAGES.blocked) this.setState({ error: null });
    return true;
  }

  // ---- playing by hand ----

  // A pad or key: sounds at once. While recording, the note also goes into the beat, on the
  // nearest step to where it was heard.
  hit(piece, level) {
    let ctx;
    try {
      ctx = this.ensureContext();
    } catch (error) {
      this.setState({ error: MESSAGES[error.code] || MESSAGES.blocked });
      return;
    }
    // Booked now, on the clock as it stands: a context that is still starting (the very first tap)
    // plays it with its first sound, without waiting here for the start to be confirmed.
    if (ctx.state !== "running") this.wake();
    this.kit.hit(piece, level, ctx.currentTime);
    if (this.state.recording && this.state.status === "running") this.record(piece, level);
  }

  record(piece, level) {
    const time = this.audibleNow();
    let e = null;
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      if (this.history[i].t <= time) {
        e = this.history[i];
        break;
      }
    }
    const beat = this.getBeat();
    const q = quantize(this.seq, beat, e, time);
    if (!q || !q.part) return;
    this.onRecord?.(q.part, q.step, piece, level);
    // If that step hasn't been booked yet, the loop would play the note again right after the
    // one just heard: leave it out this once.
    const stepTime = q.bar === e.bar && q.step === e.step ? e.t : e.t + e.dur;
    if (stepTime >= this.seq.t - 1e-6) this.seq.skip(q.bar, q.step, piece);
  }

  // ---- the transport ----

  // mode: { type: "part", part } or { type: "song", loop, from }. A count-in bar plays first when
  // asked (always while recording from a stop).
  async play(mode, { countIn = false } = {}) {
    if (this.state.status === "starting") return;
    if (this.state.status === "running") this.halt();
    this.setState({ status: "starting", error: null, ended: false });
    const ok = await this.wake();
    if (!ok) {
      this.setState({ status: "idle" });
      return;
    }
    if (this.state.status !== "starting") return; // stopped while waking
    const ctx = this.ctx;
    this.ensureClicks();
    this.mode = mode;
    this.seq = new Sequencer(this.getBeat, mode, ctx.currentTime + START_LEAD, {
      countInBars: countIn ? 1 : 0,
      click: () => this.prefs.click,
    });
    this.history = [];
    this.hits = [];
    this.endAt = null;
    this.ticker ??= createTicker();
    this.ticker.start(this.tick);
    this.setState({ status: "running", mode: mode.type, countIn });
    this.tick();
  }

  // Playing the song: whether it goes round again at the end, decided while it plays.
  setSongLoop(loop) {
    if (this.seq && this.mode?.type === "song") {
      this.mode = { ...this.mode, loop };
      this.seq.mode = { ...this.seq.mode, loop };
    }
  }

  // Looping a part: the newly chosen part takes over at the next bar line.
  followPart(part) {
    if (this.state.status === "running" && this.mode?.type === "part" && this.mode.part !== part) {
      this.mode = { ...this.mode, part };
      this.seq?.queuePart(part);
    }
  }

  stop() {
    if (this.state.status === "idle") return;
    this.halt();
    this.setState({ status: "idle", countIn: false });
  }

  // Stops booking, silences the sequencer's hits (not the pads), keeps the context.
  halt() {
    this.ticker?.stop();
    this.seq = null;
    this.history = [];
    this.hits = [];
    this.kit?.stopTagged("seq", 0.03);
    this.stopClicks();
  }

  interrupt() {
    this.halt();
    this.setState({ status: "idle", error: MESSAGES.interrupted });
  }

  // The song reached its end: the last hits ring out on their own.
  finish() {
    this.ticker?.stop();
    this.seq = null;
    this.setState({ status: "idle", ended: true, countIn: false });
  }

  ensureClicks() {
    if (this.clickBuffers) return;
    const make = (level) => {
      const samples = renderVoice(CLICK_VOICE, level, this.ctx.sampleRate);
      const buffer = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      return buffer;
    };
    this.clickBuffers = { bar: make("bar"), normal: make("normal") };
    this.clickSources = new Set();
  }

  playClick(level, t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.clickBuffers[level] || this.clickBuffers.normal;
    const g = this.ctx.createGain();
    g.gain.value = 0.55;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
    this.clickSources.add(src);
    src.onended = () => {
      this.clickSources.delete(src);
      g.disconnect();
    };
  }

  stopClicks() {
    for (const src of this.clickSources || []) {
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
    }
    this.clickSources?.clear();
  }

  tick = () => {
    if (this.state.status !== "running" || !this.seq) return;
    const ctx = this.ctx;
    if (ctx.state !== "running") {
      this.interrupt();
      return;
    }
    const now = ctx.currentTime;
    if (this.endAt !== null && now >= this.endAt) {
      this.finish();
      return;
    }
    const horizon = now + LOOKAHEAD;
    for (;;) {
      const e = this.seq.peek();
      if (!e || e.t >= horizon) break;
      this.seq.take();
      if (e.type === "end") {
        this.endAt = e.t;
        continue;
      }
      if (e.type === "step") {
        this.history.push(e);
        if (this.state.countIn && !e.countIn) this.setState({ countIn: false });
        continue;
      }
      if (e.type === "bar") continue;
      if (e.t < now - LATE) continue;
      if (e.type === "hit") {
        this.kit.hit(e.piece, e.level, e.t, { tag: "seq", humanize: true });
        this.hits.push(e);
      } else if (e.type === "click") {
        this.playClick(e.level, e.t);
      }
    }
    const cutoff = now - HISTORY_SECONDS;
    if (this.history.length > 512 || (this.history[0] && this.history[0].t < cutoff)) {
      this.history = this.history.filter((e, i, list) => e.t >= cutoff || i === list.length - 1);
    }
    if (this.hits.length && this.hits[0].t < now - 1) this.hits = this.hits.filter((e) => e.t >= now - 1);
  };

  // ---- what the screen shows ----

  // The audio clock as it reaches the speakers (Bluetooth adds a lot), so a light comes on when
  // its drum is heard rather than when it was booked.
  audibleNow() {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const now = ctx.currentTime;
    if (typeof ctx.getOutputTimestamp === "function") {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        return Math.min(now, ts.contextTime + (performance.now() - ts.performanceTime) / 1000);
      }
    }
    return now - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  // The step sounding now, or null when stopped or before the first step is heard.
  snapshot() {
    if (this.state.status !== "running" || !this.history.length) return null;
    const t = this.audibleNow();
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const e = this.history[i];
      if (e.t <= t) return { t, bar: e.bar, step: e.step, steps: e.steps, part: e.part, block: e.block, songBar: e.songBar, countIn: e.countIn, at: e.t };
    }
    return null;
  }

  // Hits heard in (from, to], for lighting the pads the beat plays.
  hitsBetween(from, to) {
    return this.hits.filter((e) => e.t > from && e.t <= to);
  }

  dispose() {
    this.halt();
    this.ticker?.dispose();
    this.ticker = null;
    if (this.ctx) {
      this.ctx.removeEventListener?.("statechange", this.onContextState);
      try {
        this.ctx.close();
      } catch {
        // Already closed.
      }
    }
    this.ctx = null;
    this.kit = null;
    this.master = null;
  }
}
