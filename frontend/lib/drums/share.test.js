import test from "node:test";
import assert from "node:assert/strict";
import { SHARE_PARAM, decodeBeat, encodeBeat, shareUrl } from "./share.js";
import { sameMusic, setBeatName, setMeter, setSwing } from "./beat.js";
import { starterBeat } from "./grooves.js";

test("a beat survives the trip through a link", () => {
  let beat = setSwing(starterBeat(), 40, 16);
  beat = setBeatName(beat, "Pāʻina groove");
  const back = decodeBeat(encodeBeat(beat));
  assert.ok(sameMusic(back, beat));
  assert.equal(back.name, "Pāʻina groove");
  assert.equal(back.song[2].crash, true);
  const shuffled = setMeter(beat, "12/8");
  assert.ok(sameMusic(decodeBeat(encodeBeat(shuffled)), shuffled));
});

test("the link is short enough to paste anywhere", () => {
  const url = shareUrl(starterBeat(), "https://example.com", "/tools/beats");
  assert.ok(url.length < 1200, `${url.length} characters`);
  assert.ok(new URL(url).searchParams.get(SHARE_PARAM));
});

test("text that isn't a beat gives null; a damaged beat still opens", () => {
  assert.equal(decodeBeat("not base64 !!"), null);
  assert.equal(decodeBeat(btoa("{nope")), null);
  assert.equal(decodeBeat(""), null);
  const odd = btoa(JSON.stringify({ t: 999, m: "7/4", p: [["Verse", { kick: "2000400020002000", cowbell: "2222" }]], g: [[0, 2], [5, 1]] }))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const beat = decodeBeat(odd);
  assert.equal(beat.tempo, 240);
  assert.equal(beat.meter, "4/4");
  assert.equal(beat.parts[0].notes.kick, undefined, "a digit past 3 makes the row unreadable");
  assert.equal(beat.parts[0].notes.cowbell, undefined);
  assert.equal(beat.song.length, 1, "the block pointing at a missing part is dropped");
});
