// The chord library's sounds, all synthesised so nothing is downloaded: a plucked string for the
// fretted instruments, a soft keyboard tone for piano and voice, and a small drum kit.
// Everything goes through one output, so stopAll() silences whatever is playing.

let ctx = null;
let out = null;
let sources = new Set();
let timers = new Set();

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function track(node, end) {
  sources.add(node);
  node.onended = () => sources.delete(node);
  node.stop(end);
}

// Karplus-Strong: noise circulating in a delay line one period long, averaged on every pass,
// with an allpass filter for the fraction of a sample, so the pitch is right rather than sharp.
const plucks = new Map();
function pluckBuffer(midi) {
  const key = `${ctx.sampleRate}:${midi}`;
  if (plucks.has(key)) return plucks.get(key);
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 2.4);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const period = rate / hz(midi);
  const n = Math.max(2, Math.floor(period - 0.5));
  const frac = period - 0.5 - n;
  const c = (1 - frac) / (1 + frac);
  const line = new Float32Array(n);
  // A softened burst, like a pick a little way from the bridge.
  let smooth = 0;
  for (let i = 0; i < n; i++) {
    smooth = smooth * 0.5 + (Math.random() * 2 - 1) * 0.5;
    line[i] = smooth;
  }
  let idx = 0;
  let prev = 0;
  let apIn = 0;
  let apOut = 0;
  const decay = 0.996;
  for (let i = 0; i < length; i++) {
    const x = line[idx];
    data[i] = x;
    const avg = 0.5 * (x + prev);
    prev = x;
    const y = c * avg + apIn - c * apOut;
    apIn = avg;
    apOut = y;
    line[idx] = y * decay;
    idx = (idx + 1) % n;
  }
  plucks.set(key, buffer);
  return buffer;
}

function pluck(midi, when, level = 0.5, length = 2.2) {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(midi);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, when);
  gain.gain.setTargetAtTime(0, when + length - 0.3, 0.08);
  src.connect(gain).connect(out);
  src.start(when);
  track(src, when + length);
}

function key(midi, when, level = 0.32, length = 1.4) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(level, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(level * 0.35, when + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  gain.connect(out);
  const a = ctx.createOscillator();
  a.type = "triangle";
  a.frequency.value = hz(midi);
  const b = ctx.createOscillator();
  b.type = "sine";
  b.frequency.value = hz(midi) * 2;
  const bGain = ctx.createGain();
  bGain.gain.value = 0.2;
  a.connect(gain);
  b.connect(bGain).connect(gain);
  for (const osc of [a, b]) {
    osc.start(when);
    track(osc, when + length + 0.05);
  }
}

let noise = null;
function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function noiseHit(when, { type = "highpass", freq = 7000, level = 0.3, length = 0.05 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  src.connect(filter).connect(gain).connect(out);
  src.start(when);
  track(src, when + length + 0.02);
}

function tone(when, { from, to, level, length, type = "sine" }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(to, when + length * 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  osc.connect(gain).connect(out);
  osc.start(when);
  track(osc, when + length + 0.02);
}

// One drum hit. accent is louder, a grace note much quieter.
function drum(kind, when, strength = 1) {
  const s = strength;
  switch (kind) {
    case "kick":
      return tone(when, { from: 150, to: 45, level: 0.95 * s, length: 0.38 });
    case "snare":
      tone(when, { from: 200, to: 160, level: 0.35 * s, length: 0.12, type: "triangle" });
      return noiseHit(when, { freq: 1200, level: 0.5 * s, length: 0.2 });
    case "rim":
      tone(when, { from: 1750, to: 1600, level: 0.25 * s, length: 0.04, type: "square" });
      return noiseHit(when, { type: "bandpass", freq: 2600, level: 0.3 * s, length: 0.04 });
    case "hat":
      return noiseHit(when, { freq: 7500, level: 0.22 * s, length: 0.05 });
    case "open":
      return noiseHit(when, { freq: 6500, level: 0.2 * s, length: 0.32 });
    case "crash":
      return noiseHit(when, { freq: 4200, level: 0.3 * s, length: 1.3 });
    case "tom1":
      return tone(when, { from: 260, to: 200, level: 0.6 * s, length: 0.3 });
    case "tom2":
      return tone(when, { from: 190, to: 150, level: 0.6 * s, length: 0.32 });
    case "floor":
      return tone(when, { from: 130, to: 95, level: 0.65 * s, length: 0.4 });
    default:
      return undefined;
  }
}

function later(fn, when) {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, Math.max(0, (when - ctx.currentTime) * 1000));
  timers.add(t);
}

export function stopAll() {
  for (const t of timers) clearTimeout(t);
  timers = new Set();
  for (const loop of loops) loop.stop();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const s of sources) {
    try {
      s.stop(now + 0.01);
    } catch {
      // already stopped
    }
  }
  sources = new Set();
}

// A chord: strummed low to high on a fretted instrument, struck together on keys.
export function playChord(midis, { sound = "pluck", strum = 0.035 } = {}) {
  audio();
  stopAll();
  const start = ctx.currentTime + 0.05;
  const sorted = [...midis].sort((a, b) => a - b);
  sorted.forEach((m, i) => {
    if (sound === "pluck") pluck(m, start + i * strum, 0.42);
    else key(m, start, 0.26, 1.8);
  });
}

// Notes one after another. onNote(index) fires as each sounds; onEnd when it's done.
export function playSequence(midis, { bpm = 100, sound = "keys", onNote, onEnd, together = [] } = {}) {
  audio();
  stopAll();
  const step = 60 / bpm;
  const start = ctx.currentTime + 0.08;
  midis.forEach((m, i) => {
    const when = start + i * step;
    const notes = Array.isArray(m) ? m : [m];
    for (const n of notes) {
      if (sound === "pluck") pluck(n, when, 0.45, Math.min(2.2, step * 2.5));
      else key(n, when, 0.3, Math.max(0.5, step * 1.4));
    }
    if (onNote) later(() => onNote(i), when);
  });
  for (const n of together) key(n, start, 0.12, midis.length * step);
  if (onEnd) later(onEnd, start + midis.length * step);
}

// Chords one after another, each held for a beat count.
export function playProgression(chords, { bpm = 90, beats = 2, onChord, onEnd } = {}) {
  audio();
  stopAll();
  const length = (60 / bpm) * beats;
  const start = ctx.currentTime + 0.08;
  chords.forEach((midis, i) => {
    const when = start + i * length;
    for (const m of midis) key(m, when, 0.2, length * 0.95);
    if (onChord) later(() => onChord(i), when);
  });
  if (onEnd) later(onEnd, start + chords.length * length);
}

// A repeating bar of drum steps, scheduled a little ahead of the audio clock so it stays in time.
// play(step, when) schedules that step's hits; onStep(step) fires as it sounds.
const loops = new Set();
export function startLoop({ steps, stepSeconds, play, onStep }) {
  audio();
  stopAll();
  let step = 0;
  let next = ctx.currentTime + 0.1;
  const loop = {
    tempo: stepSeconds,
    stop() {
      clearInterval(timer);
      loops.delete(loop);
    },
  };
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.12) {
      play(step, next, drum);
      const at = step;
      if (onStep) later(() => onStep(at), next);
      next += loop.tempo;
      step = (step + 1) % steps;
    }
  }, 25);
  loops.add(loop);
  return loop;
}

export function hitDrum(kind, strength = 1) {
  audio();
  drum(kind, ctx.currentTime + 0.02, strength);
}
