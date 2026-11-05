"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { assignBassFrets, noteName, pitchClassName } from "@/lib/audio/parts";
import { btn, hint } from "./mixer/styles";

const STEPS = 16;
const WIDTH = 300;
const LEFT = 18;
const RIGHT = 6;
const DRUMS = [
  { id: "hat", label: "Hat" },
  { id: "snare", label: "Snare" },
  { id: "kick", label: "Kick" },
];
const NOTES = {
  Bass: "Tab for a four-string bass in standard tuning.",
  Drums: "The main groove and where the hits land. Fills are simplified.",
  Vocals: "A rough guide to the melody, simplified to the notes of the key with slides left out.",
};

// Every bar in order, with what its part plays inside it.
function buildBars(chart, part) {
  const bars = [];
  chart.sections.forEach((section, s) => {
    section.bars.forEach((bar, b) => {
      const end = section.bars[b + 1]?.time ?? chart.sections[s + 1]?.bars[0].time ?? chart.end;
      bars.push({ ...bar, end, s, b, items: [] });
    });
  });
  const items = part === "Bass" ? assignBassFrets(chart.parts.Bass.notes) : part === "Drums" ? chart.parts.Drums.hits : chart.parts.Vocals.notes;
  let k = 0;
  for (const item of items) {
    while (k + 1 < bars.length && item.time >= bars[k + 1].time - 0.001) k++;
    bars[k].items.push(item);
  }
  return bars;
}

