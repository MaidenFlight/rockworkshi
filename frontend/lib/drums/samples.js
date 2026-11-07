// Loads the kit's recordings once per visit, for every page that uses them.
//
// Each file is decoded the moment its bytes arrive, in an OfflineAudioContext: unlike the one that
// plays, it needs no tap to start, so the very first pad pressed already has its sound. Once the
// real AudioContext exists (made on the first tap), the same bytes are decoded again in it, in
// the background, so playback runs at the device's own sample rate rather than being resampled on
// the fly; until each one is done, the first decode plays.
//
// MP3s can begin with a few milliseconds of encoder silence, more in some browsers than others,
// so every buffer's first sound is found and playback starts there: a hit sounds at once.
import { allSampleFiles, sampleUrl } from "./kit.js";

const ONSET_DB = -36; // the first sample this far under the file's peak is where the hit starts
const PRE_ROLL = 0.001; // and playback begins a millisecond before it, to keep the attack whole

let decoder = null;
const entries = new Map(); // file -> { bytes, sample, promise }
const listeners = new Set();
let upgradedFor = null;

// Where the sound starts, in seconds.
export function findOnset(buffer) {
  let peak = 0;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  for (const data of channels) for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  if (!peak) return 0;
  const threshold = peak * 10 ** (ONSET_DB / 20);
  for (let i = 0; i < buffer.length; i += 1) {
    for (const data of channels) {
      if (Math.abs(data[i]) >= threshold) return Math.max(0, i / buffer.sampleRate - PRE_ROLL);
    }
  }
  return 0;
}

function notify() {
  listeners.forEach((fn) => fn());
}

function load(file) {
  if (entries.has(file)) return entries.get(file).promise;
  const entry = { bytes: null, sample: null, promise: null };
  entry.promise = fetch(sampleUrl(file))
    .then((res) => {
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      return res.arrayBuffer();
    })
    .then((bytes) => {
      entry.bytes = bytes.slice(0); // decoding detaches the buffer it is given
      decoder ??= new OfflineAudioContext(2, 1, 44100);
      return decoder.decodeAudioData(bytes);
    })
    .then((buffer) => {
      entry.sample = { buffer, offset: findOnset(buffer) };
      notify();
      return entry.sample;
    });
  // A failed load is forgotten, so the next attempt tries again.
  entry.promise.catch(() => {
    entries.delete(file);
    notify();
  });
  entries.set(file, entry);
  return entry.promise;
}

// Starts loading every recording. Resolves once all have settled; `failed` lists any that didn't.
export async function loadKit() {
  const files = allSampleFiles();
  const results = await Promise.allSettled(files.map(load));
  return { failed: files.filter((_, i) => results[i].status === "rejected") };
}

// The decoded recording, or null while it is still on its way.
export function getSample(file) {
  return entries.get(file)?.sample || null;
}

export function kitProgress() {
  const files = allSampleFiles();
  return { ready: files.filter((f) => entries.get(f)?.sample).length, total: files.length };
}

export function onKitChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Decodes everything again in the AudioContext that plays, one file at a time.
export async function upgradeKit(ctx) {
  if (!ctx || upgradedFor === ctx || ctx.sampleRate === decoder?.sampleRate) return;
  upgradedFor = ctx;
  for (const file of allSampleFiles()) {
    const entry = entries.get(file);
    if (!entry?.bytes || upgradedFor !== ctx || ctx.state === "closed") continue;
    try {
      const buffer = await ctx.decodeAudioData(entry.bytes.slice(0));
      entry.sample = { buffer, offset: findOnset(buffer) };
    } catch {
      // Keep the first decode; it plays just the same.
    }
  }
}
