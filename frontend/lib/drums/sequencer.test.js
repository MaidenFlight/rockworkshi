import test from "node:test";
import assert from "node:assert/strict";
import { Sequencer, quantize } from "./sequencer.js";
import { addBlock, addPart, blankBeat, replaceNotes, setBlockCrash, setNote, setSwing, setTempo } from "./beat.js";
import { GROOVE_BY_ID, grooveNotes, starterBeat } from "./grooves.js";

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} expected ${b}, got ${a}`);

function rockBeat(tempo = 120) {
  let beat = setTempo(blankBeat(), tempo);
  beat = replaceNotes(beat, beat.parts[0].id, grooveNotes(GROOVE_BY_ID["rock-8ths"]));
  return beat;
}

// Every event before `until` seconds.
function run(seq, until) {
  const out = [];
  for (let e = seq.peek(); e && e.t < until; e = seq.peek()) out.push(seq.take());
  return out;
}

test("at 120 BPM in 4/4 a step is a sixteenth (0.125 s) and a bar lasts 2 s", () => {
  const beat = rockBeat(120);
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 10);
  const events = run(seq, 14);
  const steps = events.filter((e) => e.type === "step");
  assert.equal(steps.length, 32);
  steps.forEach((e, i) => close(e.t, 10 + i * 0.125, `step ${i}`));
  assert.deepEqual(events.filter((e) => e.type === "bar").map((e) => [e.t, e.bar]), [[10, 0], [12, 1]]);
  const snare = events.filter((e) => e.type === "hit" && e.piece === "snare");
  assert.deepEqual(snare.map((e) => e.t), [10.5, 11.5, 12.5, 13.5], "backbeat on 2 and 4");
  assert.equal(snare[0].level, 3);
});

test("swing pushes the & late; the beats stay put", () => {
  const beat = setSwing(rockBeat(120), 67, 8); // 67 is the triplet feel, to the nearest percent
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 0);
  const hats = run(seq, 2).filter((e) => e.type === "hit" && e.piece === "hatClosed");
  close(hats[0].t, 0);
  close(hats[1].t, (0.5 + 0.25 * 0.67) * 0.5, "the & at about two thirds of the beat");
  close(hats[2].t, 0.5);
});

test("a new tempo is heard from the next step, without a jump", () => {
  let beat = rockBeat(120);
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 0);
  const first = [seq.take(), seq.take()]; // bar, step 0
  assert.equal(first[1].type, "step");
  close(first[1].dur, 0.125);
  beat = setTempo(beat, 60);
  const rest = run(seq, 1).filter((e) => e.type === "step");
  close(rest[0].t, 0.125, "step 1 starts where step 0 ended");
  close(rest[0].dur, 0.25);
});

test("the click plays on the beat, the count-in bar has clicks and no drums", () => {
  const beat = rockBeat(120);
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 0, { countInBars: 1, click: () => true });
  const events = run(seq, 4);
  const countIn = events.filter((e) => e.t < 2);
  assert.ok(countIn.every((e) => e.type !== "hit"), "no drums in the count-in");
  assert.deepEqual(countIn.filter((e) => e.type === "click").map((e) => [e.t, e.level]), [[0, "bar"], [0.5, "normal"], [1, "normal"], [1.5, "normal"]]);
  const firstBar = events.find((e) => e.type === "bar" && !e.countIn);
  assert.equal(firstBar.t, 2);
  assert.equal(firstBar.bar, 0);
  assert.equal(events.filter((e) => e.type === "click" && !e.countIn).length, 4, "and the click carries on");
});

test("without the click there are no clicks once the music starts", () => {
  const beat = rockBeat(120);
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 0);
  assert.equal(run(seq, 4).filter((e) => e.type === "click").length, 0);
});

test("the song plays its blocks in order, crashes on a block's 1 and ends", () => {
  const beat = starterBeat(); // Verse x3, Fill x1, Chorus x3 (crash), Fill x1 at 100 BPM
  const seq = new Sequencer(() => beat, { type: "song", loop: false, from: 0 }, 0);
  const events = [];
  for (let e = seq.take(); e; e = seq.take()) events.push(e);
  const bars = events.filter((e) => e.type === "bar");
  const names = bars.map((b) => beat.parts.find((p) => p.id === b.part).name);
  assert.deepEqual(names, ["Verse", "Verse", "Verse", "Fill", "Chorus", "Chorus", "Chorus", "Fill"]);
  const end = events.at(-1);
  assert.equal(end.type, "end");
  close(end.t, 8 * 2.4, "eight bars of 2.4 s");
  const chorusOne = events.filter((e) => e.type === "hit" && e.bar === 4 && e.step === 0).map((e) => e.piece);
  assert.ok(chorusOne.includes("crash"), "crash on the chorus's 1");
  assert.ok(!chorusOne.includes("ride"), "the ride gives way to the crash");
  assert.ok(chorusOne.includes("kick"));
  const chorusTwo = events.filter((e) => e.type === "hit" && e.bar === 5 && e.step === 0).map((e) => e.piece);
  assert.ok(!chorusTwo.includes("crash") && chorusTwo.includes("ride"), "only the first bar of the block");
});

test("a looping song goes round; playing from a block starts there", () => {
  const beat = starterBeat();
  const loop = new Sequencer(() => beat, { type: "song", loop: true, from: 0 }, 0);
  const bars = run(loop, 2.4 * 9 + 0.01).filter((e) => e.type === "bar");
  assert.equal(bars.length, 10);
  assert.equal(bars[8].songBar, 0);
  assert.equal(bars[8].bar, 8);
  const fromChorus = new Sequencer(() => beat, { type: "song", loop: false, from: 2 }, 0);
  const first = fromChorus.take();
  assert.equal(first.type, "bar");
  assert.equal(first.songBar, 4);
  assert.equal(beat.parts.find((p) => p.id === first.part).name, "Chorus");
});

test("an edit made while playing is heard at the next pass", () => {
  let beat = rockBeat(120);
  const id = beat.parts[0].id;
  const seq = new Sequencer(() => beat, { type: "part", part: id }, 0);
  // The step after the last one taken is already booked, as it would be in the engine's lookahead.
  run(seq, 1.7);
  beat = setNote(beat, id, "crash", 0, 2);
  const crash = run(seq, 2.1).filter((e) => e.type === "hit" && e.piece === "crash");
  assert.equal(crash.length, 1);
  assert.equal(crash[0].bar, 1);
});

test("choosing another part while looping switches at the next bar line", () => {
  let beat = rockBeat(120);
  const verse = beat.parts[0].id;
  const r = addPart(beat, "Chorus");
  beat = r.beat;
  const seq = new Sequencer(() => beat, { type: "part", part: verse }, 0);
  run(seq, 0.6);
  seq.queuePart(r.id);
  const bars = run(seq, 4.1).filter((e) => e.type === "bar");
  assert.deepEqual(bars.map((b) => [b.t, b.part]), [[2, r.id], [4, r.id]]);
});

test("a skipped note is left out once", () => {
  const beat = rockBeat(120);
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 0);
  seq.skip(0, 4, "snare");
  const snares = run(seq, 4).filter((e) => e.type === "hit" && e.piece === "snare");
  assert.deepEqual(snares.map((e) => [e.bar, e.step]), [[0, 12], [1, 4], [1, 12]]);
});

test("a played note goes to the nearer step, and the last step's late half to the next bar", () => {
  let beat = rockBeat(120);
  const verse = beat.parts[0].id;
  const r = addPart(beat, "Chorus");
  beat = addBlock(addBlock(r.beat, verse, 1), r.id, 1);
  beat = setBlockCrash(beat, beat.song[1].id, false);
  const seq = new Sequencer(() => beat, { type: "song", loop: false, from: 0 }, 0);
  const steps = [];
  for (let e = seq.take(); e; e = seq.take()) if (e.type === "step") steps.push(e);
  const s3 = steps[3]; // 0.375 s, lasts 0.125 s
  assert.deepEqual(quantize(seq, beat, s3, 0.38), { bar: 0, step: 3, part: verse });
  assert.deepEqual(quantize(seq, beat, s3, 0.49), { bar: 0, step: 4, part: verse });
  const last = steps[15];
  assert.deepEqual(quantize(seq, beat, last, last.t + 0.1), { bar: 1, step: 0, part: r.id }, "into the next block's part");
  const end = steps[31];
  assert.equal(quantize(seq, beat, end, end.t + 0.1), null, "past the end of the song");
});

test("a late hit in the count-in's last step lands on the first beat", () => {
  const beat = rockBeat(120);
  const seq = new Sequencer(() => beat, { type: "part", part: beat.parts[0].id }, 0, { countInBars: 1 });
  const steps = run(seq, 2.2).filter((e) => e.type === "step");
  assert.ok(steps[15].countIn);
  assert.equal(quantize(seq, beat, steps[15], steps[15].t + 0.01), null, "early in the count-in: nothing");
  assert.deepEqual(quantize(seq, beat, steps[15], steps[15].t + 0.1), { bar: 0, step: 0, part: beat.parts[0].id });
});
