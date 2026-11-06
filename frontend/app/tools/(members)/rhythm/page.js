"use client";

import { useEffect, useRef, useState } from "react";

const PATTERNS = {
  "Quarter Notes": ["x", "x", "x", "x"],
  "Eighth Notes": ["x", "x", "x", "x", "x", "x", "x", "x"],
  Mixed: ["x", "-", "x", "x", "-", "x", "-", "x"],
};

export default function RhythmTrainer() {
  const [patternName, setPatternName] = useState("Quarter Notes");
  const [bpm, setBpm] = useState(80);
  const [running, setRunning] = useState(false);
  const [countIn, setCountIn] = useState(-1); // -1 = not counting in
  const [activeCell, setActiveCell] = useState(-1);

  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const cellIndexRef = useRef(0);

  const pattern = PATTERNS[patternName];
  const subdivisionMs = patternName === "Quarter Notes" ? 60000 / bpm : 30000 / bpm;

  useEffect(() => stopRhythm, []);

  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  function click(accent) {
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1320 : 950;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.35, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  function startRhythm() {
    ensureCtx();
    setRunning(true);
    let count = 4;
    setCountIn(count);
    click(true);
    const countInterval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countInterval);
        setCountIn(-1);
        cellIndexRef.current = 0;
        beginLoop();
        return;
      }
      setCountIn(count);
      click(count === 0);
    }, 60000 / bpm);
    timerRef.current = countInterval;
  }

  function beginLoop() {
    timerRef.current = setInterval(() => {
      const idx = cellIndexRef.current % pattern.length;
      setActiveCell(idx);
      if (pattern[idx] === "x") click(idx === 0);
      cellIndexRef.current += 1;
    }, subdivisionMs);
  }

  function stopRhythm() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setCountIn(-1);
    setActiveCell(-1);
  }

  function toggleRhythm() {
    if (running) stopRhythm();
    else startRhythm();
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "60px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "var(--rw-ink)", marginBottom: 8 }}>Rhythm Trainer</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 28 }}>
        Clap or play along. A count-in leads you in, then follow the highlighted beat.
      </p>

      <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.keys(PATTERNS).map((name) => (
            <button
              key={name}
              onClick={() => {
                stopRhythm();
                setPatternName(name);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: name === patternName ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
                background: name === patternName ? "var(--rw-orange-tint)" : "#fff",
                fontWeight: 700,
                fontSize: 13,
                color: "var(--rw-ink)",
                cursor: "pointer",
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {pattern.map((glyph, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                background: activeCell === i ? "var(--rw-orange)" : glyph === "x" ? "#f0e7dc" : "var(--rw-cream)",
                color: activeCell === i ? "#fff" : "var(--rw-prose)",
                border: "1px solid var(--rw-border)",
                transition: "background 0.1s",
              }}
            >
              {glyph}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <button onClick={toggleRhythm} className="rw-cta" style={ctaBtn}>
            {running ? "Stop" : "Start"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, fontWeight: 700, color: "var(--rw-body-cool)" }}>
            Tempo
            <input
              type="range"
              min={50}
              max={140}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              style={{ width: 150 }}
            />
            <span style={{ color: "var(--rw-ink)", minWidth: 64 }}>{bpm} BPM</span>
          </label>
          {countIn >= 0 && (
            <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 700, fontSize: 20, color: "var(--rw-teal)" }}>
              Count-in&hellip; {countIn}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const ctaBtn = {
  padding: "13px 26px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
