"use client";

import { useMemo } from "react";
import { layoutBar, tickX, BAR_W, BAR_H, LINE_Y, COUNT_Y, MARK_Y } from "@/lib/rhythm/notation";
import { countsFor, describeBar } from "@/lib/rhythm/patterns";
import s from "./rhythm.module.css";

// One rhythm, drawn bar by bar on a single-line staff. Ink on paper, because notation reads best
// black on white. A playhead sits over each bar; the trainer moves it from the audio clock.

const INK = "var(--rw-ink)";

// The rests, drawn around (0, 0) on the staff line.
const REST_PATH = {
  quarter: "M-3,-13 L3,-6 L-2,0 L3,6 C-2,3.5 -4.5,8.5 0.5,13",
  eighth: "M-2.5,-5 Q1.2,-2.2 4,-6.5 L-1,10",
  sixteenth: "M-2.5,-5 Q1.2,-2.2 4,-6.5 L-2,15 M-4.4,1.6 Q-0.9,4.6 1.9,0.2",
};

function Rest({ x, kind }) {
  const cx = x + 2;
  if (kind === "half") return <rect x={cx - 6} y={LINE_Y - 5} width={12} height={5} fill={INK} />;
  if (kind === "whole") return <rect x={cx - 6} y={LINE_Y} width={12} height={5} fill={INK} />;
  const blobs = kind === "eighth" ? [[-2.5, -5]] : kind === "sixteenth" ? [[-2.5, -5], [-4.4, 1.6]] : [];
  return (
    <g transform={`translate(${cx} ${LINE_Y})`}>
      <path d={REST_PATH[kind]} fill="none" stroke={INK} strokeWidth={kind === "quarter" ? 2.6 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
      {blobs.map(([bx, by], i) => (
        <circle key={i} cx={bx} cy={by} r={2.5} fill={INK} />
      ))}
    </g>
  );
}

function Flag({ x, y, count }) {
  const one = (dy) => `M${x},${y + dy} C${x + 1},${y + dy + 6} ${x + 10},${y + dy + 9} ${x + 8},${y + dy + 19} C${x + 8.6},${y + dy + 12} ${x + 4},${y + dy + 10} ${x},${y + dy + 9} Z`;
  return <path d={count === 2 ? `${one(0)} ${one(7)}` : one(0)} fill={INK} />;
}

// What a graded note shows above it. State is never colour alone: each result has its own shape.
function Mark({ x, result }) {
  const y = MARK_Y;
  if (result.kind === "on") return <circle cx={x} cy={y} r={4.2} fill="var(--rw-teal)" />;
  if (result.kind === "missed") {
    return <path d={`M${x - 4},${y - 4} L${x + 4},${y + 4} M${x + 4},${y - 4} L${x - 4},${y + 4}`} stroke="var(--rw-orange-deep)" strokeWidth={2.4} />;
  }
  const colour = result.kind === "off" ? "var(--rw-orange-deep)" : "var(--rw-body)";
  const d = result.dir === "early" ? `M${x + 2.5},${y - 5} L${x - 3},${y} L${x + 2.5},${y + 5}` : `M${x - 2.5},${y - 5} L${x + 3},${y} L${x - 2.5},${y + 5}`;
  return <path d={d} fill="none" stroke={colour} strokeWidth={2.6} strokeLinejoin="miter" />;
}

function Bar({ events, marks, counts, hidden, last }) {
  const L = useMemo(() => layoutBar(events), [events]);
  const beatCounts = useMemo(() => countsFor(events).filter((c) => c.beat), [events]);
  const shownCounts = hidden ? beatCounts.map((c) => ({ ...c, onset: false, x: tickX(c.tick) })) : L.counts;

  return (
    <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className={s.barSvg} aria-hidden="true" focusable="false">
      <line x1={4} x2={BAR_W - 4} y1={LINE_Y} y2={LINE_Y} stroke="var(--rw-body)" strokeWidth={1} />
      {last ? (
        <>
          <line x1={BAR_W - 9} x2={BAR_W - 9} y1={LINE_Y - 16} y2={LINE_Y + 16} stroke={INK} strokeWidth={1.2} />
          <line x1={BAR_W - 4} x2={BAR_W - 4} y1={LINE_Y - 16} y2={LINE_Y + 16} stroke={INK} strokeWidth={3.4} />
        </>
      ) : (
        <line x1={BAR_W - 4} x2={BAR_W - 4} y1={LINE_Y - 16} y2={LINE_Y + 16} stroke={INK} strokeWidth={1.4} />
      )}

      {!hidden && (
        <g>
          {L.ties.map((t, i) => {
            const mid = (t.x1 + t.x2) / 2;
            return <path key={`t${i}`} d={`M${t.x1},${t.y} Q${mid},${t.y + 10} ${t.x2},${t.y} Q${mid},${t.y + 7} ${t.x1},${t.y} Z`} fill={INK} />;
          })}
          {L.stems.map((st, i) => (
            <line key={`s${i}`} x1={st.x} x2={st.x} y1={st.y1} y2={st.y2} stroke={INK} strokeWidth={1.5} />
          ))}
          {L.beams.map((b, i) => (
            <rect key={`b${i}`} x={b.x1 - 0.75} y={b.y} width={b.x2 - b.x1 + 1.5} height={5} fill={INK} />
          ))}
          {L.flags.map((f, i) => (
            <Flag key={`f${i}`} {...f} />
          ))}
          {L.heads.map((h, i) =>
            h.hollow ? (
              <ellipse key={`h${i}`} cx={h.x} cy={LINE_Y} rx={5.6} ry={3.8} fill="none" stroke={INK} strokeWidth={1.9} transform={`rotate(-20 ${h.x} ${LINE_Y})`} />
            ) : (
              <ellipse key={`h${i}`} cx={h.x} cy={LINE_Y} rx={6.3} ry={4.5} fill={INK} transform={`rotate(-20 ${h.x} ${LINE_Y})`} />
            ),
          )}
          {L.dots.map((d, i) => (
            <circle key={`d${i}`} cx={d.x} cy={d.y} r={2} fill={INK} />
          ))}
          {L.rests.map((r, i) => (
            <Rest key={`r${i}`} {...r} />
          ))}
          {L.tuplets.map((t, i) => {
            const mid = (t.x1 + t.x2) / 2;
            return (
              <g key={`u${i}`}>
                {t.bracket && <path d={`M${t.x1},${t.y + 4} V${t.y} H${mid - 7} M${mid + 7},${t.y} H${t.x2} V${t.y + 4}`} fill="none" stroke={INK} strokeWidth={1.2} />}
                <text x={mid} y={t.y + 4} textAnchor="middle" className={s.tuplet}>
                  {t.label}
                </text>
              </g>
            );
          })}
          {marks &&
            L.notes
              .filter((n) => n.onset && marks[n.index])
              .map((n) => <Mark key={`m${n.index}`} x={n.x} result={marks[n.index]} />)}
        </g>
      )}

      {counts &&
        shownCounts.map((c) => (
          <text key={`c${c.tick}`} x={c.x} y={COUNT_Y} textAnchor="middle" className={c.beat ? s.countBeat : s.count} data-onset={c.onset ? "true" : undefined}>
            {c.text}
          </text>
        ))}
    </svg>
  );
}

// marks: { [barIndex]: { [eventIndex]: result } }
export default function Notation({ bars, marks, counts = true, hidden = false, cursorRefs, size = "lg", label }) {
  const description = useMemo(() => {
    if (label) return label;
    if (hidden) return `${bars.length} bar${bars.length > 1 ? "s" : ""}, hidden until you've played it back.`;
    return bars.map((b, i) => `Bar ${i + 1}: ${describeBar(b)}.`).join(" ");
  }, [bars, hidden, label]);

  return (
    <div className={s.notation} data-size={size} data-bars={bars.length} role="img" aria-label={description}>
      {bars.map((events, i) => (
        <div key={i} className={s.bar}>
          <Bar events={events} marks={marks?.[i]} counts={counts} hidden={hidden} last={i === bars.length - 1} />
          {cursorRefs && (
            <span
              className={s.cursor}
              aria-hidden="true"
              ref={(el) => {
                cursorRefs.current[i] = el;
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Where the playhead goes for a tick, as a share of the bar's width.
export function cursorPercent(tick) {
  return (tickX(tick) / BAR_W) * 100;
}
