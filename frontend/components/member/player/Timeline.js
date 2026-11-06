"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawPeaks } from "@/lib/audio/peaks";
import Meter from "./Meter";

const PARTS = ["Vocals", "Guitar", "Keys", "Bass", "Drums"];
const STRIP_H = 18; // the loop strip
const SECTIONS_H = 22;
const TIMES_H = 16;
const RULER_H = STRIP_H + SECTIONS_H + TIMES_H;

export function partColor(part) {
  if (part === "take") return "var(--rw-part-take)";
  return PARTS.includes(part) ? `var(--rw-part-${part.toLowerCase()})` : "var(--rw-part-other)";
}

// What a lane's state says in words, so it never rests on colour alone.
export const STATE_TEXT = { playing: "Playing", solo: "Solo", muted: "Muted", off: "Left out", silent: "Not soloed" };

function clock(s) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

// The song laid out left to right: a strip to drag a loop across, the chart's sections, the
// time, then one lane per part with its waveform, and a playhead through all of it.
// lanes: [{ id, label, color, state, peaks, offset, getMeter }]. The song-position slider lies
// over the sections and time rows, so the keyboard and screen readers can still seek.
export default function Timeline({ duration, chart, lanes, loop, snap, onLoop, getPosition, playing, position, onSeek, disabled, header, footer }) {
  const area = useRef(null);
  const playhead = useRef(null);
  const veil = useRef(null);
  const [draft, setDraft] = useState(null); // [from, to] while dragging a loop
  const span = duration || 1;
  const pct = (t) => `${(Math.min(span, Math.max(0, t)) / span) * 100}%`;

  // The playhead follows the audio clock every frame while playing; otherwise the position.
  useLayoutEffect(() => {
    if (playing) return;
    place(playhead.current, veil.current, position / span);
  }, [playing, position, span]);
  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function step() {
      place(playhead.current, veil.current, getPosition() / span);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, getPosition, span]);

  const timeAt = (clientX) => {
    const box = area.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span;
  };

  // Dragging along the loop strip loops those bars, as in a DAW's cycle bar.
  function startLoopDrag(e) {
    if (disabled || e.button !== 0) return;
    const strip = e.currentTarget;
    strip.setPointerCapture(e.pointerId);
    const from = timeAt(e.clientX);
    setDraft([from, from]);
    const move = (ev) => setDraft([from, timeAt(ev.clientX)]);
    const up = (ev) => {
      strip.removeEventListener("pointermove", move);
      strip.removeEventListener("pointerup", up);
      setDraft(null);
      const to = timeAt(ev.clientX);
      const [a, b] = from < to ? [from, to] : [to, from];
      if (b - a < span / 400) return; // a click, not a drag
      onLoop(snap.start(a), snap.end(b));
    };
    strip.addEventListener("pointermove", move);
    strip.addEventListener("pointerup", up);
  }

  const band = draft ? [Math.min(...draft), Math.max(...draft)] : loop ? [loop.start, loop.end ?? loop.start] : null;
  const sections = chart
    ? chart.sections.map((s, i) => ({ name: s.name, start: s.bars[0].time, end: chart.sections[i + 1]?.bars[0].time ?? chart.end }))
    : [];
  const bars = chart ? chart.sections.flatMap((s) => s.bars.map((b) => b.time)) : [];
  const step = duration > 150 ? 30 : duration > 60 ? 15 : 5;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => i * step);

  return (
    <section aria-label="Song timeline" className="rw-timeline">
      {header}
      <div className="rw-tl-body">
        <div className="rw-tl-heads">
          <div className="rw-tl-corner" style={{ height: RULER_H }}>
            <span style={{ height: STRIP_H, display: "flex", alignItems: "center" }}>Loop</span>
            <span style={{ height: SECTIONS_H, display: "flex", alignItems: "center" }}>{chart ? "Section" : ""}</span>
            <span style={{ height: TIMES_H, display: "flex", alignItems: "center" }}>Time</span>
          </div>
          {lanes.map((lane) => (
            <LaneHead key={lane.id} lane={lane} active={playing} />
          ))}
        </div>

        <div ref={area} className="rw-tl-area">
          <div
            className="rw-tl-strip"
            style={{ height: STRIP_H }}
            onPointerDown={startLoopDrag}
            title="Drag across the bars you want to loop"
            aria-hidden="true"
          >
            {!band && <span className="rw-tl-strip-hint">Drag here to loop bars</span>}
          </div>
          <div style={{ position: "relative", height: SECTIONS_H + TIMES_H }}>
            <div className="rw-tl-sections" style={{ height: SECTIONS_H }}>
              {sections.map((s, i) => (
                <span key={s.start} data-section={s.name} style={{ left: pct(s.start), width: pct(s.end - s.start), background: i % 2 ? "var(--rw-console-raised)" : "var(--rw-console-edge)" }}>
                  {s.name}
                </span>
              ))}
            </div>
            <div className="rw-tl-times" style={{ height: TIMES_H }}>
              {ticks.map((t) => (
                <span key={t} style={{ left: pct(t) }}>
                  {clock(t)}
                </span>
              ))}
            </div>
            <input
              type="range"
              className="rw-scrub"
              min={0}
              max={duration || 0}
              step={0.1}
              value={position}
              onChange={(e) => onSeek(Number(e.target.value))}
              disabled={disabled}
              aria-label="Song position"
              aria-valuetext={`${clock(position)} of ${clock(duration)}`}
            />
          </div>
          {lanes.map((lane) => (
            <LaneBody key={lane.id} lane={lane} span={span} disabled={disabled} onSeek={onSeek} />
          ))}

          {/* Grid lines: sections strong, bars faint. */}
          <div aria-hidden="true" className="rw-tl-grid" style={{ top: STRIP_H }}>
            {bars.map((t) => (
              <span key={t} style={{ left: pct(t) }} />
            ))}
            {sections.map((s) => (
              <span key={`s${s.start}`} data-strong="true" style={{ left: pct(s.start) }} />
            ))}
          </div>
          {band && (
            <div
              aria-hidden="true"
              data-loop-band={draft ? "draft" : loop?.end != null ? "set" : "start"}
              className="rw-tl-loop"
              style={{ left: pct(band[0]), width: band[1] > band[0] ? pct(band[1] - band[0]) : 2 }}
            />
          )}
          <div ref={veil} aria-hidden="true" className="rw-tl-veil" style={{ top: RULER_H }} />
          <div ref={playhead} aria-hidden="true" data-playhead="true" className="rw-tl-playhead" />
        </div>
      </div>
      {footer}
    </section>
  );
}

