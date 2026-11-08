import test from "node:test";
import assert from "node:assert/strict";
import { afterPass, startRun, trainerPlan, trainerSettings, trainerSpeeds, trainerStatus } from "./speedTrainer.js";

const defaults = trainerSettings({});

test("the defaults go 60% to 100% in steps of 10", () => {
  assert.deepEqual(defaults, { start: 60, step: 10, passes: 2, top: 100 });
  assert.deepEqual(trainerSpeeds(defaults), [0.6, 0.7, 0.8, 0.9, 1]);
});

test("settings keep to the offered choices, and the top is never below the start", () => {
  assert.deepEqual(trainerSettings({ start: "70", step: 5, passes: 3, top: 90 }), { start: 70, step: 5, passes: 3, top: 90 });
  assert.deepEqual(trainerSettings({ start: 55, step: 7, passes: 0, top: 120 }), { start: 60, step: 10, passes: 2, top: 100 });
  assert.equal(trainerSettings({ start: 90, top: 70 }).top, 90);
  assert.deepEqual(trainerSettings(null), defaults);
});

test("a step that doesn't divide the way there still ends on the top speed", () => {
  assert.deepEqual(trainerSpeeds({ start: 60, step: 15, passes: 1, top: 100 }), [0.6, 0.75, 0.9, 1]);
  assert.deepEqual(trainerSpeeds({ start: 80, step: 10, passes: 1, top: 80 }), [0.8]);
});

test("it steps up after the set number of passes, then holds at the top", () => {
  const settings = trainerSettings({ start: 60, step: 10, passes: 2, top: 80 });
  let run = startRun(settings);
  const seen = [run.speed];
  for (let i = 0; i < 7; i++) {
    run = afterPass(settings, run);
    seen.push(run.speed);
  }
  assert.deepEqual(seen, [0.6, 0.6, 0.7, 0.7, 0.8, 0.8, 0.8, 0.8]);
  assert.equal(run.atTop, true);
});

test("one pass a step moves every pass", () => {
  const settings = trainerSettings({ start: 70, step: 10, passes: 1, top: 90 });
  let run = startRun(settings);
  run = afterPass(settings, run);
  assert.equal(run.speed, 0.8);
  run = afterPass(settings, run);
  assert.deepEqual([run.speed, run.atTop], [0.9, true]);
});

test("a run that starts at the top is already there", () => {
  const run = startRun(trainerSettings({ start: 90, top: 90 }));
  assert.deepEqual([run.speed, run.atTop], [0.9, true]);
});

test("it says where it is and what comes next", () => {
  const settings = trainerSettings({ start: 60, step: 10, passes: 2, top: 70 });
  let run = startRun(settings);
  assert.equal(trainerStatus(settings, run), "Pass 1 of 2 at 60% · next 70%");
  run = afterPass(settings, run);
  assert.equal(trainerStatus(settings, run), "Pass 2 of 2 at 60% · next 70%");
  run = afterPass(settings, run);
  assert.equal(trainerStatus(settings, run), "At 70%, your top speed");
  assert.equal(trainerPlan(settings), "60% up to 70%, +10% every 2 passes");
  assert.equal(trainerPlan({ ...settings, passes: 1 }), "60% up to 70%, +10% every pass");
});
