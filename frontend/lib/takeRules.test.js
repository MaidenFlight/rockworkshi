import { test } from "node:test";
import assert from "node:assert/strict";
import { isWeeklyAssessment, moreHelp, setupGaps, takeVerdict } from "./takeRules.js";

const assessment = (extra = {}) => ({ kind: "assessment", week: 2, support: "chart", targetSpeed: 90, ...extra });

test("only a weekly assessment has a final take to submit on purpose", () => {
  assert.equal(isWeeklyAssessment(assessment()), true);
  assert.equal(isWeeklyAssessment({ kind: "checkpoint", week: 2 }), false);
  assert.equal(isWeeklyAssessment({ kind: "assessment", week: null }), false, "work set before there were weeks");
  assert.equal(isWeeklyAssessment(null), false);
});

test("more help means Guide me over Chart only over On my own", () => {
  assert.equal(moreHelp("solo", "chart"), "chart");
  assert.equal(moreHelp("guide", "chart"), "guide");
  assert.equal(moreHelp("chart", "chart"), "chart");
});

test("what's left to set before an assessment take", () => {
  assert.deepEqual(setupGaps(assessment(), { help: "chart", speed: 0.9 }), []);
  assert.deepEqual(setupGaps(assessment(), { help: "solo", speed: 1 }), [], "less help and a faster speed are fine");
  assert.deepEqual(setupGaps(assessment(), { help: "guide", speed: 0.9 }), ["Chart only"]);
  assert.deepEqual(setupGaps(assessment(), { help: "chart", speed: 0.75 }), ["90% speed"]);
  assert.deepEqual(setupGaps(assessment(), { help: "guide", speed: 0.5 }), ["Chart only", "90% speed"]);
  assert.deepEqual(setupGaps(assessment(), { help: "guide", speed: 0.9, hasChart: false }), [], "no chart, no help to set");
  assert.deepEqual(setupGaps({ kind: "checkpoint", week: 1, support: "solo", targetSpeed: 100 }, { help: "guide", speed: 0.5 }), [], "a checkpoint can be recorded however it's practised");
  assert.deepEqual(setupGaps(assessment({ support: null, targetSpeed: null }), { help: "guide", speed: 0.5 }), []);
});

test("a take that fits can be submitted, at the target or better", () => {
  assert.deepEqual(takeVerdict(assessment(), { support: "chart", speed: 0.9 }), { ok: true, text: null });
  assert.equal(takeVerdict(assessment(), { support: "solo", speed: 1 }).ok, true);
  assert.equal(takeVerdict(assessment(), { support: "chart", speed: 0.898 }).ok, true, "rounding doesn't fail a take");
  assert.equal(takeVerdict(assessment(), { support: null, speed: 0.9 }).ok, true, "a song with no chart has no help to count");
});

test("a take with more help stays as practice, and says what to do next", () => {
  const mode = takeVerdict(assessment(), { support: "guide", speed: 0.9, raisedBy: "mode" });
  assert.equal(mode.ok, false);
  assert.equal(mode.why, "help");
  assert.match(mode.text, /You had Guide me on during this take, so it stays as practice/);
  assert.match(mode.text, /record a new take with Chart only/);

  const peek = takeVerdict(assessment({ support: "solo" }), { support: "chart", speed: 0.9, raisedBy: "peek" });
  assert.match(peek.text, /You peeked at the chart/);
  assert.match(peek.text, /record a new take with On my own/);

  const focus = takeVerdict(assessment({ support: "solo" }), { support: "guide", speed: 0.9, raisedBy: "focus" });
  assert.match(focus.text, /Focus view was open/);
});

test("a take below the target speed stays as practice", () => {
  const slow = takeVerdict(assessment(), { support: "chart", speed: 0.75 });
  assert.equal(slow.ok, false);
  assert.equal(slow.why, "speed");
  assert.match(slow.text, /played at 75%/);
  assert.match(slow.text, /record a new take at 90%/);
});

test("a task that asks for video needs a filmed take", () => {
  const video = assessment({ media: "video", support: null, targetSpeed: null });
  assert.equal(takeVerdict(video, { media: "video" }).ok, true);
  const audio = takeVerdict(video, {});
  assert.equal(audio.ok, false);
  assert.equal(audio.why, "media");
  assert.match(audio.text, /camera/);
  assert.equal(takeVerdict({ ...video, audioAllowed: true }, {}).ok, true, "where the teacher accepts audio");
  assert.equal(takeVerdict(video, {}, { canFilm: false }).ok, true, "or the student can't be filmed");
  assert.equal(takeVerdict({ kind: "checkpoint", week: 1, media: "video" }, {}).ok, false, "a checkpoint asking for video too");
});

test("a checkpoint and work with no week are never held back", () => {
  assert.equal(takeVerdict({ kind: "checkpoint", week: 1, support: "solo", targetSpeed: 100 }, { support: "guide", speed: 0.5 }).ok, true);
  assert.equal(takeVerdict({ kind: "assessment", week: null, support: null }, { support: "guide", speed: 1 }).ok, true);
  assert.equal(takeVerdict(null, { support: "guide", speed: 0.5 }).ok, true);
});
