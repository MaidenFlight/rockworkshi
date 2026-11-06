"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assignBassFrets, noteName, pitchClassName } from "@/lib/audio/parts";
import { btn, hint } from "./mixer/styles";
import { useClockCursor } from "./player/clock";

const STEPS = 16;
export const WIDTH = 300;
const LEFT = 18;
const RIGHT = 6;
// Drum notation as on a printed drum sheet: cymbals above the staff with their stems up, the snare
// and kick inside it with their stems down. The staff's lines are 7 apart, top line first.
const STAFF = [52, 59, 66, 73, 80];
const UP_BEAM = 30;
const DOWN_BEAM = 96;
const DRUM_HEADS = {
  crash: { y: 45, up: true },
  hat: { y: 48.5, up: true },
  open: { y: 48.5, up: true },
  snare: { y: 62.5, up: false },
  kick: { y: 76.5, up: false },
};
const NOTES = {
  Bass: "Tab for a four-string bass in standard tuning. An arc between two notes is a hammer-on.",
  Drums: "Cymbals sit above the staff, the snare in the middle and the kick at the bottom.",
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
  if (part === "Drums") {
    // Where a crescendo's hairpin runs in each bar, as fractions of it.
    for (const bar of bars) {
      const length = bar.end - bar.time;
      bar.swells = (chart.parts.Drums.crescendos ?? [])
        .filter((c) => c.time < bar.end && c.end > bar.time)
        .map((c) => [(Math.max(c.time, bar.time) - bar.time) / length, (Math.min(c.end, bar.end) - bar.time) / length]);
    }
  }
  return bars;
}

// Where in a bar a click landed, as a song position. A click from the keyboard has no position,
// so it goes to the start of the bar.
export function clickedTime(event, start, end, left = 0, right = 0) {
  if (!event.detail) return start;
  const box = event.currentTarget.getBoundingClientRect();
  const width = box.width * (1 - (left + right) / WIDTH);
  const fraction = (event.clientX - box.left - box.width * (left / WIDTH)) / width;
  return start + Math.min(1, Math.max(0, fraction)) * (end - start);
}

// Keeps the current bar's row at the top of the chart's own box as the song moves on, like a
// scrolling score. Never scrolls the page.
export function useFollowScroll(boxRef, current) {
  useEffect(() => {
    if (current < 0) return;
    const box = boxRef.current;
    const el = box?.querySelector('[aria-current="true"]');
    if (!el) return;
    const top = el.offsetTop; // the box is positioned, so this is already relative to it
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight * 0.7) {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, top - 36), behavior: still ? "auto" : "smooth" });
    }
  }, [boxRef, current]);
}

// How much of a bar the loop covers, as fractions of its width, or null if none of it.
export function loopBand(loopStart, loopEnd, start, end) {
  if (loopStart === null) return null;
  if (loopEnd === null) return loopStart >= start && loopStart < end ? [(loopStart - start) / (end - start), 0.02] : null;
  const from = Math.max(start, loopStart);
  const to = Math.min(end, loopEnd);
  return to > from ? [(from - start) / (end - start), (to - from) / (end - start)] : null;
}

// Dragging across bars with the mouse loops them, as in Songsterr. A press that doesn't leave
// its bar is an ordinary click. Touch is left alone so the chart still scrolls on a phone.
// Bars carry data-start and data-end; their click handlers call consumeDrag() first.
export function useDragToLoop(onLoopRange) {
  const justDragged = useRef(false);
  const onPointerDown = useCallback(
    (e) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      const anchor = e.target.closest?.("[data-start]");
      if (!anchor) return;
      const box = e.currentTarget;
      let last = anchor;
      const range = () => {
        const a = [anchor, last].map((el) => [Number(el.dataset.start), Number(el.dataset.end)]);
        return [Math.min(a[0][0], a[1][0]), Math.max(a[0][1], a[1][1])];
      };
      const move = (ev) => {
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-start]");
        if (!over || !box.contains(over) || over === last) return;
        last = over;
        const [from, to] = range();
        // Shown straight on the bars: re-rendering the chart on every move isn't needed.
        box.querySelectorAll("[data-start]").forEach((el) => {
          const start = Number(el.dataset.start);
          if (start >= from - 0.001 && start < to - 0.001) el.dataset.selecting = "true";
          else delete el.dataset.selecting;
        });
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        box.querySelectorAll("[data-selecting]").forEach((el) => delete el.dataset.selecting);
        if (last === anchor) return;
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        onLoopRange(...range());
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    },
    [onLoopRange]
  );
  const consumeDrag = useCallback(() => justDragged.current, []);
  return { onPointerDown, consumeDrag };
}

