import { test } from "node:test";
import assert from "node:assert/strict";
import { dayLabel, rangeName, requirementWords, taskForSaving, todayHere, weekOf } from "./months.js";

test("a day reads the same wherever the page is opened", () => {
  assert.equal(dayLabel("2026-11-13"), "Nov 13", "a date never splits across lines");
  assert.equal(dayLabel("2026-01-01"), "Jan 1");
  assert.equal(dayLabel(null), "");
  // 3am UTC on Nov 2 is still Nov 1 in Honolulu.
  assert.equal(todayHere(new Date("2026-11-02T03:00:00Z")), "2026-11-01");
});

test("a day belongs to one of the month's four weeks", () => {
  assert.equal(weekOf("2026-11-01", "2026-11-01"), 1);
  assert.equal(weekOf("2026-11-01", "2026-11-07"), 1);
  assert.equal(weekOf("2026-11-01", "2026-11-08"), 2);
  assert.equal(weekOf("2026-11-01", "2026-11-22"), 4);
  assert.equal(weekOf("2026-11-01", "2026-10-20"), 1, "before it starts");
  assert.equal(weekOf("2026-11-01", "2026-12-25"), 4, "after it ends");
  assert.equal(weekOf("2026-02-25", "2026-03-04"), 2, "across a month end");
});

test("sections are named as the template names them", () => {
  const verse = { name: "Verse 1", start: 10, end: 30 };
  const chorus = { name: "Chorus 1", start: 30, end: 50 };
  const outro = { name: "Outro", start: 90, end: 100 };
  assert.equal(rangeName(verse, verse), "Verse 1");
  assert.equal(rangeName(verse, chorus), "Verse 1 + Chorus 1");
  assert.equal(rangeName(verse, outro), "Verse 1 to Outro");
});

test("a task's requirements in a few words", () => {
  assert.deepEqual(requirementWords({ media: "audio" }), ["Audio"]);
  assert.deepEqual(requirementWords({ media: "video", support: "solo", targetSpeed: 100 }), ["Video", "On my own", "100% speed"]);
  assert.deepEqual(requirementWords({ media: "video", audioAllowed: true, support: "guide", targetSpeed: 80 }), ["Video (or audio)", "Guide me", "80% speed"]);
});

test("what goes to the API is only what applies to that kind of task", () => {
  const base = { week: 2, instruction: "Do it.", level: 3, media: "audio" };
  const checkpoint = taskForSaving({ ...base, kind: "checkpoint", criteria: ["Steady timing"], reviewCheckpoint: true, audioAllowed: true });
  assert.deepEqual(checkpoint.criteria, [], "a checkpoint isn't marked");
  assert.equal(checkpoint.reviewCheckpoint, true);
  assert.equal(checkpoint.audioAllowed, false, "only a video task has an audio alternative");

  const assessment = taskForSaving({ ...base, kind: "assessment", media: "video", audioAllowed: true, criteria: [" Steady timing ", "", "  "], reviewCheckpoint: true });
  assert.deepEqual(assessment.criteria, ["Steady timing"], "blank lines are dropped");
  assert.equal(assessment.reviewCheckpoint, false);
  assert.equal(assessment.audioAllowed, true);
  assert.equal(assessment.support, null);
  assert.equal(assessment.targetSpeed, null);
});
