"use client";

import { useEffect, useRef, useState } from "react";
import { BASS, GUITAR, noteToMidi, playNote, prepare } from "@/lib/audio/instruments";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const TUNINGS = {
  Guitar: {
    Standard: ["E2", "A2", "D3", "G3", "B3", "E4"],
    "Drop D": ["D2", "A2", "D3", "G3", "B3", "E4"],
    "Half-Step Down": ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
    "Open G": ["D2", "G2", "D3", "G3", "B3", "D4"],
    DADGAD: ["D2", "A2", "D3", "G3", "A3", "D4"],
  },
  Ukulele: {
    "Standard High-G": ["G4", "C4", "E4", "A4"],
    "Low-G": ["G3", "C4", "E4", "A4"],
    Baritone: ["D3", "G3", "B3", "E4"],
  },
  Bass: {
    Standard: ["E1", "A1", "D2", "G2"],
    "Drop D": ["D1", "A1", "D2", "G2"],
    "5-String": ["B0", "E1", "A1", "D2", "G2"],
  },
};

// No free ukulele recording has a clear enough licence, so the ukulele strings play the guitar's.
const REF_SETS = { Guitar: GUITAR, Ukulele: GUITAR, Bass: BASS };

// Pitch detection: McLeod's normalised square difference function (NSDF), computed with an FFT.
// The window is long enough to hold several periods of the lowest string (B0, 30.9 Hz).
const MIN_HZ = 27;
const MAX_HZ = 1400;
const MIN_RMS = 0.01;
const MIN_CLARITY = 0.9;
// The period is the first NSDF peak at least this close to the highest one.
const PEAK_RATIO = 0.93;
// While a note is being followed, a higher reading must be this close to the highest peak: a
// fading low string keeps a trace of its odd harmonics, a new higher note has none. A lower
// reading takes over only once the followed peak drops below FOLLOW_RATIO of the highest.
const SWITCH_RATIO = 0.99;
const FOLLOW_RATIO = 0.8;

const fftTables = new Map();

// In-place radix-2 FFT; re and im have the same power-of-two length.
function fft(re, im) {
  const n = re.length;
  let table = fftTables.get(n);
  if (!table) {
    const bits = Math.log2(n);
    const rev = new Uint32Array(n);
    for (let i = 1; i < n; i++) rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (bits - 1));
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n);
      sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    table = { rev, cos, sin };
    fftTables.set(n, table);
  }
  const { rev, cos, sin } = table;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sin[k * step];
        const a = start + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

let scratch = null;

