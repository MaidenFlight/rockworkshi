import type { AudioParam, BaseAudioContext, ConvolverNode, GainNode } from "react-native-audio-api";
import { SMOOTHING, dbToGain } from "./mix";

// Effects rack for the student's recorded take. The take's own buffer is never changed:
// effects only exist on the way out. The website has the same chain in
// frontend/lib/audio/takeEffects.js. Keep the two in step.
//
// Every node used here (biquad shelves and peak, WaveShaper, Convolver, Gain) is in
// react-native-audio-api's native core, so it runs the same on Android and iOS.

export type ReverbSize = "small" | "medium" | "large";
export type Effects = {
  bypass: boolean;
  low: number; // dB
  mid: number; // dB
  high: number; // dB
  drive: number; // %
  reverb: number; // % wet
  size: ReverbSize;
  output: number; // dB
};

export const DEFAULT_EFFECTS: Effects = {
  bypass: false,
  low: 0,
  mid: 0,
  high: 0,
  drive: 0,
  reverb: 0,
  size: "medium",
  output: 0,
};

// Restrained on purpose: these should flatter a practice take, not disguise it.
export const EFFECT_PRESETS: { id: string; label: string; settings: Effects }[] = [
  { id: "clean", label: "Clean", settings: { ...DEFAULT_EFFECTS, high: 1.5, reverb: 12, size: "small" } },
  {
    id: "crunch",
    label: "Crunch",
    settings: { ...DEFAULT_EFFECTS, low: 1, mid: 2, high: -1.5, drive: 35, reverb: 10, size: "small", output: -1 },
  },
  { id: "spacious", label: "Spacious", settings: { ...DEFAULT_EFFECTS, low: -1, high: 2, reverb: 30, size: "large", output: -1 } },
];

export const REVERB_SIZES: { id: ReverbSize; label: string; seconds: number }[] = [
  { id: "small", label: "Room", seconds: 0.8 },
  { id: "medium", label: "Hall", seconds: 1.6 },
  { id: "large", label: "Big hall", seconds: 2.8 },
];

const EQ_BANDS = {
  low: { type: "lowshelf", frequency: 150, Q: 0 },
  mid: { type: "peaking", frequency: 1000, Q: 0.8 },
  high: { type: "highshelf", frequency: 4500, Q: 0 },
} as const;
type Band = keyof typeof EQ_BANDS;

// Drive multiplies the signal into a tanh curve. The curve can only be set once on this
// library's WaveShaper, so drive is all in the gains around it. No oversampling: its
// resampler would delay the driven take and pull it out of time with the band.
const DRIVE_RANGE = 4;
const MAX_DRIVE_GAIN = 12;
const DRIVE_TONE_HZ = 6500; // takes the fizz (and most aliasing) off the driven signal
const SWAP_MS = 300; // how long an outgoing reverb is kept while it fades

function driveCurve(points = 4096) {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) curve[i] = Math.tanh(((i / (points - 1)) * 2 - 1) * DRIVE_RANGE);
  return curve;
}

function driveAmounts(drive: number) {
  const gain = 1 + (drive / 100) * (MAX_DRIVE_GAIN - 1);
  return {
    on: drive > 0 ? 1 : 0,
    pre: gain / DRIVE_RANGE,
    // Saturation makes the take louder; this keeps its level roughly where it was.
    comp: 1 / Math.sqrt(gain),
  };
}

// Same noise every time for a given size, so a reverb sounds the same each session.
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Decaying stereo noise with a short pre-delay, getting darker as it fades, like a real room.
function impulseResponse(ctx: BaseAudioContext, sizeId: ReverbSize) {
  const size = REVERB_SIZES.find((s) => s.id === sizeId) ?? REVERB_SIZES[1];
  const rate = ctx.sampleRate;
  const preDelay = Math.floor(rate * 0.012);
  const length = Math.floor(rate * size.seconds);
  const ir = ctx.createBuffer(2, preDelay + length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const random = seededRandom(size.seconds * 1000 + ch);
    const data = new Float32Array(preDelay + length);
    let smoothed = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      smoothed += (random() * 2 - 1 - smoothed) * (0.9 - 0.7 * progress);
      data[preDelay + i] = smoothed * Math.exp((-6.9 * i) / length); // -60 dB by the end
    }
    ir.copyToChannel(data, ch);
  }
  return ir;
}