function place(head, veil, fraction) {
  const f = Math.min(1, Math.max(0, fraction || 0));
  if (head) head.style.transform = `translateX(${f * 100}%)`;
  if (veil) veil.style.transform = `translateX(${f * 100}%)`;
}

const LaneHead = memo(function LaneHead({ lane, active }) {
  const quiet = lane.state !== "playing" && lane.state !== "solo";
  return (
    <div className="rw-tl-head" data-lane-head={lane.id} data-state={lane.state} style={{ "--lane": lane.color }}>
      <span className="rw-tl-swatch" aria-hidden="true" />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="rw-tl-name">{lane.label}</span>
        <span className="rw-tl-state">
          <StateMark state={lane.state} />
          {STATE_TEXT[lane.state]}
        </span>
      </span>
      {lane.getMeter && (
        <span style={{ opacity: quiet ? 0.35 : 1 }}>
          <Meter getNodes={lane.getMeter} active={active} length={26} thickness={4} title={`${lane.label} level`} />
        </span>
      )}
    </div>
  );
});

// A small mark beside the state word: a dot when playing, M for muted, S for solo, a dash when off.
export function StateMark({ state }) {
  const text = { muted: "M", solo: "S", off: "–", silent: "–" }[state];
  return (
    <span aria-hidden="true" className="rw-state-mark" data-state={state}>
      {text ?? ""}
    </span>
  );
}

const LaneBody = memo(function LaneBody({ lane, span, disabled, onSeek }) {
  const canvas = useRef(null);
  const quiet = lane.state !== "playing" && lane.state !== "solo";

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(el.clientWidth * ratio));
      el.height = Math.max(1, Math.round(el.clientHeight * ratio));
      drawPeaks(el, lane.peaks, { color: getComputedStyle(el).color, offset: lane.offset ?? 0, from: 0, span });
    };
    draw();
    const watch = new ResizeObserver(draw);
    watch.observe(el);
    return () => watch.disconnect();
  }, [lane.peaks, lane.offset, span]);

  return (
    <div
      className="rw-tl-lane"
      data-lane={lane.id}
      data-state={lane.state}
      data-drawn={lane.peaks ? "true" : "false"}
      onClick={(e) => {
        if (disabled) return;
        const box = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * span);
      }}
      style={{ "--lane": lane.color, cursor: disabled ? "default" : "pointer" }}
    >
      <canvas ref={canvas} style={{ color: lane.color, opacity: quiet ? 0.28 : 0.92 }} />
      {!lane.peaks && <span className="rw-tl-loading">Drawing waveform…</span>}
    </div>
  );
});
