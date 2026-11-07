import test from "node:test";
import assert from "node:assert/strict";
import { GROOVES, STYLES, grooveNotes, starterBeat } from "./grooves.js";
import { METERS, TEMPO_MAX, TEMPO_MIN, sameMusic, sanitizeBeat, songLength, stepsPerBar } from "./beat.js";
import { PIECE_BY_ID } from "./kit.js";

test("every groove is a full bar of known drums on its meter's grid", () => {
  const ids = new Set();
  for (const g of GROOVES) {
    assert.ok(!ids.has(g.id), `${g.id} is listed twice`);
    ids.add(g.id);
    assert.ok(METERS[g.meter], `${g.id}: meter ${g.meter}`);
    assert.ok(STYLES.includes(g.style), `${g.id}: style ${g.style}`);
    assert.ok(g.tempo >= TEMPO_MIN && g.tempo <= TEMPO_MAX, `${g.id}: tempo`);
    assert.ok(g.name && g.note, `${g.id}: needs a name and a line about it`);
    const steps = stepsPerBar(METERS[g.meter]);
    for (const [piece, text] of Object.entries(g.rows)) {
      assert.ok(PIECE_BY_ID[piece], `${g.id}: unknown drum ${piece}`);
      assert.equal(text.length, steps, `${g.id}/${piece}: ${text.length} steps, the bar has ${steps}`);
      assert.match(text, /^[-gxX]+$/, `${g.id}/${piece}`);
    }
    assert.ok(Object.keys(grooveNotes(g)).length > 0, `${g.id} has notes`);
  }
});

test("every style has at least one groove", () => {
  for (const style of STYLES) assert.ok(GROOVES.some((g) => g.style === style), style);
});

test("the backbeat lands on 2 and 4 in the first rock groove", () => {
  const notes = grooveNotes(GROOVES.find((g) => g.id === "rock-8ths"));
  assert.deepEqual(
    notes.snare.flatMap((v, i) => (v ? [i] : [])),
    [4, 12],
  );
  assert.equal(notes.hatClosed[0], 3, "accented hat on the 1");
  assert.equal(notes.hatClosed[2], 2);
});

test("the starter song is a valid beat that plays a fill into a crash", () => {
  const beat = starterBeat();
  assert.ok(sameMusic(sanitizeBeat(beat), beat));
  assert.equal(songLength(beat), 8);
  assert.deepEqual(beat.parts.map((p) => p.name), ["Verse", "Chorus", "Fill"]);
  assert.ok(beat.song[2].crash);
});
