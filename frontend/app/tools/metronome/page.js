"use client";

import { useEffect, useRef, useState } from "react";

const BEAT_OPTIONS = [2, 3, 4, 5, 6];

export default function Metronome() {
  const [bpm, setBpmState] = useState(96);
  const [beats, setBeatsState] = useState(4);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);

  const ctxRef = useRef(null);
  const intervalRef = useRef(null);
  const nextTimeRef = useRef(0);
  const beatCounterRef = useRef(0);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const tapTimesRef = useRef([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);

  useEffect(() => stopMetro, []); // cleanup on unmount

  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  function metroClick(time, accent) {
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1320 : 850;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.42, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.start(time);
    osc.stop(time + 0.07);
  }

  function scheduler() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const beatIdx = beatCounterRef.current % beatsRef.current;
      metroClick(nextTimeRef.current, beatIdx === 0);
      const when = nextTimeRef.current;
      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      setTimeout(() => setBeat(beatIdx), delay);
      nextTimeRef.current += 60 / bpmRef.current;
      beatCounterRef.current += 1;
    }
  }

  function startMetro() {
    const ctx = ensureCtx();
    nextTimeRef.current = ctx.currentTime + 0.06;
    beatCounterRef.current = 0;
    setRunning(true);
    intervalRef.current = setInterval(scheduler, 25);
  }

  function stopMetro() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setBeat(-1);
  }

  function toggleMetro() {
    if (running) stopMetro();
    else startMetro();
  }

  function setBpm(v) {
    setBpmState(Math.max(40, Math.min(240, v)));
  }

  function tap() {
    const now = Date.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 2000);
    taps.push(now);
    tapTimesRef.current = taps;
    if (taps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60000 / avg));
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "var(--rw-ink)", marginBottom: 8 }}>Metronome</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 40 }}>Steady click for practicing at any tempo.</p>

      <div style={{ textAlign: "center", background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 16, padding: 32 }}>
        <div style={{ fontSize: 72, fontWeight: 700, color: "var(--rw-ink)", lineHeight: 1 }}>{bpm}</div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--rw-teal)", marginTop: 6 }}>
          BPM
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 10, margin: "24px 0" }}>
          {Array.from({ length: beats }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: beat === i ? "var(--rw-orange)" : "var(--rw-rule)",
                transition: "background 0.1s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <button onClick={() => setBpm(bpm - 1)} style={nudgeBtnStyle}>
            −
          </button>
          <input
            type="range"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            style={{ width: 200 }}
          />
          <button onClick={() => setBpm(bpm + 1)} style={nudgeBtnStyle}>
            +
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "20px 0" }}>
          {BEAT_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => setBeatsState(b)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: b === beats ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
                background: b === beats ? "var(--rw-orange-tint)" : "#fff",
                color: "var(--rw-ink)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {b}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={tap} style={secondaryBtnStyle}>
            Tap Tempo
          </button>
          <button onClick={toggleMetro} className="rw-cta" style={ctaBtnStyle}>
            {running ? "Stop" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

const nudgeBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontSize: 20,
  cursor: "pointer",
  color: "var(--rw-ink)",
};

const secondaryBtnStyle = {
  flex: 1,
  padding: "13px 20px",
  borderRadius: 999,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 14.5,
  color: "var(--rw-prose)",
  cursor: "pointer",
};

const ctaBtnStyle = {
  flex: 1,
  padding: "13px 20px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