function reverbLevels(percent: number) {
  return { dry: 1 - (percent / 100) * 0.3, wet: (percent / 100) * 0.7 };
}

// input -> [bypass] ------------------------------------------------------------> output
//       -> EQ (low shelf, mid peak, high shelf)
//            -> clean ---------------------------------------> drive sum
//            -> drive gain -> tanh -> tone -> level match -----> drive sum
//          drive sum -> dry ------------------------> level -> output
//                    -> convolver -> wet -----------> level
export function createTakeEffects(ctx: BaseAudioContext, initial: Effects = DEFAULT_EFFECTS) {
  const gain = (value = 1) => {
    const g = ctx.createGain();
    g.gain.value = value;
    return g;
  };

  const input = gain();
  const output = gain();
  const bypassPath = gain(0);
  const effectPath = gain(1);

  const bands = {} as Record<Band, ReturnType<BaseAudioContext["createBiquadFilter"]>>;
  for (const name of Object.keys(EQ_BANDS) as Band[]) {
    const spec = EQ_BANDS[name];
    const f = ctx.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.frequency;
    if (spec.Q) f.Q.value = spec.Q;
    f.gain.value = 0;
    bands[name] = f;
  }

  const clean = gain(1);
  const drivePre = gain(1 / DRIVE_RANGE);
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve();
  shaper.oversample = "none";
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = DRIVE_TONE_HZ;
  const driveComp = gain(1);
  const driveOn = gain(0);
  const driveSum = gain(1);
  const dry = gain(1);
  const level = gain(1);

  input.connect(bypassPath);
  bypassPath.connect(output);
  input.connect(bands.low);
  bands.low.connect(bands.mid);
  bands.mid.connect(bands.high);
  bands.high.connect(clean);
  bands.high.connect(drivePre);
  clean.connect(driveSum);
  drivePre.connect(shaper);
  shaper.connect(tone);
  tone.connect(driveComp);
  driveComp.connect(driveOn);
  driveOn.connect(driveSum);
  driveSum.connect(dry);
  dry.connect(level);
  level.connect(effectPath);
  effectPath.connect(output);

  // The convolver only exists while reverb is audible: it's the costly part on a phone.
  let reverb: { size: ReverbSize; conv: ConvolverNode; wet: GainNode } | null = null;

  const set = (param: AudioParam, value: number) => param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);

  function retire(old: typeof reverb) {
    if (!old) return;
    set(old.wet.gain, 0);
    setTimeout(() => {
      old.conv.disconnect();
      old.wet.disconnect();
    }, SWAP_MS);
  }

  function updateReverb(next: Effects) {
    const wanted = !next.bypass && next.reverb > 0;
    if (!wanted) {
      retire(reverb);
      reverb = null;
      return;
    }
    if (!reverb || reverb.size !== next.size) {
      // A new size gets its own convolver, cross-faded in, rather than swapping the
      // impulse response under a running one.
      retire(reverb);
      const conv = ctx.createConvolver();
      conv.buffer = impulseResponse(ctx, next.size);
      const wet = gain(0);
      driveSum.connect(conv);
      conv.connect(wet);
      wet.connect(level);
      reverb = { size: next.size, conv, wet };
    }
    set(reverb.wet.gain, reverbLevels(next.reverb).wet);
  }

  function apply(next: Effects) {
    set(bypassPath.gain, next.bypass ? 1 : 0);
    set(effectPath.gain, next.bypass ? 0 : 1);
    for (const band of Object.keys(EQ_BANDS) as Band[]) set(bands[band].gain, next[band]);
    const d = driveAmounts(next.drive);
    set(drivePre.gain, d.pre);
    set(driveComp.gain, d.comp);
    set(driveOn.gain, d.on);
    set(clean.gain, 1 - d.on);
    set(dry.gain, reverbLevels(next.reverb).dry);
    set(level.gain, dbToGain(next.output));
    updateReverb(next);
  }

  apply(initial);
  return { input, output, apply };
}