// The bass tab, drum grid or vocal notes. In Guide me a cursor runs through the bars with the song.
export default function PartChart({ chart, part, position, mode, loop = null, disabled, onSeek, onLoopSection }) {
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

  // The note sounding under the cursor, if any.
  let activeItem = null;
  if (bar && part !== "Drums") {
    for (const n of bar.items) if (n.time <= position && position < n.time + n.len) activeItem = n;
  }
  const peeking = peeked !== null && peeked === current;
  const info = chart.parts[part];

  return (
    <div>
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
          {peeking && <Bar bar={bar} part={part} range={range} cursor={position} activeTime={activeItem?.time ?? null} sectionName={section.name} disabled={disabled} onSeek={onSeek} />}
        </div>
      ) : (
        <PartGrid
          chart={chart}
          bars={bars}
          part={part}
          range={range}
          currentBar={following ? current : -1}
          cursor={following ? position : null}
          activeTime={following ? (activeItem?.time ?? null) : null}
          loopStart={loop?.start ?? null}
          loopEnd={loop?.end ?? null}
          disabled={disabled}
          onSeek={onSeek}
          onLoopSection={onLoopSection}
        />
      )}

      {part === "Drums" && <DrumKey />}
      <p style={{ ...hint, marginTop: 10 }}>
        {NOTES[part]} {info.draft ?"This is a draft worked out from the recording by computer, and a teacher hasn't checked it yet, so trust your ears." : ""}
      </p>
    </div>
  );
}

// What each mark on the drum staff means.
function DrumKey() {
  const marks = [
    { id: "hat", text: "Closed hi-hat" },
    { id: "open", text: "Half-open hi-hat" },
    { id: "crash", text: "Crash" },
    { id: "accent", text: "Accent" },
  ];
  return (
    <ul aria-label="Drum key" style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", listStyle: "none", margin: "10px 0 0", padding: 0 }}>
      {marks.map((m) => (
        <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--rw-meta)" }}>
          <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
            {m.id === "accent" ? <path d="M3.5 4.5 L12.5 8 L3.5 11.5" fill="none" stroke="var(--rw-ink)" strokeWidth={1.5} /> : <DrumHead drum={m.id} cx={8} cy={8} />}
          </svg>
          {m.text}
        </li>
      ))}
    </ul>
  );
}

