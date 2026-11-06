"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChordDiagram, KeyboardDiagram } from "@/components/ChordDiagram";
import { songChordShape } from "@/lib/chords";
import Icon from "./Icon";
import PartChart, { clickedTime, loopBand, useDragToLoop, useFollowScroll } from "./PartChart";
import { partColor } from "./player/Timeline";
import { useClockCursor } from "./player/clock";
import { btn, chip, eyebrow, hint } from "./mixer/styles";

const MODES = [
  { id: "guide", label: "Guide me", icon: "eye", help: "A cursor follows the song through the chart, and the chord to play now is shown large." },
  { id: "chart", label: "Chart only", icon: "chart", help: "The whole chart, without following along. You keep your own place." },
  { id: "solo", label: "On my own", icon: "eye-off", help: "The chart stays hidden so you play from memory. Peek at a bar if you get stuck." },
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
// coach is a line of advice on what to try next, from the player.
export default function ChordChart({ chart, position, myPart = null, loop = null, disabled = false, onSeek, onLoopSection, coach = null }) {
  // The player hands down new functions on every frame. Steady ones let the bars skip redrawing.
  const handlers = useRef({ onSeek, onLoopSection });
  useEffect(() => {
    handlers.current = { onSeek, onLoopSection };
  });
  const seekTo = useCallback((t) => handlers.current.onSeek(t), []);
  const loopRange = useCallback((start, end) => handlers.current.onLoopSection(start, end), []);

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

  // Where you are, and what's coming, in words.
  const nextSection = now ? chart.sections[now.s + 1] : chart.sections[0];
  const barsLeft = now ? section.bars.length - now.b - 1 : 0;

  return (
    <div className="rw-play-along" data-mode={mode}>
      <div className="rw-pa-head">
        <h2 className="rw-pa-title">Play along</h2>
        <div role="group" aria-label="Show the part for" className="rw-part-tabs">
          {available.map((p) => (
            <button key={p} type="button" onClick={() => choosePart(p)} aria-pressed={part === p} className="rw-part-tab" style={{ "--lane": partColor(p) }}>
              <span aria-hidden="true" className="rw-part-swatch" />
              {p}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="How much help" className="rw-help-modes">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => chooseMode(m.id)} aria-pressed={mode === m.id} className="rw-help-mode">
            <Icon name={m.icon} size={16} />
            {m.label}
          </button>
        ))}
      </div>
      <p className="rw-help-text">{help}</p>
      <div className="rw-now-next" data-now-next="true">
        <span>
          <span className="rw-nn-label">Now</span>
          {now ? `${section.name}, bar ${now.b + 1} of ${section.bars.length}` : position >= chart.end ? "The end" : "Before the first bar"}
        </span>
        <span>
          <span className="rw-nn-label">Next</span>
          {nextSection ? (now ? `${nextSection.name} in ${barsLeft + 1} bar${barsLeft ? "s" : ""}` : nextSection.name) : "The end of the song"}
        </span>
      </div>
      {coach && (
        <p className="rw-coach" role="status">
          {coach}
        </p>
      )}

      {NOTE_PARTS.includes(part) && (
        <PartChart chart={chart} part={part} position={position} mode={mode} loop={loop} disabled={disabled} onSeek={seekTo} onLoopSection={loopRange} />
      )}

      {!NOTE_PARTS.includes(part) && keys && (
        <p style={{ ...hint, margin: "0 0 12px" }}>
          <span style={{ color: "var(--rw-orange-deep)", fontWeight: 700 }}>Red</span> is your right hand and{" "}
          <span style={{ color: "var(--rw-teal)", fontWeight: 700 }}>green</span> is your left.
        </p>
      )}

      {!NOTE_PARTS.includes(part) && mode === "guide" && (
        <div data-testid="chord-now" className="rw-chord-now">
          <div className="rw-chord-card" data-role="now">
            <div>
              <div className="rw-chord-label">{now ? "Play now" : "Get ready"}</div>
              <div className="rw-chord-name">{now ? now.name : "–"}</div>
              <div aria-hidden="true" className="rw-beat-dots">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} data-on={i === beat ? "true" : undefined} />
                ))}
              </div>
            </div>
            {now && (
              <div className="rw-chord-shape">
                <Diagram name={now.name} keys={keys} />
              </div>
            )}
          </div>
          <div className="rw-chord-card" data-role="next" style={{ opacity: next ? undefined : 0.4 }}>
            <div>
              <div className="rw-chord-label">Next</div>
              <div className="rw-chord-name">{next ? next.name : "–"}</div>
            </div>
            {next && (
              <div className="rw-chord-shape">
                <Diagram name={next.name} keys={keys} />
              </div>
            )}
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
          cursor={mode === "guide" ? position : null}
          loopStart={loop?.start ?? null}
          loopEnd={loop?.end ?? null}
          disabled={disabled}
          onSeek={seekTo}
          onLoopSection={loopRange}
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

