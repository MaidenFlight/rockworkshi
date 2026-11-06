import test from "node:test";
import assert from "node:assert/strict";
import { createTapTempo } from "./tap.js";

const tapAll = (times) => {
  const tapper = createTapTempo();
  return times.map((t) => tapper.tap(t));
};

test("steady taps 500ms apart read 120", () => {
  const results = tapAll([0, 500, 1000, 1500, 2000]);
  assert.equal(results[0].bpm, null, "one tap isn't a tempo yet");
  assert.deepEqual(results.slice(1).map((r) => r.bpm), [120, 120, 120, 120]);
});

test("one stray tap doesn't throw the reading off", () => {
  // The fourth tap is 150ms late, then the player recovers.
  const results = tapAll([0, 500, 1000, 1650, 2000, 2500, 3000]);
  assert.equal(results.at(-1).bpm, 120);
});

test("several recent taps are averaged, not just the last two", () => {
  const results = tapAll([0, 480, 1000, 1490, 2000]);
  assert.equal(results.at(-1).bpm, 120);
});

test("a pause starts a new run", () => {
  const tapper = createTapTempo();
  [0, 500, 1000].forEach((t) => tapper.tap(t));
  const after = tapper.tap(5000);
  assert.equal(after.restarted, true);
  assert.equal(after.bpm, null);
  assert.equal(tapper.tap(5400).bpm, 150);
});

test("a clear change of speed is followed straight away", () => {
  const results = tapAll([0, 500, 1000, 1500, 1800, 2100]);
  assert.equal(results.at(-2).bpm, 200, "the first quick interval reads as the new tempo");
  assert.equal(results.at(-1).bpm, 200);
});

test("double presses are ignored and the range is clamped", () => {
  const tapper = createTapTempo();
  tapper.tap(0);
  assert.equal(tapper.tap(40).ignored, true);
  assert.equal(tapper.tap(3000).bpm, 20, "3 s between taps is the slowest tempo");
  const fast = createTapTempo();
  [0, 150, 300, 450].forEach((t) => fast.tap(t));
  assert.equal(fast.tap(600).bpm, 300, "faster than 300 is clamped");
});
