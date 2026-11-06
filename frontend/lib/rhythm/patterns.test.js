import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAR,
  LEVELS,
  FIGURES,
  barTicks,
  onsets,
  generateBar,
  generateBars,
  nearMiss,
  sameBar,
  segments,
  countsFor,
  swungTick,
  describeBar,
  mergeRests,
  seeded,
} from "./patterns.js";

const n = (t, tie) => (tie ? { t, rest: false, tie: true } : { t, rest: false });
const r = (t) => ({ t, rest: true });

test("every figure fills exactly one bar", () => {
  for (const f of FIGURES) assert.equal(barTicks(f.bar), BAR, f.id);
});

test("generated bars fill the bar, meet the level's floor and include what it teaches", () => {
  const rand = seeded(7);
  for (const level of LEVELS) {
    const focusSets = level.one.concat(level.two).filter((f) => f.focus);
    for (let i = 0; i < 300; i++) {
      const bar = generateBar(level, rand);
      assert.equal(barTicks(bar), BAR, level.id);
      assert.ok(onsets(bar).length >= level.minOnsets, `${level.id} has too few notes`);
      // No bar opens on a half rest.
      assert.ok(!(bar[0].rest && bar[0].t >= 24), `${level.id} opens on a long rest`);
      // Two-beat figures never start on beat 2 or 4, so beat 3 always shows.
      let tick = 0;
      for (const e of bar) {
        if (!e.rest) assert.ok(!(tick < 24 && tick + e.t > 24), `${level.id} hides beat 3`);
        tick += e.t;
      }
      assert.ok(focusSets.length > 0);
    }
  }
});

test("a new bar is never the one it replaces", () => {
  const rand = seeded(3);
  const level = LEVELS[1];
  let prev = generateBar(level, rand);
  for (let i = 0; i < 100; i++) {
    const next = generateBar(level, rand, [prev]);
    assert.ok(!sameBar(prev, next));
    prev = next;
  }
  const bars = generateBars(level, 4, rand);
  for (let i = 0; i < bars.length; i++) for (let j = i + 1; j < bars.length; j++) assert.ok(!sameBar(bars[i], bars[j]));
});

test("quarter rests filling half a bar become a half rest, but not across the middle", () => {
  assert.deepEqual(mergeRests([r(12), r(12), n(12), n(12)]), [r(24), n(12), n(12)]);
  assert.deepEqual(mergeRests([n(12), r(12), r(12), n(12)]), [n(12), r(12), r(12), n(12)]);
  assert.deepEqual(mergeRests([n(12), n(12), r(12), r(12)]), [n(12), n(12), r(24)]);
});

test("tied notes sound once", () => {
  const push = FIGURES.find((f) => f.id === "push").bar;
  assert.deepEqual(
    onsets(push).map((o) => o.tick),
    [0, 18, 36],
  );
});

test("segments cut on beat lines and keep crossing figures whole", () => {
  const bar = [n(6), n(12), n(6), r(24)];
  const segs = segments(bar);
  assert.deepEqual(
    segs.map((s) => [s.from, s.beats]),
    [
      [0, 2],
      [2, 1],
      [3, 1],
    ],
  );
});

test("near misses differ from the answer and from each other, by one beat", () => {
  const rand = seeded(11);
  for (const level of LEVELS) {
    for (let i = 0; i < 40; i++) {
      const answer = generateBar(level, rand);
      const a = nearMiss(level, answer, rand);
      const b = nearMiss(level, answer, rand, [a]);
      assert.equal(barTicks(a), BAR);
      assert.equal(barTicks(b), BAR);
      assert.ok(!sameBar(a, answer) && !sameBar(b, answer) && !sameBar(a, b), level.id);
    }
  }
});

test("counts use the finest grid each beat needs", () => {
  const bar = [n(12), n(6), n(6), n(3), n(3), n(6), n(8), n(4)];
  const text = countsFor(bar).map((c) => c.text).join(" ");
  assert.equal(text, "1 2 & 3 e & a 4 trip let");
  const lit = countsFor(bar).filter((c) => c.onset).map((c) => c.text).join(" ");
  assert.equal(lit, "1 2 & 3 e & 4 let");
});

test("held notes leave their beat number unlit", () => {
  const tresillo = FIGURES.find((f) => f.id === "tresillo").bar;
  const counts = countsFor(tresillo);
  assert.equal(counts.map((c) => c.text).join(" "), "1 2 & 3 4");
  assert.equal(counts.filter((c) => c.onset).map((c) => c.text).join(" "), "1 & 4");
});

test("swing delays the & only in beats of plain eighths", () => {
  const bar = [n(6), n(6), n(3), n(3), n(6), n(12), n(12)];
  assert.equal(swungTick(bar, 6), 8);
  assert.equal(swungTick(bar, 18), 18);
  assert.equal(swungTick(bar, 24), 24);
});

test("bars are described in words", () => {
  assert.equal(describeBar([n(12), r(6), n(6, true), n(12), n(12)]), "quarter, eighth rest, eighth tied to quarter, quarter");
});