// The pitch of the audio in buf, in Hz, or 0 when it is too quiet or not clearly one note.
// followHz is the note being followed, or 0. buf's length must be a power of two.
function detectPitch(buf, sampleRate, followHz) {
  const n = buf.length;
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), n >> 1);
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const w = n - maxLag - 1;
  if (!scratch || scratch.x.length !== n) {
    scratch = {
      x: new Float64Array(n),
      y: new Float64Array(n),
      re: new Float64Array(n),
      im: new Float64Array(n),
      nsdf: new Float64Array(n),
    };
  }
  const { x, y, re, im, nsdf } = scratch;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += buf[i];
  mean /= n;
  let energy = 0;
  for (let i = 0; i < n; i++) {
    x[i] = buf[i] - mean;
    energy += x[i] * x[i];
  }
  if (Math.sqrt(energy / n) < MIN_RMS) return 0;
  // A note that has only just started fills the newest part of the window; wait for the rest.
  const q = n >> 2;
  let oldest = 0;
  let newest = 0;
  for (let i = 0; i < q; i++) {
    oldest += x[i] * x[i];
    newest += x[n - q + i] * x[n - q + i];
  }
  if (oldest < 0.1 * newest) return 0;

  // r(lag) = sum of x[j] * x[j + lag] over the first w samples, for every lag at once: one FFT
  // carries both the first w samples (real part) and the whole buffer (imaginary part), their
  // cross-spectrum goes back through a second FFT.
  for (let i = 0; i < n; i++) {
    re[i] = i < w ? x[i] : 0;
    im[i] = x[i];
  }
  fft(re, im);
  for (let k = 0; k <= n / 2; k++) {
    const j = (n - k) & (n - 1);
    const ar = (re[k] + re[j]) / 2;
    const ai = (im[k] - im[j]) / 2;
    const br = (im[k] + im[j]) / 2;
    const bi = (re[j] - re[k]) / 2;
    const cr = ar * br + ai * bi;
    const ci = ar * bi - ai * br;
    re[k] = cr;
    im[k] = -ci;
    re[j] = cr;
    im[j] = ci;
  }
  fft(re, im);

  // NSDF = 2 r(lag) / m(lag), with m(lag) the energy of the two stretches compared.
  let head = 0;
  for (let i = 0; i < w; i++) head += x[i] * x[i];
  let tail = head;
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    nsdf[lag] = head + tail > 0 ? (2 * re[lag]) / n / (head + tail) : 0;
    tail += x[lag + w] * x[lag + w] - x[lag] * x[lag];
  }

  // Each positive lobe after the first zero crossing has one key maximum. The period is the
  // first one nearly as high as the highest, which keeps the reading off the octave above.
  const peaks = [];
  let lag = 1;
  while (lag <= maxLag && nsdf[lag] > 0) lag++;
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag] <= 0) lag++;
    let best = -1;
    while (lag <= maxLag && nsdf[lag] > 0) {
      if (best < 0 || nsdf[lag] > nsdf[best]) best = lag;
      lag++;
    }
    if (best >= minLag && best < maxLag && nsdf[best] >= nsdf[best + 1]) peaks.push(best);
  }
  if (!peaks.length) return 0;
  let highest = 0;
  for (const p of peaks) highest = Math.max(highest, nsdf[p]);
  let pick = peaks.find((p) => nsdf[p] >= PEAK_RATIO * highest);
  if (followHz) {
    const followLag = sampleRate / followHz;
    const held = peaks.find((p) => Math.abs(p - followLag) < followLag * 0.03);
    if (held !== undefined && held !== pick) {
      const keep = pick < held ? nsdf[pick] < SWITCH_RATIO * highest : nsdf[held] >= FOLLOW_RATIO * highest;
      if (keep) pick = held;
    }
  }

  // A parabola through the peak and its neighbours places it between samples.
  const a = nsdf[pick - 1];
  const b = nsdf[pick];
  const c = nsdf[pick + 1];
  const curve = a - 2 * b + c;
  const shift = curve < 0 ? (a - c) / (2 * curve) : 0;
  if (b - ((a - c) * shift) / 4 < MIN_CLARITY) return 0;
  const period = refinePeriod(x, y, pick + shift);
  return period ? sampleRate / period : 0;
}

// A stiff string's upper harmonics run sharp, and they pull a period measured on the whole sound
// sharp with them (by 14 cents on a bass's low E). So the period is measured again with
// everything above the second harmonic filtered out (into y), which reads the fundamental like
// other tuners do. Returns 0 if the low harmonics are too weak to measure.
function refinePeriod(x, y, period) {
  const n = x.length;
  y.set(x);
  // Fourth-order Butterworth low-pass at twice the fundamental, as two biquads.
  const w0 = (4 * Math.PI) / period;
  const cosw = Math.cos(w0);
  for (const q of [0.5412, 1.3066]) {
    const alpha = Math.sin(w0) / (2 * q);
    const b0 = (1 - cosw) / 2 / (1 + alpha);
    const a1 = (-2 * cosw) / (1 + alpha);
    const a2 = (1 - alpha) / (1 + alpha);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < n; i++) {
      const v = y[i];
      const out = b0 * (v + 2 * x1 + x2) - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = v;
      y2 = y1;
      y1 = out;
      y[i] = out;
    }
  }
  // Compare stretches from where the filter has settled, and climb to the top of the peak.
  const start = Math.ceil(1.5 * period);
  const reach = Math.ceil(period * 0.03);
  const w = n - start - Math.round(period) - reach - 2;
  if (w < period) return 0;
  const at = (lag) => {
    let r = 0;
    let m = 0;
    for (let j = start; j < start + w; j++) {
      r += y[j] * y[j + lag];
      m += y[j] * y[j] + y[j + lag] * y[j + lag];
    }
    return m > 0 ? (2 * r) / m : 0;
  };
  let lag = Math.round(period);
  let here = at(lag);
  let left = at(lag - 1);
  let right = at(lag + 1);
  for (let step = 0; step < reach; step++) {
    if (right > here && right >= left) {
      lag++;
      left = here;
      here = right;
      right = at(lag + 1);
    } else if (left > here) {
      lag--;
      right = here;
      here = left;
      left = at(lag - 1);
    } else break;
  }
  if (left > here || right > here || here < MIN_CLARITY) return 0;
  const curve = left - 2 * here + right;
  return lag + (curve < 0 ? (left - right) / (2 * curve) : 0);
}

