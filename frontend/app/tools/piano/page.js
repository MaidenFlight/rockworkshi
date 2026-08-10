"use client";

import { useEffect, useRef, useState } from "react";

const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 }; // white semitone -> black semitone that follows it
const OCTAVE_SPAN = 2;
const WHITE_H = 160;
const BLACK_H = 100;
// Keys are sized as a share of the container so they shrink to fit a phone.
// The two-octave layout is capped at its original width so the desktop keyboard
// is unchanged; the one-octave layout fills the screen instead, which keeps the
// keys comfortably wide on a phone.
const WHITE_W_MAX = 42;
// Black keys straddle the seam between two whites, at this fraction of a
// white key's width.
const BLACK_W_RATIO = 0.62;

function noteFreqFromMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export default function Piano() {
  const [octave, setOctave] = useState(3);
  const [labels, setLabels] = useState(true);
  const [down, setDown] = useState({});
  const [span, setSpan] = useState(OCTAVE_SPAN);

  // Two octaves squeezed into a phone leaves each key too narrow to hit, so
  // show one there — the octave buttons already move the range. Applied after
  // mount so the server and client agree on the first render.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setSpan(mq.matches ? 1 : OCTAVE_SPAN);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const ctxRef = useRef(null);
  const voicesRef = useRef({});

  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  function pianoVoice(freq) {
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    master.gain.exponentialRampToValueAtTime(0.12, t + 0.4);

    const osc1 = ctx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.18;

    osc1.connect(master);
    osc2.connect(osc2Gain);
    osc2Gain.connect(master);
    osc1.start(t);
    osc2.start(t);

    return { master, oscs: [osc1, osc2] };
  }

  function noteOn(id, midi) {
    if (voicesRef.current[id]) return;
    const voice = pianoVoice(noteFreqFromMidi(midi));
    voicesRef.current[id] = voice;
    setDown((d) => ({ ...d, [id]: true }));
  }

  function noteOff(id) {
    const voice = voicesRef.current[id];
    if (voice) {
      const ctx = ctxRef.current;
      const t = ctx.currentTime;
      voice.master.gain.cancelScheduledValues(t);
      voice.master.gain.setValueAtTime(voice.master.gain.value, t);
      voice.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      voice.oscs.forEach((o) => o.stop(t + 0.32));
      delete voicesRef.current[id];
    }
    setDown((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  const whiteKeys = [];
  for (let o = 0; o < span; o++) {
    for (const s of WHITE_SEMITONES) {
      const midi = (octave + o + 1) * 12 + s;
      whiteKeys.push({ id: `w-${o}-${s}`, midi, semitone: s, label: NOTE_LETTERS[s] + (octave + o) });
    }
  }
  const blackKeys = [];
  whiteKeys.forEach((wk, i) => {
    const blackSemitone = BLACK_AFTER[wk.semitone];
    if (blackSemitone === undefined) return;
    const midi = wk.midi + 1;
    blackKeys.push({ id: `b-${i}`, midi, whiteIndex: i, label: NOTE_LETTERS[blackSemitone % 12] });
  });
  const whitePct = 100 / whiteKeys.length;

  const heldHandlers = (id, midi) => ({
    onMouseDown: () => noteOn(id, midi),
    onMouseUp: () => noteOff(id),
    onMouseLeave: () => noteOff(id),
    onTouchStart: (e) => {
      e.preventDefault();
      noteOn(id, midi);
    },
    onTouchEnd: (e) => {
      e.preventDefault();
      noteOff(id);
    },
  });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "var(--rw-ink)", marginBottom: 8 }}>Piano</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 28 }}>
        {span === 1 ? "One octave" : "Two octaves"}, polyphonic — hold several keys to build a chord.
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setOctave((o) => Math.max(1, o - 1))} style={pillBtn}>
            &#9664; Octave
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--rw-ink)" }}>Octave {octave}</span>
          <button onClick={() => setOctave((o) => Math.min(6, o + 1))} style={pillBtn}>
            Octave &#9654;
          </button>
        </div>
        <button onClick={() => setLabels((l) => !l)} style={pillBtn}>
          {labels ? "Hide labels" : "Show labels"}
        </button>
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: span === 1 ? undefined : whiteKeys.length * WHITE_W_MAX, height: WHITE_H, userSelect: "none", touchAction: "none" }}>
        {whiteKeys.map((wk, i) => (
          <div
            key={wk.id}
            {...heldHandlers(wk.id, wk.midi)}
            style={{
              position: "absolute",
              left: `${i * whitePct}%`,
              top: 0,
              width: `${whitePct}%`,
              boxSizing: "border-box",
              height: WHITE_H,
              background: down[wk.id] ? "var(--rw-orange-tint)" : "#fff",
              border: "1px solid var(--rw-ink)",
              borderRadius: "0 0 6px 6px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 8,
              fontSize: 11,
              color: "var(--rw-meta)",
              cursor: "pointer",
            }}
          >
            {labels && wk.label}
          </div>
        ))}
        {blackKeys.map((bk) => (
          <div
            key={bk.id}
            {...heldHandlers(bk.id, bk.midi)}
            style={{
              position: "absolute",
              left: `${(bk.whiteIndex + 1) * whitePct}%`,
              transform: "translateX(-50%)",
              top: 0,
              width: `${whitePct * BLACK_W_RATIO}%`,
              height: BLACK_H,
              background: down[bk.id] ? "var(--rw-orange)" : "var(--rw-ink)",
              borderRadius: "0 0 4px 4px",
              zIndex: 2,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const pillBtn = {
  padding: "9px 16px",
  borderRadius: 999,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 13,
  color: "var(--rw-ink)",
  cursor: "pointer",
};
