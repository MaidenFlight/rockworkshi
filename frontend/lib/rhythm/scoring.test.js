import { test } from "node:test";
import assert from "node:assert/strict";
import { Scorer, grade, summarize, tendency, calibrate, MAX_WINDOW } from "./scoring.js";

test("grades by distance, with a direction once off the beat", () => {
  assert.equal(grade(0.01).kind, "on");
  assert.deepEqual([grade(-0.05).kind, grade(-0.05).dir], ["near", "early"]);
  assert.deepEqual([grade(0.09).kind, grade(0.09).dir], ["off", "late"]);
  assert.equal(grade(0.2), null);
});

test("each tap claims the nearest open note, once", () => {
  const s = new Scorer();
  s.addPass({ id: 1, start: 0, end: 2, targets: [0, 0.5, 1, 1.5].map((time, i) => ({ time, key: i })) });
  assert.equal(s.tap(0.51).target.key, 1);
  // A second tap at the same note is an extra, not a second hit.
  assert.deepEqual(s.tap(0.52), { extra: 1 });
  assert.equal(s.tap(0.98).target.key, 2);
  s.closeUpTo(3);
  const sum = s.summary(1);
  assert.equal(sum.notes, 4);
  assert.equal(sum.on, 2);
  assert.equal(sum.missed, 2);
  assert.equal(sum.extra, 1);
  assert.ok(s.isDone(1, 3));
});

test("windows shrink at fast tempos so a tap can't belong to two notes", () => {
  const s = new Scorer();
  // Sixteenths at 200 BPM: 75 ms apart.
  const times = Array.from({ length: 8 }, (_, i) => i * 0.075);
  s.addPass({ id: 1, start: 0, end: 0.6, targets: times.map((time, i) => ({ time, key: i })) });
  for (const t of s.targets) assert.ok(t.win < 0.075 / 2);
  // Exactly halfway between two notes hits neither.
  assert.ok(!s.tap(0.0375)?.target);
});

test("windows across a pass boundary account for the next pass", () => {
  const s = new Scorer();
  s.addPass({ id: 1, start: 0, end: 1, targets: [{ time: 0.9, key: "a" }] });
  assert.equal(s.targets[0].win, MAX_WINDOW);
  s.addPass({ id: 2, start: 1, end: 2, targets: [{ time: 1.0, key: "b" }] });
  assert.ok(s.targets[0].win < MAX_WINDOW);
});

test("a pass can arrive a bar at a time and be settled early", () => {
  const s = new Scorer();
  s.addPass({ id: 1, start: 0, end: 2, targets: [{ time: 0, key: "a" }] });
  s.addPass({ id: 1, start: 2, end: 4, targets: [{ time: 2, key: "b" }] });
  assert.equal(s.passes.get(1).end, 4);
  s.tap(0.01);
  const sum = s.finishPass(1);
  assert.deepEqual([sum.notes, sum.on, sum.missed], [2, 1, 1]);
});

test("taps outside every pass count for nothing", () => {
  const s = new Scorer();
  s.addPass({ id: 1, start: 2, end: 4, targets: [{ time: 2, key: 0 }] });
  assert.equal(s.tap(0.5), null);
});

test("the score weighs hits and charges extras", () => {
  const perfect = summarize([{ kind: "on", error: 0.01 }, { kind: "on", error: -0.01 }]);
  assert.equal(perfect.score, 100);
  const sloppy = summarize([{ kind: "near", dir: "late", error: 0.05 }, { kind: "missed" }], 1);
  assert.equal(sloppy.score, 15);
  assert.equal(sloppy.late, 1);
});

test("tendency names rushing and dragging", () => {
  const rush = summarize([-0.03, -0.025, -0.02].map((error) => ({ kind: "near", dir: "early", error })));
  assert.equal(tendency(rush).kind, "rushing");
  assert.equal(tendency(summarize([{ kind: "on", error: 0 }])), null);
});

test("calibration takes the median and refuses uneven taps", () => {
  const clicks = Array.from({ length: 12 }, (_, i) => i * 0.6);
  const steady = clicks.map((c, i) => c + 0.04 + (i % 2 ? 0.005 : -0.005));
  const ok = calibrate(clicks, steady);
  assert.ok(ok.ok);
  assert.ok(Math.abs(ok.offset - 0.04) < 0.006);
  const wild = clicks.map((c, i) => c + (i % 2 ? 0.15 : -0.1));
  assert.equal(calibrate(clicks, wild).reason, "uneven");
  assert.equal(calibrate(clicks, [0.01, 0.6]).reason, "few");
});
