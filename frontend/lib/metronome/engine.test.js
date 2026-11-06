import test from "node:test";
import assert from "node:assert/strict";
import { MetronomeEngine } from "./engine.js";
import { sanitizeConfig } from "./config.js";

// A stand-in for the Web Audio API: a clock the test moves by hand, and a record of every sound
// booked and cancelled.
class Param {
  constructor(value) {
    this.value = value;
    this.calls = [];
  }
  setValueAtTime(v, t) {
    this.calls.push(["set", v, t]);
    this.value = v;
  }
  setTargetAtTime(v, t, tc) {
    this.calls.push(["target", v, t, tc]);
    this.value = v;
  }
  cancelScheduledValues(t) {
    this.calls.push(["cancel", t]);
  }
  cancelAndHoldAtTime(t) {
    this.calls.push(["hold", t]);
  }
}
class Node {
  constructor(ctx) {
    this.ctx = ctx;
    this.outputs = [];
  }
  connect(node) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.outputs = [];
  }
}
class Source extends Node {
  start(t) {
    this.startAt = t;
    this.ctx.booked.push(this);
  }
  stop(t) {
    this.stopAt = t ?? this.ctx.currentTime;
  }
}
class FakeContext {
  constructor({ resume = "ok" } = {}) {
    this.currentTime = 0;
    this.state = "suspended";
    this.sampleRate = 48000;
    this.destination = new Node(this);
    this.booked = [];
    this.listeners = new Set();
    this.resumeMode = resume;
    this.closed = false;
  }
  createGain() {
    const g = new Node(this);
    g.gain = new Param(1);
    return g;
  }
  createBufferSource() {
    return new Source(this);
  }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { length, sampleRate, getChannelData: () => data, copyToChannel: (src) => data.set(src) };
  }
  resume() {
    if (this.resumeMode === "reject") return Promise.reject(Object.assign(new Error("NotAllowedError"), { name: "NotAllowedError" }));
    if (this.resumeMode === "hang") return new Promise(() => {});
    this.setState("running");
    return Promise.resolve();
  }
  close() {
    this.closed = true;
    this.state = "closed";
    return Promise.resolve();
  }
  addEventListener(type, fn) {
    if (type === "statechange") this.listeners.add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.delete(fn);
  }
  setState(state) {
    this.state = state;
    this.listeners.forEach((fn) => fn());
  }
}

function setup(options = {}) {
  const ctx = new FakeContext(options);
  const ticker = {
    starts: 0,
    fn: null,
    throttled: false,
    start(fn) {
      this.fn = fn;
      this.starts += 1;
    },
    stop() {
      this.fn = null;
    },
    dispose() {
      this.disposed = true;
    },
  };
  let contexts = 0;
  const engine = new MetronomeEngine({
    createContext: () => {
      contexts += 1;
      return ctx;
    },
    createTicker: () => ticker,
    perfNow: () => ctx.currentTime * 1000,
    isHidden: () => false,
  });
  engine.setConfig(sanitizeConfig(options.config ?? { tempo: 120 }));
  // Moves the audio clock forward in timer-sized steps, ticking the scheduler each time.
  const advance = (seconds, step = 0.025) => {
    const end = ctx.currentTime + seconds;
    while (ctx.currentTime < end - 1e-9) {
      ctx.currentTime = Math.min(end, ctx.currentTime + step);
      ticker.fn?.();
    }
  };
  const clicks = () => ctx.booked.filter((s) => s.buffer && s.buffer.length > 1);
  return { ctx, ticker, engine, advance, clicks, contexts: () => contexts };
}

const round = (list) => list.map((t) => +t.toFixed(4));

test("clicks are booked on the audio clock, a beat apart, just after Start", async () => {
  const { engine, advance, clicks } = setup();
  await engine.start();
  assert.equal(engine.getState().status, "running");
  advance(2);
  assert.deepEqual(round(clicks().map((s) => s.startAt)), [0.08, 0.58, 1.08, 1.58, 2.08]);
});

test("Stop cancels every booked click, including ones still in the future", async () => {
  const { engine, ctx, advance, clicks, ticker } = setup();
  await engine.start();
  advance(1.0);
  const booked = clicks();
  const future = booked.filter((s) => s.startAt > ctx.currentTime);
  assert.ok(future.length > 0, "the scheduler had booked ahead");
  engine.stop();
  assert.equal(engine.getState().status, "idle");
  assert.ok(booked.every((s) => s.stopAt !== undefined), "every click was told to stop");
  assert.ok(future.every((s) => s.stopAt < s.startAt), "future clicks stop before they would start");
  assert.equal(ticker.fn, null, "the timer is stopped");
  const before = clicks().length;
  advance(2);
  assert.equal(clicks().length, before, "nothing more is booked");
  assert.equal(engine.snapshot().running, false);
});

test("rapid Start/Stop/Start leaves one scheduler and no doubled clicks", async () => {
  const { engine, advance, clicks, contexts } = setup();
  const first = engine.start();
  engine.stop(); // before the audio has even resumed
  const second = engine.start();
  const third = engine.start(); // ignored: already starting
  await Promise.all([first, second, third]);
  assert.equal(engine.getState().status, "running");
  advance(2);
  const times = round(clicks().filter((s) => s.stopAt === undefined).map((s) => s.startAt));
  assert.equal(new Set(times).size, times.length, "no click is booked twice");
  assert.deepEqual(times.slice(0, 4), [0.08, 0.58, 1.08, 1.58]);
  assert.equal(contexts(), 1, "one AudioContext for the engine's life");
});

