import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACCENT_GAIN, GHOST_GAIN, GRID_ORDER, LEVEL, PIECES, PIECE_BY_CODE, allSampleFiles, layerFor, nextRoundRobin, piecesIn, GROUPS } from "./kit.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sampleDir = path.join(here, "..", "..", "public", "samples", "drums");

test("every recording the kit names is shipped, and nothing extra is", () => {
  const named = new Set(allSampleFiles().map((f) => `${f}.mp3`));
  const shipped = new Set(fs.readdirSync(sampleDir).filter((f) => f.endsWith(".mp3")));
  assert.deepEqual([...named].filter((f) => !shipped.has(f)), [], "named but missing");
  assert.deepEqual([...shipped].filter((f) => !named.has(f)), [], "shipped but never played");
  const bytes = [...shipped].reduce((n, f) => n + fs.statSync(path.join(sampleDir, f)).size, 0);
  assert.ok(bytes < 1024 * 1024, `the kit should stay under 1 MB, it is ${bytes} bytes`);
});

test("each drum has its own key, a place on the kit and a row in the grid", () => {
  assert.equal(Object.keys(PIECE_BY_CODE).length, PIECES.length);
  assert.deepEqual([...GRID_ORDER].sort(), PIECES.map((p) => p.id).sort());
  assert.equal(GROUPS.flatMap((g) => piecesIn(g.id)).length, PIECES.length);
  assert.equal(new Set(PIECES.map((p) => p.midi)).size, PIECES.length, "MIDI notes are distinct");
});

test("a level picks its own recording where there is one, else turns the main one up or down", () => {
  const snare = PIECES.find((p) => p.id === "snare");
  const side = PIECES.find((p) => p.id === "sidestick");
  assert.deepEqual(layerFor(snare, LEVEL.accent), { files: snare.files.accent, gain: 1 });
  assert.deepEqual(layerFor(snare, LEVEL.ghost), { files: snare.files.ghost, gain: 1 });
  assert.deepEqual(layerFor(side, LEVEL.accent), { files: side.files.main, gain: ACCENT_GAIN });
  assert.deepEqual(layerFor(side, LEVEL.ghost), { files: side.files.main, gain: GHOST_GAIN });
  assert.deepEqual(layerFor(side, LEVEL.normal), { files: side.files.main, gain: 1 });
});

test("round robins never repeat the one just played", () => {
  let last = null;
  for (let i = 0; i < 500; i += 1) {
    const next = nextRoundRobin(3, last);
    assert.ok(next >= 0 && next < 3);
    assert.notEqual(next, last);
    last = next;
  }
  assert.equal(nextRoundRobin(1, 0), 0);
});
