"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChordDiagram, KeyboardDiagram } from "@/components/ChordDiagram";
import { songChordShape } from "@/lib/chords";
import PartChart from "./PartChart";
import { btn, chip, eyebrow, hint } from "./mixer/styles";

const MODES = [
  { id: "guide", label: "Guide me", help: "Follows the song and shows what to play now and what's coming next." },
  { id: "chart", label: "Chart only", help: "The whole chart, without following along. You keep your own place." },
  { id: "solo", label: "On my own", help: "Stays hidden so you can play from memory. Peek if you get stuck." },
];
const MODE_KEY = "rw-chord-mode";
const PART_KEY = "rw-chart-part";
const CHORD_PARTS = ["Guitar", "Keys"];
const NOTE_PARTS = ["Bass", "Drums", "Vocals"];

function saved(key, allowed, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function remember(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Only a convenience: it just won't be remembered.
  }
}

function Diagram({ name, keys }) {
  const shape = songChordShape(name, keys);
  if (!shape) return null;
  return keys ? <KeyboardDiagram left={shape.left} right={shape.right} /> : <ChordDiagram frets={shape.frets} base={shape.base} />;
}

// Follows the song by position, so it stays right at any speed and through a loop.
// A chart here has times from the API: see backend/src/lib/chordChart.js.
export default function ChordChart({ chart, position, myPart = null, disabled = false, onSeek, onLoopSection }) {
  const available = useMemo(() => [...CHORD_PARTS, ...NOTE_PARTS.filter((p) => chart.parts?.[p])], [chart]);
  // What was picked last, or else the part this student plays.
  const [part, setPart] = useState(() => saved(PART_KEY, available, available.includes(myPart) ? myPart : "Guitar"));
  const [mode, setMode] = useState(() => saved(MODE_KEY, MODES.map((m) => m.id), "guide"));
  const [peeked, setPeeked] = useState(null); // the chord being peeked at; hides again once the song moves on

  // Every chord in order, with the section and bar it belongs to.
  const flat = useMemo(() => {
    const list = [];
    chart.sections.forEach((section, s) => {
      section.bars.forEach((bar, b) => {
        bar.chords.forEach((chord) => list.push({ ...chord, s, b }));
      });
    });
    return list;
  }, [chart]);
  const names = useMemo(() => [...new Set(flat.map((c) => c.name))], [flat]);

  // The last chord that has started. Called many times a second, and the list is short.
  let current = -1;
  for (let i = 0; i < flat.length && flat[i].time <= position; i++) current = i;
  if (position >= chart.end) current = -1;
  const now = current >= 0 ? flat[current] : null;
  // The next change of chord: a chord repeated over several bars isn't something to get ready for.
  const next = position >= chart.end ? null : flat.slice(current + 1).find((c) => c.name !== now?.name) || null;
  const section = now ? chart.sections[now.s] : chart.sections[0];

  const bar = now ? section.bars[now.b] : null;
  const barEnd = now ? (section.bars[now.b + 1]?.time ?? chart.sections[now.s + 1]?.bars[0].time ?? chart.end) : 0;
  const beat = bar ? Math.min(3, Math.floor(((position - bar.time) / (barEnd - bar.time)) * 4)) : -1;

  function chooseMode(id) {
    setMode(id);
    setPeeked(null);
    remember(MODE_KEY, id);
  }

  function choosePart(id) {
    setPart(id);
    setPeeked(null);
    remember(PART_KEY, id);
  }

  const keys = part === "Keys";

  const peeking = peeked !== null && peeked === current;
  const help = MODES.find((m) => m.id === mode).help;

  return (
    <div>
      <div style={eyebrow}>Play along</div>
      <div role="group" aria-label="Show the part for" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {available.map((p) => (
          <button key={p} onClick={() => choosePart(p)} style={chip(part === p)} aria-pressed={part === p}>
            {p}
          </button>
        ))}
      </div>
      <div role="group" aria-label="How much help" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <button key={m.id} onClick={() => chooseMode(m.id)} style={chip(mode === m.id)} aria-pressed={mode === m.id}>
            {m.label}
          </button>
        ))}
      </div>
      <p style={{ ...hint, margin: "8px 0 14px" }}>{help}</p>

      {NOTE_PARTS.includes(part) && (
        <PartChart chart={chart} part={part} position={position} mode={mode} disabled={disabled} onSeek={onSeek} onLoopSection={onLoopSection} />
      )}

      {!NOTE_PARTS.includes(part) && keys && (
        <p style={{ ...hint, margin: "0 0 12px" }}>
          <span style={{ color: "var(--rw-orange-deep)", fontWeight: 700 }}>Red</span> is your right hand and{" "}
          <span style={{ color: "var(--rw-teal)", fontWeight: 700 }}>green</span> is your left.
        </p>
      )}

      {!NOTE_PARTS.includes(part) && mode === "guide" && (
        <div data-testid="chord-now" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: "1 1 170px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: keys ? "wrap" : "nowrap" }}>
            <div>
              <div style={label}>{now ? "Play now" : "Get ready"}</div>
              <div style={bigChord}>{now ? now.name : "–"}</div>
              <div aria-hidden="true" style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} style={{ width: 12, height: 6, background: i === beat ? "var(--rw-orange)" : "var(--rw-border)" }} />
                ))}
              </div>
            </div>
            {now && <Diagram name={now.name} keys={keys} />}
          </div>
          <div style={{ flex: "1 1 170px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: keys ? "wrap" : "nowrap", opacity: next ? 1 : 0.4 }}>
            <div>
              <div style={label}>Next</div>
              <div style={{ ...bigChord, color: "var(--rw-meta)" }}>{next ? next.name : "–"}</div>
            </div>
            {next && <Diagram name={next.name} keys={keys} />}
          </div>
        </div>
      )}

      {NOTE_PARTS.includes(part) ? null : mode === "solo" ? (
        <div data-testid="chord-solo" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px" }}>
            <div style={label}>{now ? `${section.name} · bar ${now.b + 1} of ${section.bars.length}` : "Get ready"}</div>
            <div style={bigChord}>{peeking ? now.name : "?"}</div>
          </div>
          {peeking && <Diagram name={now.name} keys={keys} />}
          <button onClick={() => setPeeked(current)} disabled={!now || peeking} style={btn}>
            Peek at this chord
          </button>
        </div>
      ) : (
        <ChartGrid
          chart={chart}
          // In Chart only there's no marker, so the grid doesn't follow the song at all.
          currentTime={mode === "guide" && now ? now.time : null}
          disabled={disabled}
          onSeek={onSeek}
          onLoopSection={onLoopSection}
        />
      )}

      {!NOTE_PARTS.includes(part) && mode === "chart" && (
        <div style={{ marginTop: 16 }}>
          <div style={label}>Chords in this song</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {names.map((name) => (
              <div key={name} style={{ textAlign: "center", fontWeight: 700, fontSize: 14, color: "var(--rw-ink)" }}>
                {name}
                <div>
                  <Diagram name={name} keys={keys} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Redrawn only when the current chord changes, not on every playhead tick.
const ChartGrid = memo(function ChartGrid({ chart, currentTime, disabled, onSeek, onLoopSection }) {
  const boxRef = useRef(null);

  // Keeps the current bar in view by scrolling the chart's own box, never the page.
  useEffect(() => {
    if (currentTime === null) return;
    const box = boxRef.current;
    const el = box?.querySelector('[aria-current="true"]');
    if (!el) return;
    const top = el.offsetTop; // the box is positioned, so this is already relative to it
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - 48);
    }
  }, [currentTime]);

  return (
    <div ref={boxRef} tabIndex={0} aria-label="Chord chart" style={{ position: "relative", maxHeight: 340, overflowY: "auto" }}>
      {chart.sections.map((section, s) => {
        const end = chart.sections[s + 1]?.bars[0].time ?? chart.end;
        return (
          <section key={section.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--rw-ink)" }}>{section.name}</span>
              <button
                onClick={() => onLoopSection(section.bars[0].time, end)}
                disabled={disabled}
                aria-label={`Loop ${section.name}`}
                style={{ border: 0, background: "transparent", padding: "2px 4px", fontSize: 12.5, fontWeight: 700, color: "var(--rw-orange-deep)", cursor: "pointer" }}
              >
                Loop
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {section.bars.map((bar, b) => {
                const active = bar.chords.some((c) => c.time === currentTime);
                return (
                  <button
                    key={bar.time}
                    onClick={() => onSeek(bar.time)}
                    disabled={disabled}
                    aria-current={active ? "true" : undefined}
                    aria-label={`${section.name} bar ${b + 1}: ${bar.chords.map((c) => c.name).join(", ")}`}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      minHeight: 40,
                      padding: "6px 4px",
                      border: "1px solid var(--rw-border)",
                      borderRadius: "var(--rw-radius-sm)",
                      background: active ? "var(--rw-sand)" : "#fff",
                      cursor: disabled ? "default" : "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--rw-ink)",
                    }}
                  >
                    {bar.chords.map((c) => (
                      <span
                        key={c.time}
                        data-chord={c.name}
                        data-current={c.time === currentTime ? "true" : undefined}
                        style={c.time === currentTime ? { padding: "1px 6px", background: "var(--rw-orange)", color: "#fff" } : { padding: "1px 6px" }}
                      >
                        {c.name}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
});

const label = { fontSize: 12.5, fontWeight: 700, color: "var(--rw-meta)", marginBottom: 2 };
const bigChord = { fontFamily: "var(--rw-font-display)", fontWeight: 800, fontSize: 44, lineHeight: 1, color: "var(--rw-ink)", minWidth: 70 };