test("a refused or stalled resume reports an error instead of playing", async () => {
  const refused = setup({ resume: "reject" });
  await refused.engine.start();
  assert.equal(refused.engine.getState().status, "error");
  assert.match(refused.engine.getState().error, /Press Start again/);
  assert.equal(refused.clicks().length, 0);
});

test("visual only runs without sound, even when audio can't start", async () => {
  const { engine, clicks, advance } = setup({ resume: "reject" });
  engine.setPrefs({ volume: 0.8, visualOnly: true });
  await engine.start();
  assert.equal(engine.getState().status, "running");
  assert.equal(engine.getState().clock, "performance");
  advance(1);
  assert.equal(clicks().length, 0);
});

test("a stalled clock skips the late clicks instead of firing a burst", async () => {
  const { engine, ctx, ticker, clicks } = setup();
  await engine.start();
  ticker.fn();
  const before = clicks().length;
  // The page freezes for 3 seconds: no ticks, but the audio clock moves on.
  ctx.currentTime = 3.0;
  ticker.fn();
  const after = clicks().slice(before);
  assert.ok(after.every((s) => s.startAt >= 3.0 - 0.02), "nothing is booked in the past");
  assert.ok(after.length <= 1, "at most the next beat, not the six that were missed");
  assert.equal(engine.getState().slipped, true);
  // And the beat carries on in time: 3.08 is on the original grid (0.08 + 6 × 0.5).
  ctx.currentTime = 3.1;
  ticker.fn();
  assert.ok(clicks().some((s) => Math.abs(s.startAt - 3.08) < 1e-9));
});

test("an interruption stops cleanly and Resume starts a fresh bar, counting on", async () => {
  const { engine, ctx, advance, clicks } = setup({ config: { tempo: 120 } });
  await engine.start();
  advance(4.5); // into the third bar
  const booked = clicks();
  ctx.setState("suspended"); // a phone call takes the audio
  assert.equal(engine.getState().status, "interrupted");
  assert.match(engine.getState().error, /interrupted/);
  assert.ok(booked.every((s) => s.stopAt !== undefined), "booked clicks are cancelled");
  ctx.currentTime = 30;
  await engine.resume();
  assert.equal(engine.getState().status, "running");
  advance(0.2);
  const snap = engine.snapshot();
  assert.equal(snap.bar, 3, "bars 0-2 happened, so this is bar 3");
  assert.ok(clicks().some((s) => Math.abs(s.startAt - 30.08) < 1e-9), "the new bar starts just after Resume");
});

test("a stop during the wait for the audio wins", async () => {
  const { engine, clicks } = setup({ resume: "hang" });
  const starting = engine.start();
  assert.equal(engine.getState().status, "starting");
  engine.stop();
  assert.equal(engine.getState().status, "idle");
  void starting;
  assert.equal(clicks().length, 0);
});

test("the beat lights follow what is audible, allowing for output latency", async () => {
  const { engine, ctx, advance } = setup();
  ctx.outputLatency = 0.2;
  await engine.start();
  advance(0.65); // beat 2 was booked for 0.58, but it reaches the speakers at 0.78
  assert.equal(engine.snapshot().cell, 0);
  advance(0.2);
  assert.equal(engine.snapshot().cell, 1);
});

test("snapshot reports bar, beat, elapsed time and the training state", async () => {
  const builder = { start: 60, target: 70, step: 5, bars: 1, atTarget: "stop" };
  const { engine, advance } = setup({ config: { tempo: 60, training: { mode: "builder", builder } } });
  await engine.start();
  advance(4.5);
  const snap = engine.snapshot();
  assert.equal(snap.bar, 1);
  assert.equal(snap.tempo, 65);
  assert.equal(snap.builder.stage, 1);
  assert.equal(snap.builder.nextTempo, 70);
  assert.ok(Math.abs(snap.elapsed - (4.5 - 0.08)) < 0.03);
  // The climb ends by itself, after the last bar has rung.
  advance(10);
  assert.equal(engine.getState().status, "idle");
  assert.equal(engine.getState().ended, "target");
});

test("volume changes glide instead of jumping", async () => {
  const { engine, advance } = setup({ config: { tempo: 120, subdivision: 2 } });
  await engine.start();
  advance(0.3);
  const config = sanitizeConfig({ tempo: 120, subdivision: 2, sound: { subVolume: 0.2 } });
  engine.setConfig(config);
  const calls = engine.run.sub.gain.calls;
  assert.equal(calls.at(-1)[0], "target", "a setTargetAtTime ramp, not a step");
  assert.equal(calls.at(-1)[1], 0.2);
  engine.setMuted(true);
  assert.equal(engine.master.gain.calls.at(-1)[0], "target");
});

test("changes wait for their boundary and the engine says so", async () => {
  const { engine, advance } = setup();
  await engine.start();
  advance(0.3);
  engine.setConfig(sanitizeConfig({ tempo: 120, meter: { beats: 3, unit: 4 } }));
  assert.equal(engine.getState().pending, "bar");
  advance(2);
  assert.equal(engine.getState().pending, null);
});

test("dispose releases the clock, the timer and the AudioContext", async () => {
  const { engine, ctx, ticker, contexts } = setup();
  await engine.start();
  engine.dispose();
  assert.equal(engine.getState().status, "idle");
  assert.equal(ctx.closed, true);
  assert.equal(ticker.disposed, true);
  assert.equal(ctx.listeners.size, 0);
  // React's development mode unmounts and remounts once, so a disposed engine can start afresh.
  await engine.start();
  assert.equal(engine.getState().status, "running");
  assert.equal(contexts(), 2, "with a new AudioContext");
  engine.dispose();
});
