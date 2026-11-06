import test from "node:test";
import assert from "node:assert/strict";
import { STARTER_EXERCISES, cleanName, openStore, scopeFor, storageKey } from "./presets.js";
import { DEFAULT_PREFS, sanitizeConfig } from "./config.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

const config = sanitizeConfig({ tempo: 140, meter: { beats: 7, unit: 8 } });

test("save, rename, duplicate and delete, all written back to storage", () => {
  const storage = memoryStorage();
  const store = openStore("guest", storage);
  const saved = store.save("  7/8   drill ", config);
  assert.equal(saved.name, "7/8 drill");
  assert.equal(saved.source, "local");
  assert.equal(store.rename(saved.id, "Odd-meter warm-up"), true);
  const copy = store.duplicate(saved.id);
  assert.equal(copy.name, "Odd-meter warm-up (copy)");
  assert.deepEqual(store.getSnapshot().presets.map((p) => p.name), ["Odd-meter warm-up", "Odd-meter warm-up (copy)"]);
  store.remove(saved.id);
  const reopened = openStore("guest", storage);
  assert.deepEqual(reopened.getSnapshot().presets.map((p) => p.name), ["Odd-meter warm-up (copy)"]);
  assert.deepEqual(reopened.getSnapshot().presets[0].config, config);
  assert.equal(reopened.getSnapshot().notice, null);
});

test("undo puts a deleted preset back in its place", () => {
  const store = openStore("guest", memoryStorage());
  const a = store.save("A", config);
  const b = store.save("B", config);
  store.remove(a.id);
  store.restore(a, 1);
  assert.deepEqual(store.getSnapshot().presets.map((p) => p.id), [b.id, a.id]);
});

test("each student's presets are kept apart, and only an id goes in the key", () => {
  const storage = memoryStorage();
  openStore(scopeFor({ id: "u1", email: "alani@example.test", firstName: "Alani" }), storage).save("Mine", config);
  assert.equal(openStore(scopeFor({ id: "u2" }), storage).getSnapshot().presets.length, 0);
  assert.equal(openStore(scopeFor(null), storage).getSnapshot().presets.length, 0);
  const keys = [...storage.data.keys()];
  assert.deepEqual(keys, [storageKey("user:u1")]);
  assert.ok(!keys[0].includes("alani"));
});

test("damaged storage is set aside and the list starts again, with a notice", () => {
  const key = storageKey("guest");
  const storage = memoryStorage({ [key]: "{not json" });
  const store = openStore("guest", storage);
  assert.equal(store.getSnapshot().presets.length, 0);
  assert.match(store.getSnapshot().notice, /damaged/);
  assert.equal(storage.data.get(`${key}:damaged`), "{not json");
  store.save("Fresh", config);
  assert.equal(JSON.parse(storage.data.get(key)).presets.length, 1);
});

test("a single broken preset is dropped and the rest survive", () => {
  const key = storageKey("guest");
  const good = { id: "a", name: "Good", config: { tempo: 77 } };
  const storage = memoryStorage({ [key]: JSON.stringify({ v: 1, presets: [good, { id: "", name: "x" }, { id: "b", name: "Bad config", config: "nope" }], last: { config: { tempo: 999 }, prefs: { volume: 7 } } }) });
  const snap = openStore("guest", storage).getSnapshot();
  assert.deepEqual(snap.presets.map((p) => p.name), ["Good"]);
  assert.equal(snap.presets[0].config.tempo, 77);
  assert.match(snap.notice, /2 saved presets were damaged/);
  assert.equal(snap.last.config.tempo, 300, "an out-of-range last setup is clamped, not trusted");
  assert.equal(snap.last.prefs.volume, 1);
});

test("no storage at all: presets work for this visit and the page says so", () => {
  const store = openStore("guest", null);
  assert.equal(store.getSnapshot().persistent, false);
  assert.match(store.getSnapshot().notice, /only last until you leave/);
  assert.ok(store.save("Temp", config));
  assert.equal(store.getSnapshot().presets.length, 1);
});

test("storage that refuses to write falls back to memory and says so", () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  const store = openStore("guest", storage);
  store.save("Too big", config);
  const snap = store.getSnapshot();
  assert.equal(snap.presets.length, 1);
  assert.equal(snap.persistent, false);
  assert.match(snap.notice, /full or blocked/);
});

test("the last setup is remembered with this device's preferences", () => {
  const storage = memoryStorage();
  openStore("guest", storage).saveLast(config, { volume: 0.4, visualOnly: true });
  const last = openStore("guest", storage).getSnapshot().last;
  assert.deepEqual(last.config, config);
  assert.deepEqual(last.prefs, { ...DEFAULT_PREFS, volume: 0.4, visualOnly: true });
});

test("names are trimmed, collapsed and capped; empty names are refused", () => {
  assert.equal(cleanName("  a   b  "), "a b");
  assert.equal(cleanName("x".repeat(80)).length, 60);
  assert.equal(openStore("guest", memoryStorage()).save("   ", config), null);
});

test("starter exercises are valid, editable configs", () => {
  assert.equal(STARTER_EXERCISES.length, 6);
  for (const ex of STARTER_EXERCISES) assert.deepEqual(sanitizeConfig(ex.config), ex.config, ex.name);
  const speed = STARTER_EXERCISES.find((e) => e.id === "speed-building").config.training;
  assert.deepEqual(speed.builder, { start: 60, target: 100, step: 5, bars: 8, atTarget: "stop" });
  assert.deepEqual(STARTER_EXERCISES.find((e) => e.id === "backbeat").config.accents, ["normal", "strong", "normal", "strong"]);
  assert.deepEqual(STARTER_EXERCISES.find((e) => e.id === "two-on-two-off").config.training.silent, { play: 2, rest: 2, showCues: true });
});
