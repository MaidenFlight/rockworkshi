// Builds the beat maker's drum sounds (public/samples/drums/*.mp3) from DRSKit, a multi-mic acoustic
// kit recorded by Jes Eiler of DRSDrums with the DrumGizmo team, released under CC BY 4.0
// (drumgizmo.org). See docs/beat-maker.md.
//
//   node scripts/make-drum-kit.mjs <empty folder for the downloads>
//
// Needs ffmpeg (with libmp3lame) on the PATH. It downloads the 241 recordings it uses (26.8 MB of
// FLAC from a pinned commit of the kit's SFZ edition on GitHub: for each hit, the drum's own close
// mics, both overheads and both room mics; nothing else), then for each hit:
//   1. mixes those mics on one mixer for the whole kit (MIC below). The snare's bottom mic and the
//      kick's back mic are polarity-flipped and lined up with their partners (each pair was measured
//      to cancel in the drum's low end otherwise). The overheads are moved earlier to line up with
//      the drum's close mic: left 3 ms late they hollow out the snare's body around 200 Hz. The room
//      mics stay where they fall, 8-11 ms behind; that delay is the room you hear. Close mics are
//      panned from the drummer's seat, the overheads and rooms left and right as recorded,
//   2. cuts it to a set length with a smooth fade,
//   3. evens out the round robins of one layer, then sets each drum's level against the snare
//      (K-weighted loudness, the loudest 400 ms) while its soft and hard layers keep their recorded
//      distance,
//   4. turns the whole kit up or down together so the loudest hit peaks at -1.5 dBFS,
//   5. encodes MP3 (LAME VBR quality 4), and removes any older MP3 in the folder it didn't make.
// Running it again gives the same files.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = "sfzinstruments/DrumGizmo.DRSKit";
const COMMIT = "b01448990a31f722542f1812e56159a97a6a2a82"; // DRSKit 1.0, SFZ edition by kinwie
const SR = 44100;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "public", "samples", "drums");

// The mixer. gain in dB; pan from the drummer's seat, -1 left to 1 right, for the mono close mics;
// side for the overhead and room pairs, which go straight to their own channel; flip the polarity;
// early: moved earlier by this many ms. OHL is 1.8 dB hotter than OHR on centred drums, so it is
// trimmed to match. The rooms are raised for size.
const MIC = {
  Kdrum_front: { gain: 0, pan: 0 },
  Kdrum_back: { gain: 0, pan: 0, flip: true, early: 2.0 },
  Snare_top: { gain: 0, pan: 0 },
  Snare_bottom: { gain: -2, pan: 0, flip: true, early: 0.4 },
  Tom1: { gain: 0, pan: -0.25 },
  Tom2: { gain: 0, pan: 0.35 },
  Tom3: { gain: 0, pan: 0.6 },
  Hihat: { gain: -3, pan: -0.55 },
  Ride: { gain: -4, pan: 0.55 },
  OHL: { gain: -4.8, side: "L" },
  OHR: { gain: -3, side: "R" },
  AmbL: { gain: 4, side: "L" },
  AmbR: { gain: 4, side: "R" },
};
const OVERHEADS = ["OHL", "OHR"];
const ROOMS = ["AmbL", "AmbR"];
const SNARE = ["Snare_top", "Snare_bottom"];

