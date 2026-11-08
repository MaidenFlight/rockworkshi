import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, blankTask, count, daysBetween, dueDayFrom, dueOnOf, fieldName, fieldValue, inboxQuery, moveTask, overrideWords, placeInGroup, recordingWords, taskPlace, waitingFor } from "./plans.js";

test("due dates move with the month, because they're kept as days after the start", () => {
  assert.equal(addDays("2026-11-30", 2), "2026-12-02");
  assert.equal(daysBetween("2026-11-30", "2026-12-02"), 2);
  assert.equal(dueOnOf({ dueDay: 6 }, "2026-12-07"), "2026-12-13");
  assert.equal(dueOnOf({ dueDay: 6 }, "2027-01-04"), "2027-01-10");
  assert.equal(dueOnOf({ dueDay: null }, "2026-12-07"), null);
  assert.equal(dueOnOf({ dueDay: 6 }, null), null);
});

test("a due date picked in the form stays where it's allowed", () => {
  assert.equal(dueDayFrom("2026-12-13", "2026-12-07"), 6);
  assert.equal(dueDayFrom("2026-12-01", "2026-12-07"), 0, "before the month starts is its first day");
  assert.equal(dueDayFrom("2027-06-01", "2026-12-07"), 90);
  assert.equal(dueDayFrom("", "2026-12-07"), null);
});

const group = [
  { id: "a", week: 1, kind: "checkpoint" },
  { id: "b", week: 1, kind: "checkpoint" },
  { id: "c", week: 1, kind: "assessment" },
  { id: "d", week: 2, kind: "checkpoint" },
];

test("a task moves up and down among its own week and kind", () => {
  assert.deepEqual(moveTask(group, "b", -1).map((t) => t.id), ["b", "a", "c", "d"]);
  assert.deepEqual(moveTask(group, "a", 1).map((t) => t.id), ["b", "a", "c", "d"]);
  assert.equal(moveTask(group, "a", -1), group, "already first");
  assert.equal(moveTask(group, "b", 1), group, "the assessment isn't one of its group");
  assert.equal(moveTask(group, "d", -1), group, "another week isn't either");
  assert.equal(moveTask(group, "nope", 1), group);
  assert.deepEqual(placeInGroup(group, group[0]), { first: true, last: false });
  assert.deepEqual(placeInGroup(group, group[1]), { first: false, last: true });
  assert.deepEqual(placeInGroup(group, group[2]), { first: true, last: true });
});

test("a new task takes after the week's others", () => {
  const tasks = [{ id: "a", week: 2, level: 3, support: "chart", targetSpeed: 90, dueDay: 13 }];
  const made = blankTask(2, tasks);
  assert.deepEqual([made.week, made.kind, made.level, made.support, made.targetSpeed, made.dueDay], [2, "checkpoint", 3, "chart", 90, 13]);
  assert.ok(made.id);
  assert.notEqual(blankTask(2, tasks).id, made.id);

  const empty = blankTask(3, [], 4);
  assert.deepEqual([empty.level, empty.support, empty.dueDay], [4, null, 20]);
});

test("changes are said in the teacher's words", () => {
  assert.equal(fieldName("targetSpeed"), "Target speed");
  assert.equal(fieldName("somethingNew"), "somethingNew");
  assert.equal(fieldValue("targetSpeed", 80), "80%");
  assert.equal(fieldValue("targetSpeed", null), "Any");
  assert.equal(fieldValue("support", "guide"), "Guide me");
  assert.equal(fieldValue("support", null), "Any");
  assert.equal(fieldValue("media", "video"), "Video");
  assert.equal(fieldValue("kind", "assessment"), "Weekly assessment");
  assert.equal(fieldValue("week", 2), "Week 2");
  assert.equal(fieldValue("dueOn", "2026-12-13"), "Dec 13", "a date never splits across lines");
  assert.equal(fieldValue("dueOn", null), "None");
  assert.equal(fieldValue("dueDay", 6), "Day 7");
  assert.equal(fieldValue("audioAllowed", false), "No");
  assert.equal(fieldValue("sectionEnd", 65), "1:05");
  assert.equal(fieldValue("criteria", ["Timing", "Tone"]), "Timing, Tone");
  assert.equal(fieldValue("criteria", []), "None");
  assert.equal(fieldValue("instruction", "Loop it."), "Loop it.");
  assert.equal(taskPlace({ week: 2, kind: "assessment" }), "Week 2 assessment");
  assert.equal(taskPlace({ week: 1, kind: "checkpoint" }), "Week 1 checkpoint");
});

test("one student's differences are said in a few words", () => {
  assert.deepEqual(overrideWords({ skip: true }), ["Left out"]);
  assert.deepEqual(overrideWords({ targetSpeed: 70, support: "chart", media: "video", audioAllowed: true, dueDay: 9, instruction: "x" }), ["Video", "Audio accepted", "Chart only", "70% speed", "Own due date", "Own instructions"]);
  assert.deepEqual(overrideWords({ targetSpeed: null }), ["Any speed"]);
  assert.deepEqual(overrideWords(undefined), []);
});

test("waiting time is said in the largest useful unit", () => {
  const now = new Date("2026-11-10T12:00:00Z").getTime();
  const ago = (ms) => new Date(now - ms).toISOString();
  const MIN = 60000;
  assert.equal(waitingFor(ago(30000), now), "Just sent");
  assert.equal(waitingFor(ago(5 * MIN), now), "Waiting 5 minutes");
  assert.equal(waitingFor(ago(60 * MIN), now), "Waiting 1 hour");
  assert.equal(waitingFor(ago(5 * 60 * MIN), now), "Waiting 5 hours");
  assert.equal(waitingFor(ago(24 * 60 * MIN), now), "Waiting 1 day");
  assert.equal(waitingFor(ago(72 * 60 * MIN), now), "Waiting 3 days");
  assert.equal(waitingFor(new Date(now + MIN).toISOString(), now), "Just sent", "a clock slightly ahead");
  assert.equal(count(1, "task"), "1 task");
  assert.equal(count(3, "task"), "3 tasks");
  assert.equal(count(2, "class", "classes"), "2 classes");
});

test("a recording says how it was made", () => {
  assert.deepEqual(recordingWords({ media: "audio", type: "audio/wav", duration: 95, support: "chart", speed: 0.9 }), ["Audio", "1:35", "Chart only", "90% speed"]);
  assert.deepEqual(recordingWords({ media: "video", type: "video/mp4", duration: 60, support: null, speed: 1 }), ["Video, MP4", "1:00", "Full speed"]);
  assert.deepEqual(recordingWords({ media: "video", type: "video/webm", duration: null, speed: 1 }), ["Video, WEBM", "Full speed"]);
  assert.deepEqual(recordingWords(null), ["No recording"]);
});

test("the inbox's filters go along in a link", () => {
  assert.equal(inboxQuery({ classId: "c", studentId: "", instrument: "Bass" }), "classId=c&instrument=Bass");
  assert.equal(inboxQuery({}), "");
  assert.equal(inboxQuery(), "");
});
