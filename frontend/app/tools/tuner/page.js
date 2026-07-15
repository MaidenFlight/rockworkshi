"use client";

import { useEffect, useRef, useState } from "react";

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

const PLUCK_PARAMS = {
  Ukulele: { dur: 2.0, damping: 0.993 },
  Bass: { dur: 3.8, damping: 0.9975 },
};
const DEFAULT_PLUCK = { dur: 3.2, damping: 0.996 };

function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!m) return 0;
  const [, letter, accidental, octaveStr] = m;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
  const offset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const octave = parseInt(octaveStr, 10);
  const midi = base + offset + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= threshold) {
      r2 = SIZE - i;
      break;
    }
  }
  const trimmed = buf.slice(r1, r2);
  const n = trimmed.length;

  const c = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;

  let maxpos = d;
  let maxval = -Infinity;
  for (let i = d; i < n; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  const x1 = c[T0 - 1] || 0;
  const x2 = c[T0] || 0;
  const x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 -= b / (2 * a);

  if (T0 <= 0) return -1;
  return sampleRate / T0;
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
  const bufRef = useRef(new Float32Array(2048));
  const rafRef = useRef(null);
  const refSourceRef = useRef(null);
  const refGainRef = useRef(null);

  useEffect(() => stopMic, []);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMicOn(true);
      const loop = () => {
        updatePitch();
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
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

  function updatePitch() {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;
    analyser.getFloatTimeDomainData(bufRef.current);
    const freqHz = autoCorrelate(bufRef.current, ctx.sampleRate);
    if (freqHz > 0) {
      const noteNum = 12 * Math.log2(freqHz / 440) + 69;
      const rounded = Math.round(noteNum);
      setNote(NOTE_NAMES[((rounded % 12) + 12) % 12]);
      setOctave(String(Math.floor(rounded / 12) - 1));
      setFreq(Math.round(freqHz * 10) / 10);
      setCents(Math.round((noteNum - rounded) * 100));
    }
  }

  function makePluck(ctx, freq, dur, damping) {
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    const N = Math.max(2, Math.round(sampleRate / freq));
    const ring = new Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < bufferSize; i++) {
      const next = ring[idx];
      const following = ring[(idx + 1) % N];
      const avg = damping * 0.5 * (next + following);
      ring[idx] = avg;
      data[i] = next;
      idx = (idx + 1) % N;
    }
    const attackSamples = Math.floor(sampleRate * 0.004);
    for (let i = 0; i < attackSamples && i < bufferSize; i++) data[i] *= i / attackSamples;
    const releaseSamples = Math.floor(sampleRate * 0.18);
    for (let i = 0; i < releaseSamples && i < bufferSize; i++) {
      const idxFromEnd = bufferSize - 1 - i;
      if (idxFromEnd >= 0) data[idxFromEnd] *= i / releaseSamples;
    }
    return buffer;
  }

  function playRef(freq, id) {
    if (refPlaying === id) {
      stopRef();
      return;
    }
    stopRef();
    const ctx = ensureCtx();
    const { dur, damping } = PLUCK_PARAMS[refInstrument] || DEFAULT_PLUCK;
    const buffer = makePluck(ctx, freq, dur, damping);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    refSourceRef.current = source;
    refGainRef.current = gain;
    setRefPlaying(id);
    source.onended = () => setRefPlaying((p) => (p === id ? null : p));
  }

  function stopRef() {
    if (refGainRef.current && ctxRef.current) {
      const ctx = ctxRef.current;
      refGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
    if (refSourceRef.current) {
      try {
        refSourceRef.current.stop(ctxRef.current.currentTime + 0.1);
      } catch {}
    }
    refSourceRef.current = null;
    refGainRef.current = null;
    setRefPlaying(null);
  }

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
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "#0a2338", marginBottom: 8 }}>Tuner</h1>
      <p style={{ color: "#6a6560", marginBottom: 32 }}>
        Use your microphone to tune by ear, or play a reference tone for any string.
      </p>

      <div style={{ textAlign: "center", background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 16, padding: 32, marginBottom: 32 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: inTune && micOn ? "#0e8a97" : "#0a2338", lineHeight: 1 }}>
          {note}
          <span style={{ fontSize: 28, color: "#8a7d6a" }}>{octave}</span>
        </div>
        <div style={{ fontSize: 14, color: "#6a6560", marginTop: 8 }}>
          {freq ? `${freq} Hz` : "—"} {micOn && freq ? `· ${cents > 0 ? "+" : ""}${cents} cents` : ""}
        </div>

        <div style={{ position: "relative", height: 10, borderRadius: 999, margin: "24px 0", background: "linear-gradient(90deg,#ef5130,#f6e4d5,#0e8a97,#f6e4d5,#ef5130)" }}>
          <div
            style={{
              position: "absolute",
              top: -4,
              left: `${needlePct}%`,
              transform: "translateX(-50%)",
              width: 4,
              height: 18,
              borderRadius: 2,
              background: "#0a2338",
            }}
          />
        </div>

        {micError && <p style={{ color: "#cf3f20", fontSize: 13.5 }}>{micError}</p>}

        <button onClick={micOn ? stopMic : startMic} className="rw-cta" style={ctaBtnStyle}>
          {micOn ? "Stop Microphone" : "Start Microphone"}
        </button>
      </div>

      <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 16, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 14 }}>
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
                onClick={() => playRef(noteFreq(noteName), id)}
                style={{
                  padding: "14px 6px",
                  borderRadius: 10,
                  border: refPlaying === id ? "1px solid #ef5130" : "1px solid #d8cab8",
                  background: refPlaying === id ? "#fdece6" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#0a2338",
                  cursor: "pointer",
                }}
              >
                {noteName}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: active ? "1px solid #ef5130" : "1px solid #d8cab8",
    background: active ? "#fdece6" : "#fff",
    fontWeight: 700,
    fontSize: 13,
    color: "#0a2338",
    cursor: "pointer",
  };
}

const ctaBtnStyle = {
  marginTop: 20,
  padding: "13px 26px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,#ef5130,#cf3f20)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