// Shipped name: the kit's instrument, its close mics, layers as [name, hits, instrument if another]
// (the kit's hit numbers rise with velocity: the snare's soft hits come from its 3rd velocity group
// of 8, the main ones from the 6th, the hard ones from the 8th, and so on), length and fade in s,
// level against the snare in dB. A layer keeps its recorded distance from the main one unless `at`
// sets it (dB from the main layer): the snare's soft hits are a soft stroke but only 6.7 dB down as
// recorded, too loud for a ghost note; the closed hat's hard hits are the edge of the hat, 10.7 dB
// up; the toms' hardest hits are only 1.2-1.6 dB up. `boost`: dB more of a close mic for this drum
// only. DRSKit has no rimshot, so the rimshot is the snare's hardest hits with more of the top mic,
// a little louder.
const PIECES = {
  kick: { instr: "Kdrum_with_contact", close: ["Kdrum_front", "Kdrum_back"], layers: [["soft", [8, 10]], ["", [15, 16, 18]], ["hard", [20, 22]]], len: 0.9, fade: 0.35, target: -1 },
  snare: { instr: "Snare", close: SNARE, layers: [["soft", [16, 19]], ["", [31, 33, 35]], ["hard", [44, 47]]], at: { soft: -12 }, len: 0.75, fade: 0.3, target: 0 },
  rimshot: { instr: "Snare", close: SNARE, boost: { Snare_top: 3 }, layers: [["", [43, 48]]], len: 0.9, fade: 0.35, target: 1.5 },
  sidestick: { instr: "Snare_rim", close: SNARE, layers: [["", [7, 8]]], len: 0.3, fade: 0.12, target: -8 },
  "hat-closed": { instr: "Hihat_closed", close: ["Hihat"], layers: [["soft", [4, 6]], ["", [13, 14, 15]], ["hard", [12, 14], "Hihat_closed_shank"]], at: { hard: 5 }, len: 0.45, fade: 0.2, target: -8 },
  "hat-open": { instr: "Hihat_open", close: ["Hihat"], layers: [["", [9, 11]]], len: 2.6, fade: 1.3, target: -4 },
  "hat-pedal": { instr: "Hihat_foot", close: ["Hihat"], layers: [["", [6, 7]]], len: 0.3, fade: 0.12, target: -11 },
  "tom-1": { instr: "Tom1", close: ["Tom1"], layers: [["", [17, 19]], ["hard", [22]]], at: { hard: 3 }, len: 1.8, fade: 0.9, target: -1 },
  "tom-2": { instr: "Tom2", close: ["Tom2"], layers: [["", [13, 15]], ["hard", [17]]], at: { hard: 3 }, len: 2.2, fade: 1.1, target: -1 },
  "floor-tom": { instr: "Tom3", close: ["Tom3"], layers: [["", [13, 15]], ["hard", [17]]], at: { hard: 3 }, len: 2.4, fade: 1.2, target: -1 },
  crash: { instr: "Crash_left_shank", close: [], layers: [["", [7]], ["hard", [10]]], len: 4.2, fade: 2.6, target: -4 },
  ride: { instr: "Ride_tip", close: ["Ride"], layers: [["", [6, 7]], ["hard", [10]]], at: { hard: 4 }, len: 3.2, fade: 2.0, target: -8 },
  "ride-bell": { instr: "Ride_tip_bell", close: ["Ride"], layers: [["", [7, 8]]], len: 3.0, fade: 1.8, target: -8 },
};

const micsOf = (piece) => [...piece.close, ...OVERHEADS, ...ROOMS];
const relPath = (instr, hit, mic) => `Samples/${instr}/${hit}-${instr}-${mic}.flac`;

// ---- 1. Download (only what is missing) ----

async function download(dir) {
  for (const piece of Object.values(PIECES)) {
    for (const [, hits, other] of piece.layers) {
      for (const hit of hits) {
        for (const mic of micsOf(piece)) {
          const rel = relPath(other || piece.instr, hit, mic);
          const dest = path.join(dir, rel);
          if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
          const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${COMMIT}/DrumGizmo/DRSKit/${rel}`);
          if (!res.ok) throw new Error(`${rel}: ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.subarray(0, 4).toString("latin1") !== "fLaC") throw new Error(`${rel} is not a FLAC file`);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, buf);
        }
      }
    }
  }
}

// ---- 2. Audio helpers ----

function decode(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "1", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}

function biquad(type, fc, Q, gainDb) {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * fc) / SR;
  const alpha = Math.sin(w0) / (2 * Q);
  const c = Math.cos(w0);
  let b;
  let a;
  if (type === "shelf") {
    const s = 2 * Math.sqrt(A) * alpha;
    b = [A * (A + 1 + (A - 1) * c + s), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - s)];
    a = [A + 1 - (A - 1) * c + s, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - s];
  } else {
    b = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    a = [1 + alpha, -2 * c, 1 - alpha];
  }
  return { b: b.map((x) => x / a[0]), a: a.map((x) => x / a[0]) };
}