const READ_EVERY_MS = 25;
const SMOOTHING_MS = 30;
const HOLD_READINGS = 3;

// Reads the latest audio and steadies the result for the display. Small changes are smoothed; a
// different note (or the first after a pause or a new pluck) shows once it has held for a few
// readings, so a one-off misreading never reaches the screen. Returns the note to show as a
// fractional MIDI number, or null to leave the display as it is.
function readPitch(track, buf, sampleRate, now) {
  if (now - track.read < READ_EVERY_MS) return null;
  track.read = now;
  // A new pluck makes the latest audio suddenly louder; it starts a fresh note.
  let recent = 0;
  for (let i = buf.length - (buf.length >> 3); i < buf.length; i++) recent += buf[i] * buf[i];
  if (recent > 4 * track.recent) track.midi = null;
  track.recent = recent;
  const following = track.midi !== null && now - track.at < 400;
  const hz = detectPitch(buf, sampleRate, following ? 440 * 2 ** ((track.midi - 69) / 12) : 0);
  if (!hz) return null;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const dt = now - track.at;
  track.at = now;
  if (following && Math.abs(midi - track.midi) < 0.5) {
    track.hold = 0;
    track.midi += (midi - track.midi) * (1 - Math.exp(-dt / SMOOTHING_MS));
    return track.midi;
  }
  track.hold = track.hold > 0 && Math.abs(midi - track.next) < 0.5 ? track.hold + 1 : 1;
  track.next = midi;
  if (track.hold < HOLD_READINGS) return null;
  track.midi = midi;
  track.hold = 0;
  return midi;
}

function newTrack() {
  return { midi: null, next: 0, hold: 0, at: -Infinity, read: -Infinity, recent: 0 };
}

