import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONFIG,
  cycleAccent,
  maxTempo,
  polyChoices,
  sanitizeConfig,
  setGroups,
  setMeter,
  setPulse,
  setTempo,
  subdivisionChoices,
  swingState,
} from "./config.js";
import { fromSearchParams, hasShareParams, toSearchParams } from "./share.js";

test("anything at all sanitizes to a playable config", () => {
  for (const junk of [null, undefined, 42, "x", [], { tempo: "fast", meter: { beats: 99, unit: 7 }, accents: "loud" }]) {
    const c = sanitizeConfig(junk);
    assert.ok(c.tempo >= 20 && c.tempo <= 300);
    assert.equal(c.accents.length, 4);
  }
  assert.deepEqual(sanitizeConfig({}), sanitizeConfig(DEFAULT_CONFIG));
});

test("tempo is validated to 20-300 and whole numbers", () => {
  assert.equal(setTempo(DEFAULT_CONFIG, 10).config.tempo, 20);
  assert.equal(setTempo(DEFAULT_CONFIG, 999).config.tempo, 300);
  assert.equal(setTempo(DEFAULT_CONFIG, 119.6).config.tempo, 120);
  assert.equal(setTempo(DEFAULT_CONFIG, Number.NaN).config.tempo, DEFAULT_CONFIG.tempo);
});

test("changing to 6/8 keeps the eighth notes at the same speed and says so", () => {
  const start = sanitizeConfig({ tempo: 120 });
  const { config, notice } = setMeter(start, 6, 8);
  assert.equal(config.meter.pulse, "group");
  assert.equal(config.tempo, 80, "quarter = 120 is dotted quarter = 80");
  assert.equal(config.subdivision, 3, "a compound beat starts with its three eighths");
  assert.deepEqual(config.accents, ["strong", "normal"]);
  assert.match(notice, /dotted quarter notes.*80.*same speed as 120 quarter notes/);
  // Same note value: the number stays and no notice is needed.
  const three = setMeter(start, 3, 4);
  assert.equal(three.config.tempo, 120);
  assert.equal(three.notice, null);
});

test("counting 6/8 in eighths instead of dotted quarters keeps the speed", () => {
  const sixEight = sanitizeConfig({ tempo: 60, meter: { beats: 6, unit: 8, groups: [3, 3], pulse: "group" } });
  const { config, notice } = setPulse(sixEight, "count");
  assert.equal(config.tempo, 180);
  assert.equal(config.accents.length, 6);
  assert.match(notice, /eighth notes/);
});

test("regrouping 9/8 unevenly makes the eighth the beat", () => {
  const nine = sanitizeConfig({ tempo: 60, meter: { beats: 9, unit: 8 } });
  assert.equal(nine.meter.pulse, "group");
  const { config } = setGroups(nine, [2, 2, 2, 3]);
  assert.equal(config.meter.pulse, "count");
  assert.equal(config.tempo, 180);
  assert.deepEqual(config.accents.filter((a) => a === "strong").length, 4);
});

test("a conversion past the fastest tempo is clamped and explained", () => {
  const fast = sanitizeConfig({ tempo: 200 });
  const { config, notice } = setMeter(fast, 7, 8);
  assert.equal(config.tempo, 300);
  assert.match(notice, /as close as/);
});

test("accents cycle Strong, Normal, Silent", () => {
  let c = sanitizeConfig({});
  c = cycleAccent(c, 0).config;
  assert.equal(c.accents[0], "normal");
  c = cycleAccent(c, 0).config;
  assert.equal(c.accents[0], "silent");
  c = cycleAccent(c, 0).config;
  assert.equal(c.accents[0], "strong");
});

test("incompatible combinations are disabled with a reason", () => {
  const poly = sanitizeConfig({ meter: { beats: 2, unit: 4 }, subdivision: 2, advanced: { swing: 67, poly: { on: true, notes: 3 } } });
  assert.equal(swingState(poly).available, false);
  assert.ok(subdivisionChoices(poly).filter((o) => o.n !== 1).every((o) => o.disabled && o.reason));
  assert.equal(polyChoices(poly).find((o) => o.notes === 2).disabled, true, "2 against 2 is not a polyrhythm");
  const compound = sanitizeConfig({ meter: { beats: 6, unit: 8 } });
  assert.match(swingState(compound).reason, /already holds three eighths/);
  assert.equal(swingState(sanitizeConfig({ subdivision: 2 })).available, true);
  assert.equal(swingState(sanitizeConfig({ subdivision: 3 })).available, false);
  // Six clicks a beat above 200 would be more than twenty a second.
  const sixes = sanitizeConfig({ tempo: 240, meter: { beats: 6, unit: 8 }, subdivision: 3 });
  assert.equal(subdivisionChoices(sixes).find((o) => o.n === 6).disabled, true);
  assert.equal(maxTempo({ ...sixes, subdivision: 6 }), 200);
  assert.equal(sanitizeConfig({ ...sixes, subdivision: 6 }).tempo, 200);
});

test("share links round-trip every musical setting", () => {
  const config = sanitizeConfig({
    tempo: 132,
    meter: { beats: 7, unit: 8, groups: [3, 2, 2] },
    accents: ["strong", "silent", "normal", "strong", "normal", "strong", "normal"],
    subdivision: 2,
    sound: { voice: "clave", subVolume: 0.35 },
    practice: { countIn: 2, timerMinutes: 15, timerEnd: "continue" },
    training: { mode: "builder", builder: { start: 100, target: 140, step: 4, bars: 6, atTarget: "stop" } },
    advanced: { swing: 60 },
  });
  const params = toSearchParams(config);
  assert.deepEqual(fromSearchParams(new URLSearchParams(params.toString())), { config, issues: [] });
  const silent = sanitizeConfig({ training: { mode: "silent", silent: { play: 3, rest: 1, showCues: false } }, advanced: { poly: { on: true, notes: 5, voice: "beep", volume: 0.4 } } });
  assert.deepEqual(fromSearchParams(toSearchParams(silent)).config, silent);
  const sixEight = sanitizeConfig({ tempo: 60, meter: { beats: 6, unit: 8, groups: [3, 3], pulse: "group" }, subdivision: 3 });
  assert.deepEqual(fromSearchParams(toSearchParams(sixEight)).config, sixEight);
});

test("share links carry settings only, never a name or this device's volume", () => {
  const params = toSearchParams(sanitizeConfig({ tempo: 100 }));
  const keys = [...params.keys()];
  assert.ok(keys.every((k) => ["v", "bpm", "ts", "g", "beat", "sub", "acc", "snd", "sv", "ci", "tm", "te", "tr", "tb", "sb", "sw", "poly", "pv", "pvol"].includes(k)));
  assert.equal(params.toString(), "v=1&bpm=100&ts=4-4");
});

test("a damaged share link opens with defaults and names what was dropped", () => {
  const result = fromSearchParams(new URLSearchParams("bpm=900&ts=7-8&g=2-2-2&acc=snn&sub=9&snd=cowbell&tr=builder&tb=1-2"));
  assert.deepEqual(result.issues, ["grouping", "tempo", "subdivision", "accents", "sound", "tempo builder"]);
  assert.equal(result.config.meter.beats, 7);
  assert.deepEqual(result.config.meter.groups, [2, 2, 3]);
  assert.equal(result.config.tempo, DEFAULT_CONFIG.tempo);
  assert.equal(result.config.training.mode, "off");
  assert.equal(fromSearchParams(new URLSearchParams("utm_source=mail")), null, "unrelated parameters aren't a setup");
  assert.equal(hasShareParams(new URLSearchParams("v=1")), false);
});
