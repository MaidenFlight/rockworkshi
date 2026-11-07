import test from "node:test";
import assert from "node:assert/strict";
import {
  METERS,
  MAX_PARTS,
  addBlock,
  addPart,
  blankBeat,
  clearPart,
  describeBeat,
  duplicatePart,
  freshPartName,
  moveBlock,
  remapNotes,
  removeBlock,
  removePart,
  renamePart,
  sameMusic,
  sanitizeBeat,
  setBlockBars,
  setBlockCrash,
  setMeter,
  setNote,
  setSwing,
  setTempo,
  songBars,
  stepOffsets,
  stepsPerBar,
} from "./beat.js";

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} expected ${b}, got ${a}`);

test("straight sixteenths sit at quarters of the beat; triplet meters split it in three", () => {
  assert.deepEqual(stepOffsets(METERS["4/4"]), [0, 0.25, 0.5, 0.75]);
  stepOffsets(METERS["12/8"]).forEach((x, i) => close(x, i / 3));
  assert.equal(stepsPerBar(METERS["4/4"]), 16);
  assert.equal(stepsPerBar(METERS["3/4"]), 12);
  assert.equal(stepsPerBar(METERS["12/8"]), 12);
  assert.equal(stepsPerBar(METERS["6/8"]), 6);
});

test("eighth swing moves the & toward the triplet and carries the e and a with it", () => {
  const o = stepOffsets(METERS["4/4"], 100 * (2 / 3 - 0.5) / 0.25, 8);
  close(o[2], 2 / 3, "&");
  close(o[1], 1 / 3, "e");
  close(o[3], 2 / 3 + 1 / 6, "a");
  const full = stepOffsets(METERS["4/4"], 100, 8);
  close(full[2], 0.75, "& at full swing");
});

test("sixteenth swing moves only the e and the a", () => {
  const o = stepOffsets(METERS["4/4"], 100, 16);
  close(o[0], 0);
  close(o[1], 0.375);
  close(o[2], 0.5);
  close(o[3], 0.875);
});

test("swing does nothing on the triplet meters", () => {
  assert.deepEqual(stepOffsets(METERS["12/8"], 80, 8), stepOffsets(METERS["12/8"]));
});

test("setting and clearing notes, and a row with no notes left disappears", () => {
  let beat = blankBeat();
  const id = beat.parts[0].id;
  beat = setNote(beat, id, "snare", 4, 3);
  assert.equal(beat.parts[0].notes.snare.length, 16);
  assert.equal(beat.parts[0].notes.snare[4], 3);
  const same = setNote(beat, id, "snare", 4, 3);
  assert.equal(same, beat, "setting a note to what it already is changes nothing");
  beat = setNote(beat, id, "snare", 4, 0);
  assert.equal(beat.parts[0].notes.snare, undefined);
  assert.equal(setNote(beat, id, "cowbell", 0, 2), beat, "an unknown piece is ignored");
  assert.equal(setNote(beat, id, "kick", 16, 2), beat, "a step past the bar is ignored");
});

test("edits never change the beat they were given", () => {
  const beat = blankBeat();
  const before = JSON.stringify(beat);
  setNote(beat, beat.parts[0].id, "kick", 0, 2);
  setTempo(beat, 150);
  addPart(beat, "Chorus");
  assert.equal(JSON.stringify(beat), before);
});

test("notes move to another meter by where they fall in the bar", () => {
  const notes = { kick: [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0] };
  const shuffle = remapNotes(notes, METERS["4/4"], METERS["12/8"]);
  assert.deepEqual(shuffle.kick, [2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  assert.deepEqual(shuffle.snare, [0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0]);
  const waltz = remapNotes(notes, METERS["4/4"], METERS["3/4"]);
  assert.deepEqual(waltz.snare, [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0], "beat 4 is dropped from a three-beat bar");
});

test("changing the meter moves every part", () => {
  let beat = blankBeat();
  beat = setNote(beat, beat.parts[0].id, "kick", 8, 2);
  const { beat: two, id } = addPart(beat, "Chorus");
  const withSnare = setNote(two, id, "snare", 12, 2);
  const shuffled = setMeter(withSnare, "12/8");
  assert.equal(shuffled.meter, "12/8");
  assert.equal(shuffled.parts[0].notes.kick[6], 2);
  assert.equal(shuffled.parts[1].notes.snare[9], 2);
  assert.equal(setMeter(shuffled, "nope"), shuffled);
});

test("parts: fresh names, a limit of eight, copies that don't share notes", () => {
  let beat = blankBeat();
  assert.equal(freshPartName(beat, "Groove 1"), "Groove 1 2");
  const ids = [];
  for (let i = 0; i < MAX_PARTS + 2; i += 1) {
    const r = addPart(beat, "Chorus");
    beat = r.beat;
    if (r.id) ids.push(r.id);
  }
  assert.equal(beat.parts.length, MAX_PARTS);
  assert.equal(beat.parts[1].name, "Chorus");
  assert.equal(beat.parts[2].name, "Chorus 2");

  let small = blankBeat();
  small = setNote(small, small.parts[0].id, "kick", 0, 2);
  const { beat: copied, id } = duplicatePart(small, small.parts[0].id);
  const edited = setNote(copied, id, "kick", 0, 0);
  assert.equal(edited.parts[0].notes.kick[0], 2, "the original keeps its note");
  assert.equal(renamePart(edited, id, "   ").parts[1].name, copied.parts[1].name, "a blank name is refused");
  assert.equal(renamePart(edited, id, "  Big   chorus ").parts[1].name, "Big chorus");
});

test("removing a part removes its song blocks; the last part stays", () => {
  let beat = blankBeat();
  const first = beat.parts[0].id;
  const { beat: b2, id } = addPart(beat, "Fill");
  beat = addBlock(addBlock(b2, first, 3), id, 1);
  const removed = removePart(beat, id);
  assert.equal(removed.parts.length, 1);
  assert.deepEqual(removed.song.map((b) => b.part), [first]);
  assert.equal(removePart(removed, first), removed);
});

test("the song: blocks repeat their part, only the first bar crashes", () => {
  let beat = blankBeat();
  const verse = beat.parts[0].id;
  const r = addPart(beat, "Chorus");
  beat = addBlock(r.beat, verse, 2);
  beat = addBlock(beat, r.id, 3);
  beat = setBlockCrash(beat, beat.song[1].id, true);
  const bars = songBars(beat);
  assert.equal(bars.length, 5);
  assert.deepEqual(bars.map((b) => b.part), [verse, verse, r.id, r.id, r.id]);
  assert.deepEqual(bars.map((b) => b.crash), [false, false, true, false, false]);
  beat = setBlockBars(beat, beat.song[0].id, 99);
  assert.equal(beat.song[0].bars, 16);
  beat = moveBlock(beat, beat.song[1].id, -1);
  assert.equal(beat.song[0].part, r.id);
  assert.equal(moveBlock(beat, beat.song[0].id, -1), beat, "the first block can't move further left");
  beat = removeBlock(beat, beat.song[0].id);
  assert.equal(beat.song.length, 1);
  assert.match(describeBeat(beat), /100 BPM · 4\/4 · 2 parts · 16-bar song/);
});

test("clearing a part and the tempo and swing limits", () => {
  let beat = blankBeat();
  const id = beat.parts[0].id;
  beat = setNote(beat, id, "kick", 0, 2);
  assert.deepEqual(clearPart(beat, id).parts[0].notes, {});
  assert.equal(setTempo(beat, 999).tempo, 240);
  assert.equal(setTempo(beat, 3).tempo, 40);
  assert.equal(setTempo(beat, "abc").tempo, 100);
  assert.deepEqual([setSwing(beat, 150, 16).swing, setSwing(beat, 150, 16).swingUnit], [100, 16]);
});

test("a damaged or foreign beat is rebuilt into a playable one", () => {
  const blank = sanitizeBeat("nonsense");
  assert.equal(blank.parts.length, 1);
  assert.equal(blank.tempo, 100);

  const raw = {
    tempo: 500,
    meter: "5/4",
    swing: -4,
    parts: [
      { id: "a", name: "Verse", notes: { kick: [2, 0, 9, "x"], cowbell: [2], snare: "xxxx" } },
      { id: "a", name: "", notes: {} },
      "junk",
    ],
    song: [{ part: "a", bars: 0 }, { part: "missing", bars: 4 }, { part: "a", bars: 4, crash: "yes" }],
  };
  const beat = sanitizeBeat(raw);
  assert.equal(beat.tempo, 240);
  assert.equal(beat.meter, "4/4");
  assert.equal(beat.swing, 0);
  assert.equal(beat.parts.length, 2);
  assert.notEqual(beat.parts[1].id, "a", "a repeated id is replaced");
  assert.equal(beat.parts[1].name, "Part 2");
  assert.deepEqual(beat.parts[0].notes.kick.slice(0, 4), [2, 0, 3, 0]);
  assert.equal(beat.parts[0].notes.cowbell, undefined);
  assert.equal(beat.parts[0].notes.snare, undefined);
  assert.deepEqual(beat.song.map((b) => [b.part, b.bars, b.crash]), [["a", 1, false], ["a", 4, true]]);
});

test("sameMusic ignores ids but not notes", () => {
  const a = blankBeat();
  const b = sanitizeBeat({ ...a, parts: a.parts.map((p) => ({ ...p, id: "other" })) });
  assert.ok(sameMusic(a, b));
  assert.ok(!sameMusic(a, setNote(a, a.parts[0].id, "kick", 0, 2)));
});
