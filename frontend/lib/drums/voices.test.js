import test from "node:test";
import assert from "node:assert/strict";
import { KitVoices } from "./voices.js";
import { LEVEL } from "./kit.js";

// Just enough of an AudioContext to see where each hit is wired and how loud it is.
function fakeContext() {
  const param = (value) => ({
    value,
    setValueAtTime() {},
    cancelScheduledValues() {},
    setTargetAtTime(v) {
      this.value = v;
    },
  });
  const node = () => ({
    gain: param(1),
    connect(to) {
      this.to = to;
    },
    disconnect() {},
  });
  return { currentTime: 1, createGain: node, createBufferSource: () => ({ ...node(), start() {}, stop() {} }) };
}

const makeVoices = () => new KitVoices(fakeContext(), { name: "output" }, () => ({ buffer: { duration: 1 }, offset: 0 }));

test("muting a drum silences the beat's hits but not the ones played by hand", () => {
  const voices = makeVoices();
  voices.setMix({}, ["snare"], { immediate: true });

  voices.hit("snare", LEVEL.normal, 1, { tag: "seq" });
  const fromBeat = voices.voices.snare.at(-1);
  assert.equal(fromBeat.gain.to, voices.beatGains.snare);
  assert.equal(voices.beatGains.snare.gain.value, 0, "the beat's snare is shut");

  voices.hit("snare", LEVEL.normal, 1);
  const byHand = voices.voices.snare.at(-1);
  assert.equal(byHand.gain.to, voices.gains.snare, "played by hand, it skips the mute");
  assert.equal(voices.gains.snare.gain.value, 1);
});

test("a drum's level applies to the beat and to playing by hand alike", () => {
  const voices = makeVoices();
  voices.setMix({ kick: 0.5 }, [], { immediate: true });
  assert.equal(voices.beatGains.kick.to, voices.gains.kick, "the beat runs through the level");
  assert.equal(voices.gains.kick.gain.value, 0.5);
  assert.equal(voices.beatGains.kick.gain.value, 1);
});

test("muting and unmuting while it plays moves only the mute", () => {
  const voices = makeVoices();
  voices.setMix({ ride: 0.8 }, ["ride"]);
  assert.equal(voices.beatGains.ride.gain.value, 0);
  assert.equal(voices.gains.ride.gain.value, 0.8);
  voices.setMix({ ride: 0.8 }, []);
  assert.equal(voices.beatGains.ride.gain.value, 1);
});

test("a velocity gain scales just that hit", () => {
  const voices = makeVoices();
  voices.hit("kick", LEVEL.normal, 1, { velocityGain: 0.25 });
  assert.equal(voices.voices.kick.at(-1).gain.gain.value, 0.25);
  voices.hit("kick", LEVEL.normal, 1);
  assert.equal(voices.voices.kick.at(-1).gain.gain.value, 1);
});
