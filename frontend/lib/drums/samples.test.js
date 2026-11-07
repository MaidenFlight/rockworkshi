import test from "node:test";
import assert from "node:assert/strict";
import { findOnset } from "./samples.js";

// A stand-in for an AudioBuffer: `lead` seconds of near-silence, then a decaying hit.
function fakeBuffer(lead, { sampleRate = 44100, noise = 0.0004 } = {}) {
  const length = Math.round(sampleRate * (lead + 0.2));
  const data = new Float32Array(length);
  const start = Math.round(lead * sampleRate);
  for (let i = 0; i < length; i += 1) {
    data[i] = i < start ? noise * Math.sin(i) : 0.8 * Math.exp(-(i - start) / 2000) * Math.sin(i * 0.3);
  }
  return { numberOfChannels: 2, length, sampleRate, getChannelData: () => data };
}

test("playback starts a millisecond before the hit, skipping an encoder's lead-in", () => {
  const onset = findOnset(fakeBuffer(0.026));
  assert.ok(Math.abs(onset - 0.025) < 0.0002, `onset ${onset}`);
  assert.equal(findOnset(fakeBuffer(0)), 0, "a hit at the very start plays from the start");
  const silent = { numberOfChannels: 1, length: 100, sampleRate: 44100, getChannelData: () => new Float32Array(100) };
  assert.equal(findOnset(silent), 0);
});
