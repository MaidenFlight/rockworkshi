// The click sounds, synthesised into sample arrays so no audio files are needed (nothing to
// license, nothing to download). Each voice has four levels: the bar's first beat, a strong
// beat, a normal beat and a subdivision, which differ in pitch as well as loudness so they can
// be told apart without looking. Every sound starts and ends at silence, so a click never pops.

export const VOICES = [
  { id: "wood", name: "Woodblock" },
  { id: "beep", name: "Beep" },
  { id: "clave", name: "Clave" },
  { id: "tick", name: "Soft tick" },
];

export const LEVELS = ["bar", "strong", "normal", "sub"];

// Peak loudness per level, before the voice's own trim.
const LEVEL_PEAK = { bar: 0.9, strong: 0.8, normal: 0.55, sub: 0.38 };

const TAU = 2 * Math.PI;

// A small seeded generator, so the noisy voices sound (and test) the same every time.
function noise(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1;
  };
}

// Damped sine partials: [frequency ratio, amplitude, decay seconds].
function modal(f, partials, t) {
  let y = 0;
  for (const [ratio, amp, decay] of partials) y += amp * Math.sin(TAU * f * ratio * t) * Math.exp(-t / decay);
  return y;
}

const DESIGNS = {
  // Hollow and woody: an inharmonic set of partials over a short knock.
  wood: {
    seconds: 0.12,
    trim: 1,
    pitch: { bar: 1900, strong: 1600, normal: 1200, sub: 1000 },
    sample(f, t, rand) {
      const knock = rand() * Math.exp(-t / 0.0008) * 0.22;
      return modal(f, [[1, 1, 0.028], [2.76, 0.32, 0.012], [5.4, 0.08, 0.005]], t) + knock;
    },
  },
  // A rounded electronic beep, tuned in octaves and fifths (A and E).
  beep: {
    seconds: 0.2,
    trim: 0.8,
    pitch: { bar: 1760, strong: 1318.5, normal: 880, sub: 659.3 },
    sample(f, t) {
      return modal(f, [[1, 1, 0.05], [2, 0.18, 0.03]], t);
    },
  },
  // Bright and short, like two hardwood sticks.
  clave: {
    seconds: 0.1,
    trim: 0.85,
    pitch: { bar: 3000, strong: 2600, normal: 2200, sub: 1850 },
    sample(f, t) {
      return modal(f, [[1, 1, 0.02], [2.8, 0.25, 0.008]], t);
    },
  },
  // A soft, airy tick: noise through a resonant band-pass filter.
  tick: {
    seconds: 0.06,
    trim: 1,
    pitch: { bar: 5200, strong: 4300, normal: 3400, sub: 2700 },
    filtered: true,
  },
};

// Band-passed noise with a fast decay, computed sample by sample (a standard biquad).
function renderFiltered(design, f, sampleRate, length, rand) {
  const out = new Float32Array(length);
  const q = 3;
  const w = (TAU * f) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const x = rand() * Math.exp(-t / 0.01);
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

// One click as samples. `level` is bar, strong, normal or sub.
export function renderVoice(id, level, sampleRate) {
  const design = DESIGNS[id] || DESIGNS.wood;
  const f = design.pitch[level] ?? design.pitch.normal;
  const length = Math.max(1, Math.round(design.seconds * sampleRate));
  const rand = noise(LEVELS.indexOf(level) * 7919 + id.length * 104729 + 1);
  let out;
  if (design.filtered) {
    out = renderFiltered(design, f, sampleRate, length, rand);
  } else {
    out = new Float32Array(length);
    for (let i = 0; i < length; i += 1) out[i] = design.sample(f, i / sampleRate, rand);
  }
  // A half-millisecond fade in and a four-millisecond fade out: no step at either end.
  const fadeIn = Math.max(1, Math.round(0.0005 * sampleRate));
  const fadeOut = Math.max(1, Math.round(0.004 * sampleRate));
  for (let i = 0; i < length; i += 1) {
    if (i < fadeIn) out[i] *= i / fadeIn;
    const fromEnd = length - 1 - i;
    if (fromEnd < fadeOut) out[i] *= fromEnd / fadeOut;
  }
  let peak = 0;
  for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? ((LEVEL_PEAK[level] ?? LEVEL_PEAK.normal) * design.trim) / peak : 0;
  for (let i = 0; i < length; i += 1) out[i] *= gain;
  return out;
}
