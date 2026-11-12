// Loops made in the browser for the live room test. A kid tab can send one instead of a
// microphone, so one person testing alone can tell several "kids" apart by ear, and Brian's
// mixer sends the click so the kids have something to keep time to.
//
// Each loop is rendered once into an AudioBuffer and played with loop = true. The audio thread
// keeps it going in a background tab, where the browser slows timers down.

const RATE = 48000;

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// One shaped note: an oscillator, optionally filtered, through a quick rise and a long fall.
function tone(ctx, { type = "sine", freq, at, length, level, lowpass }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  let tail = osc;
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    tail = tail.connect(filter);
  }
  tail.connect(env).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.01);
}

// The same noise on every render (xorshift), so a loop sounds identical each time it's made.
function noise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * RATE), RATE);
  const data = buffer.getChannelData(0);
  let x = 2463534242;
  for (let i = 0; i < data.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    data[i] = ((x >>> 0) / 4294967296) * 2 - 1;
  }
  return buffer;
}

function noiseHit(ctx, buffer, { at, length, level, highpass }) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const env = ctx.createGain();
  env.gain.setValueAtTime(level, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(env).connect(ctx.destination);
  src.start(at, 0, length + 0.01);
}

function kick(ctx, at) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.65, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
  osc.connect(env).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.36);
}

// Draws one loop. Every loop is a whole number of beats and its last sound dies away before the
// end, so the join is clean.
function draw(ctx, kind, beat) {
  if (kind === "melody") {
    // An original pentatonic line in eighth notes, ending on a rest.
    const line = [67, 69, 72, 74, 76, 74, 72, 69, 67, 64, 67, 69, 72, null, 69, null];
    const step = beat / 2;
    line.forEach((midi, i) => {
      if (midi !== null) tone(ctx, { type: "triangle", freq: hz(midi), at: i * step, length: step * 0.9, level: 0.32 });
    });
  } else if (kind === "hum") {
    // A low bass line, two beats a note.
    [48, 45, 41, 43].forEach((midi, i) => {
      tone(ctx, { type: "sawtooth", freq: hz(midi), at: i * 2 * beat, length: 2 * beat * 0.92, level: 0.35, lowpass: 500 });
    });
  } else if (kind === "drums") {
    const hiss = noise(ctx, 0.3);
    for (const b of [0, 2, 2.5, 4, 6, 6.5]) kick(ctx, b * beat);
    for (const b of [1, 3, 5, 7]) {
      noiseHit(ctx, hiss, { at: b * beat, length: 0.16, level: 0.45, highpass: 1200 });
      tone(ctx, { type: "triangle", freq: 185, at: b * beat, length: 0.1, level: 0.25 });
    }
    for (let b = 0; b < 8; b += 0.5) noiseHit(ctx, hiss, { at: b * beat, length: 0.04, level: 0.12, highpass: 7000 });
  } else if (kind === "click") {
    // A count of four: a higher note on one.
    for (let b = 0; b < 4; b++) {
      tone(ctx, { freq: b === 0 ? 1200 : 800, at: b * beat, length: 0.06, level: b === 0 ? 0.55 : 0.4 });
    }
  }
}

export async function renderTestSound(kind, { bpm = 100 } = {}) {
  const beat = 60 / bpm;
  const beats = kind === "click" ? 4 : 8;
  const ctx = new OfflineAudioContext(1, Math.round(beats * beat * RATE), RATE);
  draw(ctx, kind, beat);
  return ctx.startRendering();
}
