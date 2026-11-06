import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutBar, tickX, BEAT_W } from "./notation.js";
import { FIGURES } from "./patterns.js";

const n = (t, tie) => (tie ? { t, rest: false, tie: true } : { t, rest: false });
const r = (t) => ({ t, rest: true });

test("notes sit where they sound", () => {
  const out = layoutBar([n(12), n(12), n(12), n(12)]);
  assert.deepEqual(
    out.notes.map((x) => x.x),
    [0, 12, 24, 36].map(tickX),
  );
  assert.equal(tickX(12) - tickX(0), BEAT_W);
});

test("eighths beam in pairs by the beat, and a lone eighth gets a flag", () => {
  const out = layoutBar([n(6), n(6), n(18), n(6), n(12)]);
  assert.equal(out.beams.length, 1);
  assert.equal(out.flags.length, 1);
  assert.equal(out.flags[0].count, 1);
  assert.equal(out.dots.length, 1);
});

test("sixteenths get a second beam; a lone one gets a stub pointing into its group", () => {
  const gallop = layoutBar(FIGURES.find((f) => f.id === "gallop").bar);
  // Per beat: one primary beam and one second beam joining the two sixteenths.
  assert.equal(gallop.beams.filter((b) => b.level === 1).length, 4);
  assert.equal(gallop.beams.filter((b) => b.level === 2).length, 4);

  const dotted = layoutBar([n(9), n(3), n(3), n(9), n(3), n(6), n(3), n(12)]);
  const second = dotted.beams.filter((b) => b.level === 2);
  assert.equal(second.length, 4);
  // 9+3: the sixteenth comes last, so its stub points left (back into the group).
  assert.ok(second[0].x2 > second[0].x1 && second[0].x2 === tickX(9) + 5.6);
  // 3+9: the sixteenth comes first, so its stub points right.
  assert.equal(second[1].x1, tickX(12) + 5.6);
});

test("rests are drawn by kind and break beams", () => {
  const out = layoutBar([r(6), n(6), n(6), r(6), r(24)]);
  assert.deepEqual(
    out.rests.map((x) => x.kind),
    ["eighth", "eighth", "half"],
  );
  assert.equal(out.beams.length, 0);
  assert.equal(out.flags.length, 2);
});

test("triplets get a 3: over the beam when beamed, a bracket when not", () => {
  const out = layoutBar([n(4), n(4), n(4), n(8), n(4), n(12), n(12)]);
  assert.equal(out.tuplets.length, 2);
  assert.equal(out.tuplets[0].bracket, false);
  assert.equal(out.tuplets[1].bracket, true);
});

test("a tie joins two notes and the second doesn't count as an onset", () => {
  const out = layoutBar(FIGURES.find((f) => f.id === "push").bar);
  assert.equal(out.ties.length, 1);
  assert.equal(out.notes.filter((x) => x.onset).length, 3);
});

test("a bar that doesn't add up is refused", () => {
  assert.throws(() => layoutBar([n(12), n(12)]));
});