const ChartGrid = memo(function ChartGrid({ chart, currentTime, cursor, loopStart, loopEnd, disabled, onSeek, onLoopSection }) {
  const boxRef = useRef(null);
  const { onPointerDown, consumeDrag } = useDragToLoop(onLoopSection);
  // Scrolls once per bar, not on every chord change inside one.
  const currentBarTime = useMemo(() => {
    if (currentTime === null) return -1;
    for (const section of chart.sections) for (const bar of section.bars) if (bar.chords.some((c) => c.time === currentTime)) return bar.time;
    return -1;
  }, [chart, currentTime]);
  useFollowScroll(boxRef, currentBarTime);
  const upcomingTime = useMemo(() => {
    if (currentBarTime < 0) return -1;
    const all = chart.sections.flatMap((section) => section.bars.map((bar) => bar.time));
    return all[all.indexOf(currentBarTime) + 1] ?? -1;
  }, [chart, currentBarTime]);

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      aria-label="Chord chart"
      onPointerDown={disabled ? undefined : onPointerDown}
      style={{ position: "relative", maxHeight: 340, overflowY: "auto", userSelect: "none" }}
    >
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
                // 44px to touch, with the margin taking it back so the section rows don't grow.
                style={{ minHeight: 44, minWidth: 44, margin: "-10px 0", border: 0, background: "transparent", padding: "0 6px", fontSize: 12.5, fontWeight: 700, color: "var(--rw-orange-deep)", cursor: "pointer" }}
              >
                Loop
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {section.bars.map((bar, b) => {
                const barEnd = section.bars[b + 1]?.time ?? chart.sections[s + 1]?.bars[0].time ?? chart.end;
                const active = bar.chords.some((c) => c.time === currentTime);
                return (
                  <ChordBar
                    key={bar.time}
                    bar={bar}
                    end={barEnd}
                    label={`${section.name} bar ${b + 1}: ${bar.chords.map((c) => c.name).join(", ")}`}
                    currentTime={active ? currentTime : null}
                    upcoming={bar.time === upcomingTime}
                    cursor={active ? cursor : null}
                    band={loopBand(loopStart, loopEnd, bar.time, barEnd)?.join(",") ?? null}
                    consumeDrag={consumeDrag}
                    disabled={disabled}
                    onSeek={onSeek}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
});

// One bar of the chord chart. Only the bar the cursor is in redraws as the song moves.
// The current bar is outlined in red with its chord filled, the next bar is dashed, the rest recede.
const ChordBar = memo(function ChordBar({ bar, end, label: name, currentTime, upcoming = false, cursor, band, consumeDrag, disabled, onSeek }) {
  const active = currentTime !== null;
  const inside = cursor !== null && cursor >= bar.time && cursor < end;
  return (
    <button
      onClick={(e) => !consumeDrag() && onSeek(clickedTime(e, bar.time, end))}
      data-start={bar.time}
      data-end={end}
      data-upcoming={upcoming ? "true" : undefined}
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      aria-label={name}
      className="rw-chord-bar"
    >
      {bar.chords.map((c) => (
        <span key={c.time} data-chord={c.name} data-current={c.time === currentTime ? "true" : undefined}>
          {c.name}
        </span>
      ))}
      {band && (
        // The loop, as on the song position bar.
        <span
          data-in-loop="true"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            height: 4,
            left: `${Number(band.split(",")[0]) * 100}%`,
            width: `max(3px, ${Number(band.split(",")[1]) * 100}%)`,
            background: "var(--rw-teal)",
          }}
        />
      )}
      {inside && <BarCursor at={cursor} start={bar.time} end={end} />}
    </button>
  );
});

const placeLeft = (el, f) => (el.style.left = `${f * 100}%`);

// The cursor through the current bar, gliding with the audio clock while the song plays.
function BarCursor({ at, start, end }) {
  const ref = useClockCursor(at, start, end, placeLeft);
  return <span ref={ref} data-cursor="true" aria-hidden="true" className="rw-bar-cursor" />;
}

const label = { fontSize: 12.5, fontWeight: 700, color: "var(--rw-meta)", marginBottom: 2 };
const bigChord = { fontFamily: "var(--rw-font-display)", fontWeight: 800, fontSize: 44, lineHeight: 1, color: "var(--rw-ink)", minWidth: 70 };
