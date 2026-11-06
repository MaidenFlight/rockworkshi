import test from "node:test";
import assert from "node:assert/strict";
import {
  cellsOf,
  convertTempo,
  countingText,
  defaultAccents,
  defaultGroups,
  describeMeter,
  groupingChoices,
  isCompound,
  parseGroups,
  pulseNote,
  pulseOptions,
  subPositions,
  subdivisionOptions,
  validGroups,
} from "./rhythm.js";

const meter = (beats, unit, groups = defaultGroups(beats, unit), pulse) => {
  const shape = { beats, unit, groups, pulse: "count" };
  return { ...shape, pulse: pulse ?? (isCompound(shape) ? "group" : "count") };
};
const line = (rows) => rows.map((r) => r.join(" ")).join(" ");

test("4/4 counts four quarter-note beats, strong on 1", () => {
  const m = meter(4, 4);
  assert.equal(pulseNote(m), "quarter");
  assert.equal(cellsOf(m).length, 4);
  assert.deepEqual(defaultAccents(m), ["strong", "normal", "normal", "normal"]);
});

test("6/8 is two dotted-quarter beats holding three eighths each", () => {
  const m = meter(6, 8);
  assert.deepEqual(m.groups, [3, 3]);
  assert.deepEqual(pulseOptions(m), ["group", "count"]);
  assert.equal(pulseNote(m), "dotted-quarter");
  assert.equal(cellsOf(m).length, 2);
  assert.deepEqual(subdivisionOptions(m).map((o) => o.n), [1, 3, 6, 2]);
  assert.equal(line(countingText(m, 3)), "1 & a 2 & a");
  assert.match(describeMeter(m), /two beats.*dotted quarter.*three eighth/);
});

test("6/8 counted in eighths has six beats, strong on 1 and 4", () => {
  const m = meter(6, 8, [3, 3], "count");
  assert.equal(pulseNote(m), "eighth");
  assert.equal(cellsOf(m).length, 6);
  assert.deepEqual(defaultAccents(m), ["strong", "normal", "normal", "strong", "normal", "normal"]);
  assert.equal(line(countingText(m, 1)), "1 2 3 4 5 6");
});

test("7/8 groups 2+2+3 by default, strong at each group start, counted inside the groups", () => {
  const m = meter(7, 8);
  assert.deepEqual(m.groups, [2, 2, 3]);
  assert.deepEqual(pulseOptions(m), ["count"], "uneven groups can't be the beat");
  assert.deepEqual(defaultAccents(m), ["strong", "normal", "strong", "normal", "strong", "normal", "normal"]);
  assert.equal(line(countingText(m, 1)), "1 2 1 2 1 2 3");
  assert.deepEqual(cellsOf(meter(7, 8, [3, 2, 2])).filter((c) => c.groupStart).map((c) => c.index), [0, 3, 5]);
});

test("counting text for simple-meter subdivisions", () => {
  const m = meter(4, 4);
  assert.equal(line(countingText(m, 2)), "1 & 2 & 3 & 4 &");
  assert.equal(line(countingText(m, 4)).slice(0, 15), "1 e & a 2 e & a");
  assert.equal(line(countingText(m, 3)).slice(0, 12), "1 trip let 2");
  assert.equal(countingText(meter(6, 8), 6), null, "no standard count for six per dotted quarter");
});

test("subdivision positions, straight and swung", () => {
  assert.deepEqual(subPositions(1), [0]);
  assert.deepEqual(subPositions(2), [0, 0.5]);
  assert.deepEqual(subPositions(4), [0, 0.25, 0.5, 0.75]);
  assert.deepEqual(subPositions(3).map((x) => x.toFixed(4)), ["0.0000", "0.3333", "0.6667"]);
  assert.deepEqual(subPositions(2, 67), [0, 0.67], "triplet swing puts the and two-thirds through");
  assert.deepEqual(subPositions(4, 75), [0, 0.375, 0.5, 0.875], "sixteenths swing inside each half");
  assert.deepEqual(subPositions(2, 99), [0, 0.75], "swing is capped at 75%");
});

test("tempo conversion keeps the music at the same speed", () => {
  assert.equal(convertTempo(60, "dotted-quarter", "eighth"), 180);
  assert.equal(convertTempo(120, "quarter", "dotted-quarter"), 80);
  assert.equal(convertTempo(180, "eighth", "quarter"), 90);
});

test("groupings: validation, parsing and quick choices", () => {
  assert.equal(validGroups([2, 2, 3], 7), true);
  assert.equal(validGroups([2, 2, 2], 7), false);
  assert.equal(validGroups([0, 7], 7), false);
  assert.deepEqual(parseGroups("2+2+3"), [2, 2, 3]);
  assert.deepEqual(parseGroups(" 3 - 2 "), [3, 2]);
  assert.equal(parseGroups("2+x"), null);
  assert.deepEqual(groupingChoices(7, 8)[0], [2, 2, 3]);
  assert.equal(groupingChoices(7, 8).length, 3);
  assert.deepEqual(groupingChoices(5, 4).slice(0, 3), [[5], [3, 2], [2, 3]]);
  assert.deepEqual(groupingChoices(4, 4), [], "4/4 doesn't offer groupings");
});