// The bass tab, drum grid or vocal notes, following the song by position like the chord chart.
export default function PartChart({ chart, part, position, mode, disabled, onSeek, onLoopSection }) {
  const [peeked, setPeeked] = useState(null); // the bar being peeked at; hides once the song moves on
  const bars = useMemo(() => buildBars(chart, part), [chart, part]);
  const range = useMemo(() => {
    if (part !== "Vocals") return null;
    const pitches = chart.parts.Vocals.notes.map((n) => n.midi);
    return { low: Math.min(...pitches), high: Math.max(...pitches) };
  }, [chart, part]);

  let current = -1;
  for (let i = 0; i < bars.length && bars[i].time <= position; i++) current = i;
  if (position >= chart.end) current = -1;
  const bar = current >= 0 ? bars[current] : null;
  const section = bar ? chart.sections[bar.s] : null;
  const following = mode === "guide";
  const barLength = bar ? bar.end - bar.time : 0;
  const step = bar ? Math.min(STEPS - 1, Math.floor(((position - bar.time) / barLength) * STEPS)) : -1;

  // The note sounding now, and the next one to come, anywhere in the song.
  let activeItem = null;
  let nextItem = null;
  if (part !== "Drums") {
    for (let i = Math.max(current, 0); i < bars.length && !nextItem; i++) {
      for (const n of bars[i].items) {
        if (n.time > position) {
          nextItem = n;
          break;
        }
        if (position < n.time + n.len) activeItem = n;
      }
    }
  }
  const nowHits = part === "Drums" && bar ? bar.items.filter((h) => Math.round(((h.time - bar.time) / barLength) * STEPS) === step).map((h) => h.drum) : [];
  const peeking = peeked !== null && peeked === current;
  const info = chart.parts[part];

  return (
    <div>
      {mode === "guide" && (
        <div data-testid="part-now" style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
          {part === "Drums" ? (
            <div>
              <div style={label}>{bar ? "Hit now" : "Get ready"}</div>
              <div style={{ ...bigNote, fontSize: 30, minHeight: 30 }}>{nowHits.length ? DRUMS.filter((d) => nowHits.includes(d.id)).map((d) => d.label).join(" + ") : "–"}</div>
            </div>
          ) : (
            <>
              <div>
                <div style={label}>{part === "Vocals" ? "Sing now" : "Play now"}</div>
                <div style={bigNote}>{activeItem ? noteName(activeItem.midi) : "–"}</div>
                <div style={{ ...hint, minHeight: 19 }}>{activeItem?.fret !== undefined ? `${activeItem.string} string, fret ${activeItem.fret}` : ""}</div>
              </div>
              <div>
                <div style={label}>Next</div>
                <div style={{ ...bigNote, color: "var(--rw-meta)" }}>{nextItem ? noteName(nextItem.midi) : "–"}</div>
                <div style={{ ...hint, minHeight: 19 }}>{nextItem?.fret !== undefined ? `${nextItem.string} string, fret ${nextItem.fret}` : ""}</div>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "solo" ? (
        <div data-testid="part-solo">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: peeking ? 12 : 0 }}>
            <div style={{ flex: "1 1 180px" }}>
              <div style={label}>{bar ? `${section.name} · bar ${bar.b + 1} of ${section.bars.length}` : "Get ready"}</div>
              {!peeking && <div style={bigNote}>?</div>}
            </div>
            <button onClick={() => setPeeked(current)} disabled={!bar || peeking} style={btn}>
              Peek at this bar
            </button>
          </div>
          {peeking && <Bar bar={bar} part={part} range={range} activeStep={step} activeTime={activeItem?.time ?? null} sectionName={section.name} disabled={disabled} onSeek={onSeek} />}
        </div>
      ) : (
        <PartGrid
          chart={chart}
          bars={bars}
          part={part}
          range={range}
          currentBar={following ? current : -1}
          activeStep={following ? step : -1}
          activeTime={following ? (activeItem?.time ?? null) : null}
          disabled={disabled}
          onSeek={onSeek}
          onLoopSection={onLoopSection}
        />
      )}

      <p style={{ ...hint, marginTop: 10 }}>
        {NOTES[part]} {info.draft ? "This is a draft worked out from the recording by computer, and a teacher hasn't checked it yet, so trust your ears." : ""}
      </p>
    </div>
  );
}

const PartGrid = memo(function PartGrid({ chart, bars, part, range, currentBar, activeStep, activeTime, disabled, onSeek, onLoopSection }) {
  const boxRef = useRef(null);

  // Keeps the current bar in view by scrolling the chart's own box, never the page.
  useEffect(() => {
    if (currentBar < 0) return;
    const box = boxRef.current;
    const el = box?.querySelector('[aria-current="true"]');
    if (!el) return;
    const top = el.offsetTop; // the box is positioned, so this is already relative to it
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - 48);
    }
  }, [currentBar]);

  return (
    <div ref={boxRef} tabIndex={0} aria-label={`${part} chart`} style={{ position: "relative", maxHeight: 420, overflowY: "auto" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 4 }}>
              {bars.map((bar, i) =>
                bar.s === s ? (
                  <Bar
                    key={bar.time}
                    bar={bar}
                    part={part}
                    range={range}
                    current={i === currentBar}
                    activeStep={i === currentBar ? activeStep : -1}
                    activeTime={i === currentBar ? activeTime : null}
                    sectionName={section.name}
                    disabled={disabled}
                    onSeek={onSeek}
                  />
                ) : null
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
});

// Only the bar being played changes as the song moves, so the others stay untouched.
const Bar = memo(function Bar({ bar, part, range, current = false, activeStep, activeTime, sectionName, disabled, onSeek }) {
  const length = bar.end - bar.time;
  const x = (t) => LEFT + ((t - bar.time) / length) * (WIDTH - LEFT - RIGHT);
  const height = part === "Drums" ? 72 : part === "Bass" ? 82 : 84;

  return (
    <button
      onClick={() => onSeek(bar.time)}
      disabled={disabled}
      aria-current={current ? "true" : undefined}
      aria-label={`${sectionName} bar ${bar.b + 1}: ${bar.chords.map((c) => c.name).join(", ")}`}
      style={{
        display: "block",
        width: "100%",
        padding: 0,
        border: "1px solid var(--rw-border)",
        borderRadius: "var(--rw-radius-sm)",
        background: current ? "var(--rw-sand)" : "#fff",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" style={{ display: "block" }} aria-hidden="true">
        {bar.chords.map((c) => (
          <text key={c.time} x={x(c.time)} y={12} fontSize={11} fontWeight={700} fill="var(--rw-meta)">
            {c.name}
          </text>
        ))}
        {part === "Bass" && <BassBar bar={bar} x={x} activeTime={activeTime} />}
        {part === "Drums" && <DrumBar bar={bar} x={x} length={length} activeStep={activeStep} />}
        {part === "Vocals" && <VocalBar bar={bar} x={x} range={range} activeTime={activeTime} height={height} />}
      </svg>
    </button>
  );
});

function BassBar({ bar, x, activeTime }) {
  const lines = [
    { name: "G", y: 26 },
    { name: "D", y: 40 },
    { name: "A", y: 54 },
    { name: "E", y: 68 },
  ];
  return (
    <>
      {lines.map((l) => (
        <g key={l.name}>
          <text x={4} y={l.y + 3} fontSize={9} fill="var(--rw-meta)">
            {l.name}
          </text>
          <line x1={LEFT - 4} x2={WIDTH - RIGHT} y1={l.y} y2={l.y} stroke="var(--rw-border)" />
        </g>
      ))}
      {bar.items.map((n) => {
        const y = lines.find((l) => l.name === n.string).y;
        const active = n.time === activeTime;
        return (
          <g key={n.time} data-note={noteName(n.midi)} data-current={active ? "true" : undefined}>
            <rect x={x(n.time) - 2} y={y - 7} width={String(n.fret).length > 1 ? 16 : 11} height={14} fill={active ? "var(--rw-orange)" : "#fff"} />
            <text x={x(n.time) + 3.5} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={active ? "#fff" : "var(--rw-ink)"}>
              {n.fret}
            </text>
          </g>
        );
      })}
    </>
  );
}

function DrumBar({ bar, x, length, activeStep }) {
  const cell = (WIDTH - LEFT - RIGHT) / STEPS;
  const hits = new Set(bar.items.map((h) => `${h.drum}:${Math.round(((h.time - bar.time) / length) * STEPS)}`));
  return (
    <>
      {DRUMS.map((d, row) => {
        const y = 18 + row * 17;
        return (
          <g key={d.id}>
            <text x={2} y={y + 11} fontSize={8} fill="var(--rw-meta)">
              {d.id === "hat" ? "HH" : d.id === "snare" ? "SD" : "BD"}
            </text>
            {Array.from({ length: STEPS }, (_, s) => {
              const on = hits.has(`${d.id}:${s}`);
              const active = s === activeStep;
              return (
                <rect
                  key={s}
                  data-hit={on ? `${d.id}:${s}` : undefined}
                  data-current={on && active ? "true" : undefined}
                  x={LEFT + s * cell + 1}
                  y={y}
                  width={cell - 2}
                  height={15}
                  fill={on ? (active ? "var(--rw-orange)" : "var(--rw-ink)") : active ? "var(--rw-orange-tint)" : s % 4 === 0 ? "var(--rw-border)" : "var(--rw-cream)"}
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function VocalBar({ bar, x, range, activeTime, height }) {
  const top = 18;
  const bottom = height - 8;
  const span = Math.max(1, range.high - range.low);
  const y = (midi) => bottom - ((midi - range.low) / span) * (bottom - top);
  return bar.items.length ? (
    bar.items.map((n) => {
      const active = n.time === activeTime;
      const width = Math.max(14, x(n.time + n.len) - x(n.time) - 1);
      return (
        <g key={n.time} data-note={noteName(n.midi)} data-current={active ? "true" : undefined}>
          <rect x={x(n.time)} y={y(n.midi) - 6} width={width} height={12} fill={active ? "var(--rw-orange)" : "var(--rw-sand)"} stroke={active ? "none" : "var(--rw-line)"} />
          <text x={x(n.time) + 3} y={y(n.midi) + 3.5} fontSize={9} fontWeight={700} fill={active ? "#fff" : "var(--rw-ink)"}>
            {pitchClassName(n.midi)}
          </text>
        </g>
      );
    })
  ) : (
    <text x={LEFT} y={(top + bottom) / 2 + 3} fontSize={10} fill="var(--rw-meta)">
      Rest
    </text>
  );
}

const label = { fontSize: 12.5, fontWeight: 700, color: "var(--rw-meta)", marginBottom: 2 };
const bigNote = { fontFamily: "var(--rw-font-display)", fontWeight: 800, fontSize: 44, lineHeight: 1, color: "var(--rw-ink)", minWidth: 70 };