const PartGrid = memo(function PartGrid({ chart, bars, part, range, currentBar, cursor, activeTime, loopStart, loopEnd, disabled, onSeek, onLoopSection }) {
  const boxRef = useRef(null);
  useFollowScroll(boxRef, currentBar);
  const { onPointerDown, consumeDrag } = useDragToLoop(onLoopSection);

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      aria-label={`${part} chart`}
      onPointerDown={disabled ? undefined : onPointerDown}
      style={{ position: "relative", maxHeight: 420, overflowY: "auto", userSelect: "none" }}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 4 }}>
              {bars.map((bar, i) =>
                bar.s === s ? (
                  <Bar
                    key={bar.time}
                    bar={bar}
                    part={part}
                    range={range}
                    current={i === currentBar}
                    cursor={i === currentBar ? cursor : null}
                    activeTime={i === currentBar ? activeTime : null}
                    band={loopBand(loopStart, loopEnd, bar.time, bar.end)?.join(",") ?? null}
                    consumeDrag={consumeDrag}
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

// Only the bar the cursor is in changes as the song moves, so the others stay untouched.
const Bar = memo(function Bar({ bar, part, range, current = false, cursor = null, activeTime, band = null, consumeDrag, sectionName, disabled, onSeek }) {
  const length = bar.end - bar.time;
  const x = (t) => LEFT + ((t - bar.time) / length) * (WIDTH - LEFT - RIGHT);
  const height = part === "Drums" ? 112 : part === "Bass" ? 82 : 84;
  const inside = cursor !== null && cursor >= bar.time && cursor < bar.end;
  const activeStep = inside ? Math.min(STEPS - 1, Math.floor(((cursor - bar.time) / length) * STEPS)) : -1;

  return (
    <button
      onClick={(e) => !consumeDrag?.() && onSeek(clickedTime(e, bar.time, bar.end, LEFT, RIGHT))}
      data-start={bar.time}
      data-end={bar.end}
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
        {part === "Drums" && <DrumBar bar={bar} length={length} activeStep={activeStep} first={bar.b === 0} />}
        {part === "Vocals" && <VocalBar bar={bar} x={x} range={range} activeTime={activeTime} height={height} />}
        {band && (
          // The loop, as on the song position bar.
          <rect
            data-in-loop="true"
            x={x(bar.time) + Number(band.split(",")[0]) * (WIDTH - LEFT - RIGHT)}
            y={0}
            width={Math.max(3, Number(band.split(",")[1]) * (WIDTH - LEFT - RIGHT))}
            height={4}
            fill="var(--rw-teal)"
          />
        )}
        {inside && <SvgCursor at={cursor} start={bar.time} end={bar.end} height={height} />}
      </svg>
    </button>
  );
});

const placeAcross = (el, f) => el.setAttribute("transform", `translate(${(LEFT + f * (WIDTH - LEFT - RIGHT)).toFixed(2)} 0)`);

// The cursor through the current bar, gliding with the audio clock while the song plays.
function SvgCursor({ at, start, end, height }) {
  const ref = useClockCursor(at, start, end, placeAcross);
  return <line ref={ref} data-cursor="true" x1={0} x2={0} y1={2} y2={height - 2} stroke="var(--rw-orange)" strokeWidth={2} />;
}

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
      {bar.items.map((n, i) => {
        const y = lines.find((l) => l.name === n.string).y;
        const active = n.time === activeTime;
        const from = n.hammer ? bar.items[i - 1] : null;
        return (
          <g key={n.time} data-note={noteName(n.midi)} data-place={`${n.string}${n.fret}`} data-current={active ? "true" : undefined} data-hammer={from ? "true" : undefined}>
            {from && (
              // A hammer-on: a slur from the note before, as in written tab.
              <path d={`M ${x(from.time) + 3} ${y - 9} Q ${(x(from.time) + x(n.time)) / 2 + 3} ${y - 17} ${x(n.time) + 3} ${y - 9}`} fill="none" stroke="var(--rw-ink)" strokeWidth={1} />
            )}
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

function DrumBar({ bar, length, activeStep, first }) {
  const at = (s) => LEFT + (s / STEPS) * (WIDTH - LEFT - RIGHT);
  const steps = new Map(); // step → the hits on it
  for (const h of bar.items) {
    const s = Math.min(STEPS - 1, Math.round(((h.time - bar.time) / length) * STEPS));
    if (!steps.has(s)) steps.set(s, []);
    steps.get(s).push(h);
  }
  const accents = [...steps].filter(([, hits]) => hits.some((h) => h.accent)).map(([s]) => s);
  return (
    <>
      {STAFF.map((y) => (
        <line key={y} x1={3} x2={WIDTH - 3} y1={y} y2={y} stroke="var(--rw-line)" strokeWidth={0.8} />
      ))}
      {first && (
        // The percussion clef, at the start of each section.
        <g fill="var(--rw-ink)">
          <rect x={5} y={59} width={2.2} height={14} />
          <rect x={9.5} y={59} width={2.2} height={14} />
        </g>
      )}
      <DrumVoice up steps={steps} at={at} activeStep={activeStep} />
      <DrumVoice up={false} steps={steps} at={at} activeStep={activeStep} />
      {accents.map((s) => (
        <path key={s} data-accent={s} d={`M ${at(s) - 2} 20.5 L ${at(s) + 5} 23.5 L ${at(s) - 2} 26.5`} fill="none" stroke="var(--rw-ink)" strokeWidth={1.3} />
      ))}
      {bar.swells?.map(([from, to]) => {
        const a = LEFT + from * (WIDTH - LEFT - RIGHT);
        const b = LEFT + to * (WIDTH - LEFT - RIGHT) - 4;
        return <path key={from} data-crescendo="true" d={`M ${b} 101 L ${a} 104.5 L ${b} 108`} fill="none" stroke="var(--rw-ink)" strokeWidth={1} />;
      })}
    </>
  );
}

// One voice of a drum bar: the cymbals (up) or the snare and kick (down). Notes are beamed a beat
// at a time, a lone note off the beat gets a flag, and a voice with one note at the very start of
// the bar lets it ring for the whole bar.
function DrumVoice({ up, steps, at, activeStep }) {
  const chords = [...steps]
    .map(([s, hits]) => [s, hits.filter((h) => DRUM_HEADS[h.drum].up === up)])
    .filter(([, hits]) => hits.length)
    .sort((a, b) => a[0] - b[0]);
  if (!chords.length) return null;
  const whole = chords.length === 1 && chords[0][0] === 0;
  const beam = up ? UP_BEAM : DOWN_BEAM;
  const stemX = (s) => at(s) + (up ? 3.5 : -3.9);
  const marks = [];
  for (let beat = 0; beat < 4 && !whole; beat++) {
    const group = chords.filter(([s]) => Math.floor(s / 4) === beat);
    if (!group.length) continue;
    for (const [s, hits] of group) {
      const ys = hits.map((h) => DRUM_HEADS[h.drum].y);
      const from = up ? Math.max(...ys) - 1.5 : Math.min(...ys) + 1.5;
      marks.push(<line key={`stem${s}`} x1={stemX(s)} x2={stemX(s)} y1={from} y2={beam} stroke="var(--rw-ink)" strokeWidth={1.1} />);
    }
    const first = stemX(group[0][0]);
    if (group.length > 1) {
      const last = stemX(group[group.length - 1][0]);
      marks.push(<rect key={`beam${beat}`} x={first - 0.55} width={last - first + 1.1} y={up ? beam : beam - 3.2} height={3.2} fill="var(--rw-ink)" />);
    } else if (group[0][0] % 4) {
      marks.push(<path key={`flag${beat}`} d={up ? `M ${first} ${beam} c 1 4 7 6 6 13` : `M ${first} ${beam} c 1 -4 7 -6 6 -13`} fill="none" stroke="var(--rw-ink)" strokeWidth={1.6} />);
    }
  }
  return (
    <>
      {marks}
      {chords.flatMap(([s, hits]) =>
        hits.map((h) => (
          <g key={`${h.drum}${s}`} data-hit={`${h.drum}:${s}`} data-current={s === activeStep ? "true" : undefined}>
            <DrumHead drum={h.drum} cx={at(s)} cy={DRUM_HEADS[h.drum].y} active={s === activeStep} hollow={whole && !up} />
          </g>
        ))
      )}
    </>
  );
}

function DrumHead({ drum, cx, cy, active = false, hollow = false }) {
  const ink = active ? "var(--rw-orange)" : "var(--rw-ink)";
  const cross = (r) => `M ${cx - r} ${cy - r} L ${cx + r} ${cy + r} M ${cx - r} ${cy + r} L ${cx + r} ${cy - r}`;
  if (drum === "snare" || drum === "kick") {
    return hollow ? (
      <ellipse cx={cx} cy={cy} rx={4.8} ry={3.2} transform={`rotate(-20 ${cx} ${cy})`} fill="none" stroke={ink} strokeWidth={1.6} />
    ) : (
      <ellipse cx={cx} cy={cy} rx={4.3} ry={3.1} transform={`rotate(-20 ${cx} ${cy})`} fill={ink} />
    );
  }
  if (drum === "open") {
    return (
      <g fill="none" stroke={ink} strokeWidth={1.2}>
        <circle cx={cx} cy={cy} r={3.9} />
        <path d={cross(2.6)} />
      </g>
    );
  }
  if (drum === "crash") {
    // On a ledger line above the staff.
    return (
      <g stroke={ink} strokeLinecap="round">
        <line x1={cx - 6.5} x2={cx + 6.5} y1={cy} y2={cy} strokeWidth={1.2} />
        <path d={cross(3.9)} strokeWidth={1.8} />
      </g>
    );
  }
  return <path d={cross(3.2)} stroke={ink} strokeWidth={1.5} strokeLinecap="round" />;
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