export default function Tuner() {
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState("");
  const [note, setNote] = useState("—");
  const [octave, setOctave] = useState("");
  const [freq, setFreq] = useState(0);
  const [cents, setCents] = useState(0);
  const [refInstrument, setRefInstrument] = useState("Guitar");
  const [refTuning, setRefTuning] = useState("Standard");
  const [refPlaying, setRefPlaying] = useState(null);

  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const bufRef = useRef(null);
  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const refVoiceRef = useRef(null);

  // Load the chosen tuning's recordings before a string is pressed.
  useEffect(() => {
    prepare(REF_SETS[refInstrument], TUNINGS[refInstrument][refTuning].map(noteToMidi));
  }, [refInstrument, refTuning]);

  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  async function startMic() {
    setMicError("");
    try {
      const ctx = ensureCtx();
      // The browser's voice-call processing (noise suppression, auto gain, echo cancelling)
      // fades a held note and thins out the low strings, so ask for the plain signal.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      // About 0.17 s of audio, which holds several periods of the lowest bass string.
      analyser.fftSize = ctx.sampleRate > 50000 ? 16384 : 8192;
      source.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      trackRef.current = newTrack();
      setMicOn(true);
      const loop = (now) => {
        updatePitch(now);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setMicError("Couldn't access the microphone — you can still use the reference tones below.");
    }
  }

  function stopMic() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMicOn(false);
    setNote("—");
    setOctave("");
    setFreq(0);
    setCents(0);
  }

  function updatePitch(now) {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;
    analyser.getFloatTimeDomainData(bufRef.current);
    const noteNum = readPitch(trackRef.current, bufRef.current, ctx.sampleRate, now);
    if (noteNum !== null) {
      const rounded = Math.round(noteNum);
      setNote(NOTE_NAMES[((rounded % 12) + 12) % 12]);
      setOctave(String(Math.floor(rounded / 12) - 1));
      setFreq(Math.round(440 * 2 ** ((noteNum - 69) / 12) * 10) / 10);
      setCents(Math.round((noteNum - rounded) * 100));
    }
  }

  function playRef(noteName, id) {
    if (refPlaying === id) {
      stopRef();
      return;
    }
    stopRef();
    refVoiceRef.current = playNote(ensureCtx(), REF_SETS[refInstrument], noteToMidi(noteName), {
      onEnd: () => setRefPlaying((p) => (p === id ? null : p)),
    });
    setRefPlaying(id);
  }

  function stopRef() {
    refVoiceRef.current?.stop(0.2);
    refVoiceRef.current = null;
    setRefPlaying(null);
  }

  // Leaving the page stops the mic and anything still ringing (a low bass tone lasts over 20 s).
  useEffect(
    () => () => {
      stopMic();
      ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  function changeInstrument(v) {
    setRefInstrument(v);
    setRefTuning(Object.keys(TUNINGS[v])[0]);
    stopRef();
  }

  const centsClamped = Math.max(-50, Math.min(50, cents));
  const needlePct = 50 + centsClamped;
  const inTune = Math.abs(cents) <= 5;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "var(--rw-ink)", marginBottom: 8 }}>Tuner</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 32 }}>
        Use your microphone to tune by ear, or play a reference tone for any string.
      </p>

      <div style={{ textAlign: "center", background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 16, padding: 32, marginBottom: 32 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: inTune && micOn ? "var(--rw-teal)" : "var(--rw-ink)", lineHeight: 1 }}>
          {note}
          <span style={{ fontSize: 28, color: "var(--rw-meta)" }}>{octave}</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--rw-body)", marginTop: 8 }}>
          {freq ? `${freq} Hz` : "—"} {micOn && freq ? `· ${cents > 0 ? "+" : ""}${cents} cents` : ""}
        </div>

        <div style={{ position: "relative", height: 10, borderRadius: 999, margin: "24px 0", background: "linear-gradient(90deg,var(--rw-orange),#f6e4d5,var(--rw-teal),#f6e4d5,var(--rw-orange))" }}>
          <div
            style={{
              position: "absolute",
              top: -4,
              left: `${needlePct}%`,
              transform: "translateX(-50%)",
              width: 4,
              height: 18,
              borderRadius: 2,
              background: "var(--rw-ink)",
            }}
          />
        </div>

        {micError && <p style={{ color: "var(--rw-orange-deep)", fontSize: 13.5 }}>{micError}</p>}

        <button onClick={micOn ? stopMic : startMic} className="rw-cta" style={ctaBtnStyle}>
          {micOn ? "Stop Microphone" : "Start Microphone"}
        </button>
      </div>

      <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 16, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 14 }}>
          Reference tones
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {Object.keys(TUNINGS).map((inst) => (
            <button
              key={inst}
              onClick={() => changeInstrument(inst)}
              style={pillStyle(inst === refInstrument)}
            >
              {inst}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {Object.keys(TUNINGS[refInstrument]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setRefTuning(t);
                stopRef();
              }}
              style={pillStyle(t === refTuning)}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
          {TUNINGS[refInstrument][refTuning].map((noteName, i) => {
            const id = `${refInstrument}-${refTuning}-${i}`;
            return (
              <button
                key={id}
                onClick={() => playRef(noteName, id)}
                style={{
                  padding: "14px 6px",
                  borderRadius: 10,
                  border: refPlaying === id ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
                  background: refPlaying === id ? "var(--rw-orange-tint)" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "var(--rw-ink)",
                  cursor: "pointer",
                }}
              >
                {noteName}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--rw-meta)", margin: "16px 0 0" }}>
          Recorded guitar (also used for the ukulele strings): University of Iowa Electronic Music Studios. Bass:
          Karoryfer Samples. Both edited by Nicholaus Brosowsky for{" "}
          <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noreferrer">
            tonejs-instruments
          </a>
          ,{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: active ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
    background: active ? "var(--rw-orange-tint)" : "#fff",
    fontWeight: 700,
    fontSize: 13,
    color: "var(--rw-ink)",
    cursor: "pointer",
  };
}

const ctaBtnStyle = {
  marginTop: 20,
  padding: "13px 26px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
