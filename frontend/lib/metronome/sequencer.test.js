import test from "node:test";
import assert from "node:assert/strict";
import { Sequencer } from "./sequencer.js";
import { sanitizeConfig, setField, setMeter } from "./config.js";
import { builderStages } from "./training.js";

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ""} expected ${expected}, got ${actual}`);

// Takes every event before `until` (seconds).
function run(config, until, start = 0) {
  const seq = new Sequencer(sanitizeConfig(config), start);
  const out = [];
  for (let e = seq.peek(); e && e.t < until; e = seq.peek()) out.push(seq.take());
  return { seq, out };
}
const mains = (events) => events.filter((e) => e.type === "main");
const bars = (events) => events.filter((e) => e.type === "bar");

test("quarter = 120 in 4/4: quarter notes are 0.5 s apart and a bar is 2 s", () => {
  const { out } = run({ tempo: 120 }, 4);
  const beats = mains(out);
  assert.equal(beats.length, 8);
  beats.forEach((e, i) => close(e.t, i * 0.5, `beat ${i}`));
  assert.deepEqual(bars(out).map((b) => b.t), [0, 2]);
  assert.deepEqual(beats.slice(0, 4).map((e) => e.level), ["bar", "normal", "normal", "normal"]);
});

test("dotted quarter = 60 in 6/8: each eighth is 1/3 s and a bar lasts 2 s", () => {
  const config = { tempo: 60, meter: { beats: 6, unit: 8, groups: [3, 3], pulse: "group" }, subdivision: 3 };
  const { out } = run(config, 4);
  const notes = mains(out);
  assert.equal(notes.length, 12, "six eighths per bar, two bars");
  notes.forEach((e, i) => close(e.t, i / 3, `eighth ${i}`));
  assert.deepEqual(bars(out).map((b) => b.t), [0, 2]);
  // Two beat cells, each with its three eighths: the first of each is the beat, the rest subdivisions.
  assert.deepEqual(notes.slice(0, 6).map((e) => `${e.cell}.${e.sub}`), ["0.0", "0.1", "0.2", "1.0", "1.1", "1.2"]);
  assert.deepEqual(notes.slice(0, 6).map((e) => e.level), ["bar", "sub", "sub", "normal", "sub", "sub"]);
});

test("7/8 grouped 2+2+3 at eighth = 210 accents each group start", () => {
  const config = { tempo: 210, meter: { beats: 7, unit: 8, groups: [2, 2, 3] } };
  const { out } = run(config, 2);
  const bar = mains(out).slice(0, 7);
  assert.deepEqual(bar.map((e) => e.level), ["bar", "normal", "strong", "normal", "strong", "normal", "normal"]);
  bar.forEach((e, i) => close(e.t, (i * 60) / 210));
  close(bars(out)[1].t, (7 * 60) / 210, "the bar is seven eighths long");
});

test("a silent beat stays in the timeline, and its subdivisions still sound", () => {
  const config = { tempo: 60, accents: ["strong", "silent", "normal", "normal"], subdivision: 2 };
  const { out } = run(config, 4);
  const beat2 = mains(out).filter((e) => e.cell === 1);
  close(beat2[0].t, 1);
  assert.equal(beat2[0].level, "silent");
  assert.equal(beat2[0].audible, false);
  assert.equal(beat2[1].audible, true, "the and of 2 still clicks");
  close(beat2[1].t, 1.5);
  close(mains(out).find((e) => e.cell === 2).t, 2, "beat 3 is exactly where it would be");
});

test("swing moves the second eighth of each beat", () => {
  const config = { tempo: 60, subdivision: 2, advanced: { swing: 67 } };
  const { out } = run(config, 2);
  assert.deepEqual(mains(out).map((e) => +e.t.toFixed(4)), [0, 0.67, 1, 1.67]);
});

test("a one-bar count-in plays every beat, then practice starts on the next bar line", () => {
  const config = { tempo: 120, practice: { countIn: 1 }, accents: ["strong", "silent", "silent", "silent"] };
  const { out } = run(config, 4);
  const count = mains(out).filter((e) => e.countIn);
  assert.equal(count.length, 4);
  assert.ok(count.every((e) => e.audible), "silent beats still count in");
  assert.deepEqual(count.map((e) => e.level), ["bar", "normal", "normal", "normal"]);
  const first = bars(out).find((b) => !b.countIn);
  close(first.t, 2);
  assert.equal(first.bar, 0);
  assert.equal(first.elapsed, 0, "the count-in isn't practice time");
  assert.deepEqual(mains(out).filter((e) => !e.countIn && e.cell > 0).map((e) => e.audible), [false, false, false]);
});

test("two bars of count-in", () => {
  const { out } = run({ tempo: 120, practice: { countIn: 2 } }, 5);
  assert.deepEqual(bars(out).map((b) => [b.t, b.countIn, b.countInBar]), [
    [0, true, 1],
    [2, true, 2],
    [4, false, null],
  ]);
});

test("tempo builder: steps at bar lines with no skipped or doubled beats, and stops after the target", () => {
  const builder = { start: 60, target: 70, step: 5, bars: 2, atTarget: "stop" };
  const { seq, out } = run({ training: { mode: "builder", builder } }, 1000);
  assert.equal(seq.done, true);
  const beats = mains(out);
  assert.equal(beats.length, 3 * 2 * 4, "three stages of two bars of four beats");
  // Every beat follows the previous by exactly 60 / (its bar's tempo).
  for (let i = 1; i < beats.length; i += 1) close(beats[i].t - beats[i - 1].t, 60 / beats[i - 1].tempo, `gap before beat ${i}`);
  assert.deepEqual(bars(out).map((b) => b.tempo), [60, 60, 65, 65, 70, 70]);
  const end = out.find((e) => e.type === "end");
  assert.equal(end.reason, "target");
  close(end.t, 8 + 8 * (60 / 65) + 8 * (60 / 70), "ends on the bar line after the last bar");
});

test("tempo builder holds the target when asked, and works downward", () => {
  const hold = { start: 60, target: 70, step: 5, bars: 1, atTarget: "hold" };
  const { seq, out } = run({ training: { mode: "builder", builder: hold } }, 40);
  assert.equal(seq.done, false);
  assert.deepEqual(bars(out).slice(0, 6).map((b) => b.tempo), [60, 65, 70, 70, 70, 70]);
  assert.equal(bars(out)[3].builder.holding, true);
  const down = run({ training: { mode: "builder", builder: { start: 100, target: 90, step: 5, bars: 1, atTarget: "stop" } } }, 100);
  assert.deepEqual(bars(down.out).map((b) => b.tempo), [100, 95, 90]);
});

test("the last tempo step lands exactly on the target", () => {
  assert.deepEqual(builderStages({ start: 60, target: 100, step: 7 }), [60, 67, 74, 81, 88, 95, 100]);
  assert.deepEqual(builderStages({ start: 60, target: 100, step: 5 }).length, 9);
  assert.deepEqual(builderStages({ start: 80, target: 80, step: 5 }), [80]);
});

test("tempo builder counts in at its starting tempo", () => {
  const builder = { start: 60, target: 100, step: 5, bars: 8, atTarget: "hold" };
  const { out } = run({ tempo: 140, practice: { countIn: 1 }, training: { mode: "builder", builder } }, 6);
  assert.equal(bars(out)[0].countIn, true);
  assert.equal(bars(out)[0].tempo, 60);
  close(bars(out)[1].t, 4);
});

test("silent bars: two on, two off, with the clock running through the silence", () => {
  const silent = { play: 2, rest: 2, showCues: true };
  const { out } = run({ tempo: 120, training: { mode: "silent", silent } }, 10);
  assert.deepEqual(bars(out).map((b) => b.phase), ["play", "play", "rest", "rest", "play"]);
  assert.deepEqual(bars(out).map((b) => b.silent.barsLeft), [2, 1, 2, 1, 2]);
  const rest = mains(out).filter((e) => e.bar === 2 || e.bar === 3);
  assert.equal(rest.length, 8, "the silent bars still have their beats");
  assert.ok(rest.every((e) => !e.audible));
  rest.forEach((e, i) => close(e.t, 4 + i * 0.5));
  assert.ok(mains(out).filter((e) => e.bar === 4).every((e, i) => (i === 0 ? e.level === "bar" : true) && e.audible));
});

test("timer: stops on the first bar line at or after the time, not mid-bar", () => {
  const { seq, out } = run({ tempo: 120, practice: { timerMinutes: 1, timerEnd: "stop" } }, 1000);
  assert.equal(seq.done, true);
  const end = out.find((e) => e.type === "end");
  assert.equal(end.reason, "timer");
  close(end.t, 60);
  assert.equal(bars(out).length, 30);
  // With a count-in, the practice minute starts after it.
  const counted = run({ tempo: 120, practice: { countIn: 1, timerMinutes: 1, timerEnd: "stop" } }, 1000);
  close(counted.out.find((e) => e.type === "end").t, 62);
  // 3/4 at 50: bars are 3.6 s, so a minute ends on the bar line at 61.2 s.
  const odd = run({ tempo: 50, meter: { beats: 3, unit: 4 }, practice: { timerMinutes: 1, timerEnd: "stop" } }, 1000);
  close(odd.out.find((e) => e.type === "end").t, 17 * 3.6);
});

test("timer that keeps playing marks the moment and carries on", () => {
  const { seq, out } = run({ tempo: 120, practice: { timerMinutes: 1, timerEnd: "continue" } }, 70);
  assert.equal(seq.done, false);
  const marks = out.filter((e) => e.type === "mark");
  assert.equal(marks.length, 1);
  close(marks[0].t, 60);
  assert.ok(mains(out).some((e) => e.t > 65));
});

test("3:2 polyrhythm: both layers meet at every cycle boundary", () => {
  const config = { tempo: 60, meter: { beats: 2, unit: 4 }, advanced: { poly: { on: true, notes: 3 } } };
  const { out } = run(config, 6.01);
  const a = mains(out).map((e) => e.t);
  const b = out.filter((e) => e.type === "poly").map((e) => e.t);
  assert.deepEqual(a.map((t) => +t.toFixed(6)), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(b.map((t) => +t.toFixed(6)), [0, 0.666667, 1.333333, 2, 2.666667, 3.333333, 4, 4.666667, 5.333333, 6]);
  for (const boundary of [0, 2, 4, 6]) {
    assert.ok(a.some((t) => Math.abs(t - boundary) < 1e-9) && b.some((t) => Math.abs(t - boundary) < 1e-9), `both at ${boundary}`);
  }
  // Inside the cycle they never coincide (3 and 2 share no factor).
  assert.ok(b.filter((t) => t % 2 > 1e-9 && 2 - (t % 2) > 1e-9).every((t) => !a.some((x) => Math.abs(x - t) < 1e-9)));
  // The main layer sorts first when they land together.
  assert.deepEqual(out.filter((e) => e.t === 0).map((e) => e.type), ["bar", "main", "poly"]);
});

test("4:3 polyrhythm over 3/4", () => {
  const config = { tempo: 90, meter: { beats: 3, unit: 4 }, advanced: { poly: { on: true, notes: 4 } } };
  const { out } = run(config, 2.01);
  const bar = 3 * (60 / 90);
  const b = out.filter((e) => e.type === "poly" && e.bar === 0);
  assert.equal(b.length, 4);
  b.forEach((e, j) => close(e.t, (j * bar) / 4));
  assert.deepEqual(b.map((e) => e.level), ["strong", "normal", "normal", "normal"]);
  close(bars(out)[1].t, bar, "the next cycle starts after three beats");
  close(out.filter((e) => e.type === "poly" && e.bar === 1)[0].t, bar, "and the second layer restarts with it");
});

test("a polyrhythm turns subdivisions off so the two layers stay clear", () => {
  const config = { tempo: 60, subdivision: 4, meter: { beats: 2, unit: 4 }, advanced: { poly: { on: true, notes: 3 } } };
  const { out } = run(config, 2);
  assert.equal(mains(out).length, 2);
});

test("a tempo change while playing starts on the next beat", () => {
  const seq = new Sequencer(sanitizeConfig({ tempo: 120 }), 0);
  const taken = [seq.take(), seq.take(), seq.take()]; // bar record, beat 1, then generating beat 2
  assert.equal(taken[2].t, 0.5);
  seq.update(sanitizeConfig({ tempo: 60 }));
  assert.equal(seq.pending(), "beat");
  const next = seq.take();
  close(next.t, 1, "beat 3 still starts where beat 2 ends");
  assert.equal(next.tempo, 60);
  close(seq.take().t, 2, "and then a second apart");
});

test("a meter change waits for the next bar line", () => {
  const start = sanitizeConfig({ tempo: 120 });
  const seq = new Sequencer(start, 0);
  seq.take(); // bar
  seq.take(); // beat 1
  seq.update(setMeter(start, 3, 4).config);
  assert.equal(seq.pending(), "bar");
  const rest = [];
  for (let e = seq.take(); e && e.t < 3.6; e = seq.take()) rest.push(e);
  assert.deepEqual(mains(rest).filter((e) => e.bar === 0).map((e) => e.cell), [1, 2, 3], "bar 1 finishes in 4/4");
  assert.deepEqual(mains(rest).filter((e) => e.bar === 1).map((e) => e.cell), [0, 1, 2], "bar 2 is in 3/4");
  close(bars(rest)[0].t, 2);
  assert.equal(seq.pending(), null);
});

test("with a polyrhythm, tempo waits for the cycle boundary", () => {
  const start = sanitizeConfig({ tempo: 60, meter: { beats: 2, unit: 4 }, advanced: { poly: { on: true, notes: 3 } } });
  const seq = new Sequencer(start, 0);
  seq.take();
  seq.take();
  seq.update({ ...start, tempo: 120 });
  assert.equal(seq.pending(), "bar");
  const rest = [];
  for (let e = seq.take(); e && e.t < 3; e = seq.take()) rest.push(e);
  close(mains(rest)[0].t, 1, "the rest of the cycle keeps its tempo");
  close(bars(rest)[0].t, 2);
  close(mains(rest)[1].t, 2);
  close(mains(rest)[2].t, 2.5, "the new tempo starts with the new cycle");
});

test("switching training mid-play starts it fresh at the next bar", () => {
  const start = sanitizeConfig({ tempo: 120 });
  const seq = new Sequencer(start, 0);
  for (let e = seq.peek(); e && e.t < 5; e = seq.peek()) seq.take(); // bars 0, 1 and half of 2
  const silent = setField(start, "training", { mode: "silent", silent: { play: 1, rest: 1, showCues: false } }).config;
  seq.update(silent);
  const rest = [];
  for (let e = seq.take(); e && e.t < 10; e = seq.take()) rest.push(e);
  assert.deepEqual(bars(rest).map((b) => [b.bar, b.phase]), [
    [3, "play"],
    [4, "rest"],
  ]);
});

test("restarting after an interruption begins a fresh bar and keeps counting", () => {
  const config = sanitizeConfig({ tempo: 120, practice: { countIn: 1 } });
  const seq = new Sequencer(config, 0);
  for (let e = seq.peek(); e && e.t < 4.6; e = seq.peek()) seq.take(); // count-in, bar 0, into bar 1
  seq.restartAt(100);
  const rest = [];
  for (let e = seq.take(); e && e.t < 105; e = seq.take()) rest.push(e);
  assert.deepEqual(bars(rest).map((b) => [b.t, b.countIn, b.bar]), [
    [100, true, 2],
    [102, false, 2],
    [104, false, 3],
  ]);
});
