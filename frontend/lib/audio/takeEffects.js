// Effects rack for the student's recorded take. Built per audio context, so the live
// player and the .wav export (an OfflineAudioContext) run the same chain. The take's
// own buffer is never changed: effects only exist on the way out.
// The phone app has the same chain in mobile/src/lib/audio/takeEffects.ts. Keep them in step.
import { SMOOTHING, dbToGain } from "./mix";

export const DEFAULT_EFFECTS = {
  bypass: false,
  low: 0, // dB
  mid: 0, // dB
  high: 0, // dB
  drive: 0, // %
  reverb: 0, // % wet
  size: "medium",
  output: 0, // dB
};

// Restrained on purpose: these should flatter a practice take, not disguise it.
export const EFFECT_PRESETS = [
  { id: "clean", label: "Clean", settings: { ...DEFAULT_EFFECTS, high: 1.5, reverb: 12, size: "small" } },
  {
    id: "crunch",
    label: "Crunch",
    settings: { ...DEFAULT_EFFECTS, low: 1, mid: 2, high: -1.5, drive: 35, reverb: 10, size: "small", output: -1 },
  },
  {
    id: "spacious",
    label: "Spacious",
    settings: { ...DEFAULT_EFFECTS, low: -1, high: 2, reverb: 30, size: "large", output: -1 },
  },
];

export const REVERB_SIZES = [
  { id: "small", label: "Room", seconds: 0.8 },
  { id: "medium", label: "Hall", seconds: 1.6 },
  { id: "large", label: "Big hall", seconds: 2.8 },
];

const EQ_BANDS = {
  low: { type: "lowshelf", frequency: 150 },
  mid: { type: "peaking", frequency: 1000, Q: 0.8 },
  high: { type: "highshelf", frequency: 4500 },
};

// Drive multiplies the signal into a tanh curve. The curve is set once (the phone's
// WaveShaper can't change it later) and covers ±DRIVE_RANGE, so even full drive stays
// on the curve's smooth part. No oversampling: it would delay the driven take on Android.
const DRIVE_RANGE = 4;
const MAX_DRIVE_GAIN = 12;
const DRIVE_TONE_HZ = 6500; // takes the fizz (and most aliasing) off the driven signal
const SWAP_SECONDS = 0.3; // how long an outgoing reverb is kept while it fades

function driveCurve(points = 4096) {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) curve[i] = Math.tanh(((i / (points - 1)) * 2 - 1) * DRIVE_RANGE);
  return curve;
}

function driveAmounts(drive) {
  const gain = 1 + (drive / 100) * (MAX_DRIVE_GAIN - 1);
  return {
    on: drive > 0 ? 1 : 0,
    pre: gain / DRIVE_RANGE,
    // Saturation makes the take louder; this keeps its level roughly where it was.
    comp: 1 / Math.sqrt(gain),
  };
}

// Same noise every time for a given size, so the export sounds like what was heard.
function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Decaying stereo noise with a short pre-delay, getting darker as it fades, like a real room.
function impulseResponse(ctx, sizeId) {
  const size = REVERB_SIZES.find((s) => s.id === sizeId) || REVERB_SIZES[1];
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

function reverbLevels(percent) {
  return { dry: 1 - (percent / 100) * 0.3, wet: (percent / 100) * 0.7 };
}

// input -> [bypass] ------------------------------------------------------------> output
//       -> EQ (low shelf, mid peak, high shelf)
//            -> clean ---------------------------------------> drive sum
//            -> drive gain -> tanh -> tone -> level match -----> drive sum
//          drive sum -> dry ------------------------> level -> output
//                    -> convolver -> wet -----------> level
export function createTakeEffects(ctx, initial = DEFAULT_EFFECTS) {
  const gain = (value = 1) => {
    const g = ctx.createGain();
    g.gain.value = value;
    return g;
  };

  const input = gain();
  const output = gain();
  const bypassPath = gain(0);
  const effectPath = gain(1);

  const bands = Object.fromEntries(
    Object.entries(EQ_BANDS).map(([name, spec]) => {
      const f = ctx.createBiquadFilter();
      f.type = spec.type;
      f.frequency.value = spec.frequency;
      if (spec.Q) f.Q.value = spec.Q;
      f.gain.value = 0;
      return [name, f];
    })
  );

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

  // The convolver only exists while reverb is audible: it's the costly part, especially on a phone.
  let reverb = null; // { size, conv, wet }
  let settings = null;

  function set(param, value, immediate) {
    if (immediate) param.value = value;
    else param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
  }

  function retire(old, immediate) {
    if (!old) return;
    set(old.wet.gain, 0, immediate);
    const drop = () => {
      old.conv.disconnect();
      old.wet.disconnect();
    };
    if (immediate) drop();
    else setTimeout(drop, SWAP_SECONDS * 1000);
  }

  function updateReverb(next, immediate) {
    const wanted = !next.bypass && next.reverb > 0;
    if (!wanted) {
      retire(reverb, immediate);
      reverb = null;
      return;
    }
    if (!reverb || reverb.size !== next.size) {
      // A new size gets its own convolver, cross-faded in, rather than swapping the
      // impulse response under a running one.
      retire(reverb, immediate);
      const conv = ctx.createConvolver();
      conv.buffer = impulseResponse(ctx, next.size);
      const wet = gain(0);
      driveSum.connect(conv);
      conv.connect(wet);
      wet.connect(level);
      reverb = { size: next.size, conv, wet };
    }
    set(reverb.wet.gain, reverbLevels(next.reverb).wet, immediate);
  }

  function apply(next, { immediate = false } = {}) {
    const s = { ...DEFAULT_EFFECTS, ...next };
    set(bypassPath.gain, s.bypass ? 1 : 0, immediate);
    set(effectPath.gain, s.bypass ? 0 : 1, immediate);
    for (const band of Object.keys(EQ_BANDS)) set(bands[band].gain, s[band], immediate);
    const d = driveAmounts(s.drive);
    set(drivePre.gain, d.pre, immediate);
    set(driveComp.gain, d.comp, immediate);
    set(driveOn.gain, d.on, immediate);
    set(clean.gain, 1 - d.on, immediate);
    set(dry.gain, reverbLevels(s.reverb).dry, immediate);
    set(level.gain, dbToGain(s.output), immediate);
    updateReverb(s, immediate);
    settings = s;
  }

  apply(initial, { immediate: true });

  return {
    input,
    output,
    apply,
    get settings() {
      return settings;
    },
  };
}
