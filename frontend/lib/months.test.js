import { test } from "node:test";
import assert from "node:assert/strict";
import { currentMonth, dayLabel, groupMonths, nextTask, rangeName, requirementWords, stillToPractise, taskForSaving, todayHere, weekOf } from "./months.js";

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

const month = (id, startsOn) => ({ id, startsOn, weekTitles: ["A", "B", "C", "D"] });
const task = (id, m, week, position, kind, status = "assigned") => ({ id, month: m, week, position, kind, status, section: id, song: { id: "song" }, teacher: { name: "Brian Albus" } });

test("tasks are gathered by month, in the teacher's order", () => {
  const oct = month("oct", "2026-10-05");
  const nov = month("nov", "2026-11-02");
  const months = groupMonths([task("b", nov, 2, 3, "checkpoint"), task("a", nov, 1, 1, "assessment"), task("c", oct, 1, 0, "checkpoint"), { id: "old", month: null }]);
  assert.deepEqual(months.map((m) => m.id), ["nov", "oct"], "newest first");
  assert.deepEqual(months[0].tasks.map((t) => t.id), ["a", "b"]);
  assert.equal(months[0].song.id, "song");
});

test("the month to show is the one under way", () => {
  const months = [month("dec", "2026-12-07"), month("nov", "2026-11-02"), month("oct", "2026-10-05")];
  assert.equal(currentMonth(months, "2026-11-20").id, "nov");
  assert.equal(currentMonth(months, "2026-12-07").id, "dec");
  assert.equal(currentMonth([month("dec", "2026-12-07"), month("jan", "2027-01-04")].reverse(), "2026-11-20").id, "dec", "the soonest to start, if none has");
  assert.equal(currentMonth([], "2026-11-20"), null);
});

test("what still needs practice, and what's next", () => {
  const m = month("nov", "2026-11-02");
  const tasks = [
    task("w1a", m, 1, 0, "checkpoint", "saved"),
    task("w1b", m, 1, 1, "checkpoint"),
    task("w1z", m, 1, 2, "assessment", "reviewed"),
    task("w2a", m, 2, 3, "checkpoint"),
    task("w2z", m, 2, 4, "assessment"),
    task("w3a", m, 3, 5, "checkpoint"),
  ];
  const nov = { ...m, tasks };
  assert.deepEqual(stillToPractise(nov, 2).map((t) => t.id), ["w1b", "w2a"], "open checkpoints up to this week");
  assert.equal(nextTask(nov, "2026-11-10").id, "w2a", "this week's first");
  assert.equal(nextTask({ ...nov, tasks: tasks.filter((t) => t.week !== 2) }, "2026-11-10").id, "w1b", "then what's left from earlier");
  assert.equal(nextTask({ ...nov, tasks: tasks.filter((t) => t.week === 3) }, "2026-11-10").id, "w3a", "then what's ahead");
  assert.equal(nextTask({ ...nov, tasks: tasks.slice(0, 1) }, "2026-11-10"), null, "nothing open");
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