function filter(x, { b, a }) {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

// BS.1770's K-weighting (a 4 dB shelf above 1.5 kHz, a high-pass at 38 Hz), loudest 400 ms, LUFS.
const SHELF = biquad("shelf", 1500, Math.SQRT1_2, 4);
const HP = biquad("hp", 38, 0.5, 0);
function loudness(L, R) {
  const kl = filter(filter(L, SHELF), HP);
  const kr = filter(filter(R, SHELF), HP);
  const win = Math.round(0.4 * SR);
  const hop = Math.round(0.01 * SR);
  let best = 0;
  for (let s = 0; s === 0 || s + win <= kl.length; s += hop) {
    let sum = 0;
    for (let i = s; i < Math.min(kl.length, s + win); i += 1) sum += kl[i] * kl[i] + kr[i] * kr[i];
    best = Math.max(best, sum / win);
  }
  return -0.691 + 10 * Math.log10(best);
}

const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
// The first sample within 24 dB of the signal's own peak.
function onsetOf(x) {
  const t = peakOf(x) * 10 ** (-24 / 20);
  return Math.max(0, x.findIndex((v) => Math.abs(v) >= t));
}

const scale = (h, gain) => {
  for (let i = 0; i < h.L.length; i += 1) {
    h.L[i] *= gain;
    h.R[i] *= gain;
  }
};

function writeWav(file, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write("RIFF", 0, "latin1");
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write("WAVEfmt ", 8, "latin1");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write("data", 36, "latin1");
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i += 1) {
    buf.writeFloatLE(L[i], 44 + i * 8);
    buf.writeFloatLE(R[i], 48 + i * 8);
  }
  fs.writeFileSync(file, buf);
}

// ---- 3. Mix, trim, balance, encode ----

// One hit's mics mixed to stereo.
function mixHit(dir, piece, instr, hit) {
  const sig = {};
  for (const mic of micsOf(piece)) {
    const x = decode(path.join(dir, relPath(instr, hit, mic)));
    const early = Math.round(((MIC[mic].early || 0) / 1000) * SR);
    sig[mic] = early ? x.subarray(early) : x;
  }
  // Overheads lined up with the drum's close mic: both moved by the same amount, so the left/right
  // difference that places the drum stays as recorded.
  const shift = {};
  if (piece.close.length) {
    const lag = Math.min(...OVERHEADS.map((m) => onsetOf(sig[m]))) - onsetOf(sig[piece.close[0]]);
    const ohShift = Math.max(0, Math.min(Math.round(0.006 * SR), lag));
    for (const m of OVERHEADS) shift[m] = ohShift;
  }
  const n = Math.max(...Object.entries(sig).map(([m, x]) => x.length - (shift[m] || 0)));
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (const [mic, x] of Object.entries(sig)) {
    const m = MIC[mic];
    const g = 10 ** ((m.gain + (piece.boost?.[mic] || 0)) / 20) * (m.flip ? -1 : 1);
    const from = shift[mic] || 0;
    let gl;
    let gr;
    if (m.side) [gl, gr] = m.side === "L" ? [g, 0] : [0, g];
    else {
      const a = ((m.pan + 1) * Math.PI) / 4; // equal power, unity in each channel at the centre
      [gl, gr] = [g * Math.SQRT2 * Math.cos(a), g * Math.SQRT2 * Math.sin(a)];
    }
    for (let i = from; i < x.length; i += 1) {
      L[i - from] += gl * x[i];
      R[i - from] += gr * x[i];
    }
  }
  return { L, R, ohShift: shift.OHL || 0 };
}

