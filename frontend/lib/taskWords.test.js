import { test } from "node:test";
import assert from "node:assert/strict";
import { singAlong, stepWords, taskWords } from "./taskWords.js";

test("a milestone named as a thing to do is used as it is, never 'practise Sing along with…'", () => {
  const w = stepWords({ section: "Sing along with Verse 1" });
  assert.equal(w.plan, "sing along with Verse 1");
  assert.equal(w.label, "Sing along with Verse 1");
  assert.equal(w.loop, "this part of the song");
  assert.equal(w.record, "it");
  assert.equal(w.today, "Sing along with Verse 1");
  for (const name of ["Play an Am chord", "Switch G to C", "Move from A to F", "Count in and start on time", "Practise the chorus"]) {
    assert.equal(taskWords(name).kind, "action", name);
  }
});

test("a part of the song keeps its name, and the whole of it is recorded", () => {
  const w = stepWords({ section: "Verse 1" });
  assert.equal(w.plan, "practise Verse 1");
  assert.equal(w.label, "Practise Verse 1");
  assert.equal(w.loop, "Verse 1");
  assert.equal(w.record, "the whole of Verse 1");
  assert.equal(w.today, "Loop Verse 1");
  assert.equal(stepWords({ section: "Chorus chords with the band" }).record, "the whole of Chorus chords with the band");
});

test("a name that starts with 'the' or 'your' reads lower-case mid-sentence", () => {
  assert.equal(stepWords({ section: "The whole song" }).plan, "practise the whole song");
  assert.equal(stepWords({ section: "The whole song" }).record, "the whole song");
  assert.equal(stepWords({ section: "Your trickiest spot" }).label, "Practise your trickiest spot");
  assert.equal(stepWords({ section: "The whole song at 90% speed" }).today, "Loop the whole song at 90% speed");
});

test("notes, chords and capitals are left as they were typed", () => {
  assert.equal(taskWords("A minor groove").text, "A minor groove");
  assert.equal(taskWords("Am to F").text, "Am to F");
  assert.equal(taskWords("THE END").text, "THE END");
});

test("work with no section name still reads as before", () => {
  const w = stepWords({ section: null });
  assert.equal(w.plan, "practise the section");
  assert.equal(w.label, "Practise the section");
  assert.equal(w.record, "the whole of the section");
});

test("only the Sing-a-long level skips tuning up", () => {
  assert.equal(singAlong({ level: 1 }), true);
  assert.equal(singAlong({ level: "1" }), true);
  assert.equal(singAlong({ level: 2 }), false);
  assert.equal(singAlong(null), false);
});
