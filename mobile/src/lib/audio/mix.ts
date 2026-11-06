import type { AudioParam, BaseAudioContext, GainNode } from "react-native-audio-api";

// Mixer maths and the master bus. The website has the same logic in
// frontend/lib/audio/mix.js. Keep the two in step.

export type Mode = "full" | "solo" | "minus";
export type StemMix = { volume: number; muted: boolean; soloed: boolean };
export type Mix = { master: number; take: number; takeMuted: boolean; stems: Record<string, StemMix> };

export const MIX_MODES: Mode[] = ["full", "solo", "minus"];

// Time constant for every gain change. A step settles in about 5x this (75 ms),
// fast enough to feel instant and slow enough not to click.
export const SMOOTHING = 0.015;

const CLIP_RANGE = 2; // the clipper's curve covers inputs up to ±2 (+6 dB over full scale)
const CLIP_KNEE = 0.85; // linear below this, then bends smoothly towards ±1
const MAX_HEADROOM = 0.8; // about -2 dB even for songs whose stems sum quietly
const UNMEASURED_HEADROOM = 0.5; // songs without a measured mixLevel

const DEFAULT_STEM: StemMix = { volume: 100, muted: false, soloed: false };

export function defaultMix(parts: string[]): Mix {
  return {
    master: 100,
    take: 100,
    takeMuted: false,
    stems: Object.fromEntries(parts.map((p) => [p, { ...DEFAULT_STEM }])),
  };
}

export function stemOf(mix: Mix, part: string): StemMix {
  return mix.stems[part] ?? DEFAULT_STEM;
}

// A mix from saved settings (a preset or resume state), filling in any part it lacks.
export function mixFromSettings(settings: Partial<Mix>, parts: string[]): Mix {
  const mix = defaultMix(parts);
  for (const part of parts) {
    const saved = settings.stems?.[part];
    if (saved) mix.stems[part] = { ...mix.stems[part], ...saved };
  }
  return { ...mix, master: settings.master ?? 100, take: settings.take ?? 100, takeMuted: Boolean(settings.takeMuted) };
}

// Slider percent to amplitude. Squared, so 50% is about -12 dB, which sounds nearer
// "half as loud" than a linear 0.5 (-6 dB) does.
export function percentToGain(percent: number) {
  const x = Math.max(0, Math.min(100, percent)) / 100;
  return x * x;
}

export function dbToGain(db: number) {
  return 10 ** (db / 20);
}

function modeAllows(mode: Mode, part: string, focus: string) {
  if (mode === "solo") return part === focus;
  if (mode === "minus") return part !== focus;
  return true;
}

// Whether each stem is heard, and at what gain, from its saved volume plus the play mode,
// mute and solo. Any number of stems can be soloed; with none soloed, solo does nothing.
// Volumes are kept as set, so switching modes and back restores the same mix.
// Solo picks among the band only: the take has its own volume and mute.
export function stemLevels(mix: Mix, mode: Mode, focus: string, parts: string[]) {
  const anySolo = parts.some((p) => stemOf(mix, p).soloed);
  return Object.fromEntries(
    parts.map((p) => {
      const s = stemOf(mix, p);
      const audible = modeAllows(mode, p, focus) && !s.muted && (!anySolo || s.soloed);
      return [p, { audible, gain: audible ? percentToGain(s.volume) : 0 }];
    })
  ) as Record<string, { audible: boolean; gain: number }>;
}

export function takeLevel(mix: Mix) {
  return mix.takeMuted ? 0 : percentToGain(mix.take);
}

export function rampTo(ctx: BaseAudioContext, param: AudioParam, value: number) {
  param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
}

// Separate stems are often each mastered loud and can sum far past full scale
// (mixLevel 1.8 means +5 dB over). Turning the bus down by the song's measured level
// puts the band at the clipper's knee, so only a take on top ever reaches the clipper.
export function headroomFor(mixLevel: number | null | undefined) {
  if (!mixLevel || mixLevel <= 0) return UNMEASURED_HEADROOM;
  return Math.min(MAX_HEADROOM, CLIP_KNEE / mixLevel);
}

// Linear up to the knee, then bends towards full scale instead of clipping flat.
// The shaper only sees ±1, so its input is scaled by 1/CLIP_RANGE first.
function softClipCurve(points = 4096) {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = ((i / (points - 1)) * 2 - 1) * CLIP_RANGE;
    const a = Math.abs(x);
    const y = a <= CLIP_KNEE ? a : CLIP_KNEE + (1 - CLIP_KNEE) * Math.tanh((a - CLIP_KNEE) / (1 - CLIP_KNEE));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

// Everything audible connects to `input`:
//   input -> master volume -> headroom -> soft clipper -> speakers
// A static clipper because this library has no compressor node. It also adds no delay,
// so recorded takes stay lined up with what the student heard.
export function createMasterBus(ctx: BaseAudioContext, mixLevel: number | null | undefined) {
  const input: GainNode = ctx.createGain();
  const master: GainNode = ctx.createGain();
  const headroom = ctx.createGain();
  headroom.gain.value = headroomFor(mixLevel) / CLIP_RANGE;
  const clipper = ctx.createWaveShaper();
  clipper.curve = softClipCurve(); // can only be set once here, which is all this needs
  clipper.oversample = "none";

  input.connect(master);
  master.connect(headroom);
  headroom.connect(clipper);
  clipper.connect(ctx.destination);
  return { input, master };
}