function render(dir) {
  const hits = [];
  for (const [name, piece] of Object.entries(PIECES)) {
    for (const [layer, list, other] of piece.layers) {
      list.forEach((hit, index) => {
        const { L, R, ohShift } = mixHit(dir, piece, other || piece.instr, hit);
        // Start 1.5 ms before the first sample within 30 dB of the peak; cut and fade.
        const peak = Math.max(peakOf(L), peakOf(R));
        const threshold = peak * 10 ** (-30 / 20);
        let onset = 0;
        while (onset < L.length && Math.abs(L[onset]) < threshold && Math.abs(R[onset]) < threshold) onset += 1;
        const start = Math.max(0, onset - Math.round(0.0015 * SR));
        const len = Math.min(L.length - start, Math.round(piece.len * SR));
        const fade = Math.min(len, Math.round(piece.fade * SR));
        const fadeIn = Math.round(0.0005 * SR);
        const h = { name, layer, hit, rr: index + 1, target: piece.target, ohShift, L: L.slice(start, start + len), R: R.slice(start, start + len) };
        for (let i = 0; i < len; i += 1) {
          let k = i < fadeIn ? i / fadeIn : 1;
          const fromEnd = len - 1 - i;
          if (fromEnd < fade) k *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / fade);
          h.L[i] *= k;
          h.R[i] *= k;
        }
        h.lufs = loudness(h.L, h.R);
        hits.push(h);
      });
    }
  }

  // Round robins of one layer to the layer's mean loudness.
  const layers = new Map();
  for (const h of hits) layers.set(`${h.name}/${h.layer}`, [...(layers.get(`${h.name}/${h.layer}`) || []), h]);
  for (const list of layers.values()) {
    const mean = list.reduce((s, h) => s + h.lufs, 0) / list.length;
    for (const h of list) {
      scale(h, 10 ** ((mean - h.lufs) / 20));
      h.lufs = mean;
    }
  }

  // Layers with a set distance from the main one.
  const main = (name) => hits.find((h) => h.name === name && !h.layer).lufs;
  for (const h of hits) {
    const at = PIECES[h.name].at?.[h.layer];
    if (at === undefined) continue;
    const want = main(h.name) + at;
    scale(h, 10 ** ((want - h.lufs) / 20));
    h.lufs = want;
  }

  // Each drum's main layer to its level against the main snare; its other layers move with it.
  const snare = main("snare");
  const trims = Object.fromEntries(Object.keys(PIECES).map((name) => [name, snare + PIECES[name].target - main(name)]));
  for (const h of hits) scale(h, 10 ** (trims[h.name] / 20));

  // The whole kit together: the loudest hit peaks at -1.5 dBFS.
  let kitPeak = 0;
  for (const h of hits) kitPeak = Math.max(kitPeak, peakOf(h.L), peakOf(h.R));
  const kitGain = 10 ** (-1.5 / 20) / kitPeak;

  fs.mkdirSync(OUT, { recursive: true });
  const made = new Set();
  let total = 0;
  for (const h of hits) {
    scale(h, kitGain);
    const file = [h.name, h.layer, h.rr].filter(Boolean).join("-");
    const wav = path.join(OUT, `${file}.wav`);
    const mp3 = path.join(OUT, `${file}.mp3`);
    writeWav(wav, h.L, h.R);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "4", "-map_metadata", "-1", "-id3v2_version", "0", "-write_xing", "1", mp3]);
    fs.unlinkSync(wav);
    made.add(`${file}.mp3`);
    total += fs.statSync(mp3).size;
    const rel = (h.lufs - main(h.name)).toFixed(1);
    console.log(`${file.padEnd(22)} #${String(h.hit).padStart(2)}  ${(h.L.length / SR).toFixed(2)} s  layer ${rel.padStart(5)} dB  overheads ${((h.ohShift / SR) * 1000).toFixed(1)} ms earlier`);
  }
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".mp3") && !made.has(f)) fs.unlinkSync(path.join(OUT, f));
  console.log(`${hits.length} files, ${(total / 1024).toFixed(0)} KiB in ${path.relative(process.cwd(), OUT)}`);
}

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/make-drum-kit.mjs <folder for the downloads>");
  process.exit(1);
}
await download(dir);
render(dir);
