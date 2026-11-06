"use client";

import { useRef, useSyncExternalStore } from "react";
import { useVisual, reducedMotionNow, subscribeReducedMotion } from "./visual";
import s from "./metronome.module.css";

const W = 600;
const LEFT = 64;
const RIGHT = 580;
const SPAN = RIGHT - LEFT;
const A_Y = 22;
const B_Y = 62;
const TICK = 22;

// One bar as a shared cycle: the main beats on top, the second layer underneath, both starting
// together on the left edge and meeting again at the right. While a polyrhythm plays, a line
// sweeps across on the audio clock; with reduced motion it doesn't move, and only the notes
// sounding now light up.
export default function CycleView({ beats, notes }) {
  const head = useRef(null);
  const aTicks = useRef([]);
  const bTicks = useRef([]);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);

  useVisual((snap) => {
    const on = Boolean(snap?.running) && !snap.waiting && !snap.countIn && snap.polyNotes === notes;
    if (head.current) {
      const x = LEFT + SPAN * (on ? snap.barPos : 0);
      head.current.setAttribute("x1", x);
      head.current.setAttribute("x2", x);
      head.current.style.opacity = on && !reduced ? "1" : "0";
    }
    aTicks.current.forEach((el, i) => {
      if (!el) return;
      if (on && snap.cell === i) el.setAttribute("data-now", "");
      else el.removeAttribute("data-now");
    });
    bTicks.current.forEach((el, j) => {
      if (!el) return;
      if (on && snap.polyNote === j) el.setAttribute("data-now", "");
      else el.removeAttribute("data-now");
    });
  });

  const a = Array.from({ length: beats }, (_, i) => LEFT + (SPAN * i) / beats);
  const b = Array.from({ length: notes }, (_, j) => LEFT + (SPAN * j) / notes);
  return (
    <figure className={s.cycleView}>
      <svg viewBox={`0 0 ${W} 92`} role="img" aria-label={`One bar: ${beats} main beats on top and ${notes} evenly spaced notes underneath, starting together and meeting again at the next bar.`}>
        <line x1={LEFT} y1={8} x2={LEFT} y2={88} className={s.cycleEdge} />
        <line x1={RIGHT} y1={8} x2={RIGHT} y2={88} className={s.cycleEdge} />
        <line x1={LEFT} y1={A_Y + TICK / 2} x2={RIGHT} y2={A_Y + TICK / 2} className={s.cycleRail} />
        <line x1={LEFT} y1={B_Y + TICK / 2} x2={RIGHT} y2={B_Y + TICK / 2} className={s.cycleRail} />
        <text x={0} y={A_Y + 16} className={s.cycleLabel}>
          Beats
        </text>
        <text x={0} y={B_Y + 16} className={s.cycleLabel}>
          Layer
        </text>
        {a.map((x, i) => (
          <rect
            key={`a${i}`}
            ref={(el) => {
              aTicks.current[i] = el;
            }}
            x={x - 3}
            y={A_Y}
            width={6}
            height={TICK}
            className={s.cycleTickA}
            data-first={i === 0 ? "true" : undefined}
          />
        ))}
        {b.map((x, j) => (
          <rect
            key={`b${j}`}
            ref={(el) => {
              bTicks.current[j] = el;
            }}
            x={x - 3}
            y={B_Y}
            width={6}
            height={TICK}
            className={s.cycleTickB}
            data-first={j === 0 ? "true" : undefined}
          />
        ))}
        <line ref={head} x1={LEFT} y1={8} x2={LEFT} y2={88} className={s.cycleHead} style={{ opacity: 0 }} />
      </svg>
      <figcaption className={s.cycleCaption}>
        Both layers start together on beat 1 and meet again at the next bar line: {notes} against {beats}.
      </figcaption>
    </figure>
  );
}
