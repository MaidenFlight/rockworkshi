"use client";

import { useRef, useState } from "react";
import { useVisual } from "@/components/metronome/visual";
import { GRID_ORDER, LEVEL_NAMES, PIECE_BY_ID } from "@/lib/drums/kit";
import { meterOf, noteAt, setNote, stepsPerBar } from "@/lib/drums/beat";
import { useKeyLabels } from "./keyLabels";
import s from "./beats.module.css";

const ROWS = GRID_ORDER.map((id) => PIECE_BY_ID[id]);

// What each step is called when counting out loud: 1 e & a in sixteenths, 1 & a in triplets, and
// the six eighths of 6/8.
export function stepLabels(meter) {
  const steps = stepsPerBar(meter);
  if (meter.id === "6/8") return Array.from({ length: steps }, (_, i) => String(i + 1));
  const subs = meter.division === 4 ? ["", "e", "&", "a"] : ["", "&", "a"];
  return Array.from({ length: steps }, (_, i) => {
    const sub = i % meter.division;
    return sub === 0 ? String(i / meter.division + 1) : subs[sub];
  });
}

function stepName(meter, labels, i) {
  if (meter.id === "6/8") return `eighth ${i + 1}`;
  const sub = i % meter.division;
  const beatNo = (i - sub) / meter.division + 1;
  return sub === 0 ? `beat ${beatNo}` : `${beatNo} ${labels[i]}`;
}

// The selected part as a grid: a row per drum, a column per step. Click (or tap) a square to put
// a note in at the chosen strength and again to take it out; with a mouse, drag along a row to
// paint. From the keyboard it is one stop: arrows move, Enter or Space toggles, Delete removes,
// 1 2 3 set ghost, hit or accent.
export default function StepGrid({ m, playPiece }) {
  const { beat, selected, tool } = m;
  const meter = meterOf(beat);
  const steps = stepsPerBar(meter);
  const labels = stepLabels(meter);
  const keyLabels = useKeyLabels();
  const running = m.engineState.status === "running";
  const [focus, setFocus] = useState({ row: GRID_ORDER.indexOf("snare"), col: 0 });
  const focusRow = Math.min(focus.row, ROWS.length - 1);
  const focusCol = Math.min(focus.col, steps - 1);
  const cells = useRef({});
  const heads = useRef([]);
  const band = useRef(null);
  const painted = useRef(false);
  const paintCount = useRef(0);
  const shown = useRef(-1);

  // The playhead: a band over the step sounding now, when it is this part that sounds.
  useVisual((snap) => {
    const el = band.current;
    if (!el) return;
    const step = snap && !snap.countIn && snap.part === selected.id ? snap.step : -1;
    if (step === shown.current) return;
    if (shown.current >= 0) heads.current[shown.current]?.removeAttribute("data-now");
    shown.current = step;
    const head = heads.current[step];
    if (step < 0 || !head) {
      el.hidden = true;
      return;
    }
    head.setAttribute("data-now", "");
    el.style.transform = `translateX(${head.offsetLeft}px)`;
    el.style.width = `${head.offsetWidth}px`;
    el.hidden = false;
  });

  function put(piece, step, level, group) {
    const id = selected.id;
    m.edit((b) => setNote(b, id, piece, step, level), group);
    if (level && !running) playPiece(piece, level);
  }

  function toggle(piece, step) {
    const current = noteAt(selected, piece, step);
    put(piece, step, current === tool ? 0 : tool);
  }

  function moveFocus(row, col) {
    const r = Math.max(0, Math.min(ROWS.length - 1, row));
    const c = Math.max(0, Math.min(steps - 1, col));
    setFocus({ row: r, col: c });
    const el = cells.current[`${r}:${c}`];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }

  function onKeyDown(e, r, c) {
    const piece = ROWS[r].id;
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      moveFocus(r + moves[e.key][0], c + moves[e.key][1]);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(r, 0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(r, steps - 1);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      put(piece, c, 0);
    } else if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault();
      put(piece, c, Number(e.key));
    }
  }

  // A mouse or pen paints along the row it started on: adding where the first square was empty
  // (or held another strength), clearing where it already held this one. One drag, one Undo.
  function onPointerDown(e, r, c) {
    if (e.pointerType === "touch" || e.button !== 0) return;
    e.preventDefault();
    painted.current = true;
    const piece = ROWS[r].id;
    const level = noteAt(selected, piece, c) === tool ? 0 : tool;
    paintCount.current += 1;
    const group = `paint-${paintCount.current}`;
    setFocus({ row: r, col: c });
    put(piece, c, level, group);
    const visited = new Set([c]);
    const move = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-cell]");
      if (!el || el.dataset.piece !== piece) return;
      const step = Number(el.dataset.step);
      if (visited.has(step)) return;
      visited.add(step);
      put(piece, step, level, group);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      m.endGroup();
      // The click that follows a press belongs to the press; let it go by, then listen again.
      setTimeout(() => {
        painted.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <div className={s.gridWrap} id="bm-part-panel" role="tabpanel" aria-labelledby={`bm-part-${selected.id}`}>
      <div className={s.gridScroll}>
        <div
          className={s.grid}
          role="grid"
          aria-label={`${selected.name}: ${ROWS.length} drums by ${steps} steps`}
          aria-rowcount={ROWS.length + 1}
          aria-colcount={steps + 1}
          style={{ "--steps": steps }}
          data-division={meter.division}
        >
          <div role="row" className={s.gridRow} aria-rowindex={1}>
            <div role="columnheader" className={s.corner}>
              {meter.name}
            </div>
            {labels.map((label, i) => (
              <div
                key={i}
                role="columnheader"
                ref={(el) => {
                  heads.current[i] = el;
                }}
                className={s.stepHead}
                data-beat-start={i % meter.division === 0 ? "" : undefined}
                data-band={Math.floor(i / meter.division) % 2 ? "b" : "a"}
                aria-label={stepName(meter, labels, i)}
              >
                {label}
              </div>
            ))}
          </div>
          {ROWS.map((p, r) => (
            <div key={p.id} role="row" className={s.gridRow} aria-rowindex={r + 2}>
              <div role="rowheader" className={s.rowHead}>
                <button type="button" tabIndex={-1} className={s.rowKey} data-flash={p.id} onClick={() => playPiece(p.id, tool)} aria-label={`Play ${p.name}`}>
                  <span className={s.rowName}>{p.short}</span>
                  <kbd className={s.key}>{keyLabels[p.code]}</kbd>
                </button>
              </div>
              {Array.from({ length: steps }, (_, c) => {
                const level = noteAt(selected, p.id, c);
                return (
                  <div
                    key={c}
                    role="gridcell"
                    className={s.cellWrap}
                    data-beat-start={c % meter.division === 0 ? "" : undefined}
                    data-band={Math.floor(c / meter.division) % 2 ? "b" : "a"}
                  >
                    <button
                      type="button"
                      ref={(el) => {
                        cells.current[`${r}:${c}`] = el;
                      }}
                      className={s.cell}
                      data-cell=""
                      data-piece={p.id}
                      data-step={c}
                      data-level={level || undefined}
                      tabIndex={r === focusRow && c === focusCol ? 0 : -1}
                      aria-pressed={level > 0}
                      aria-label={`${p.name}, ${stepName(meter, labels, c)}${level ? `, ${LEVEL_NAMES[level]}` : ""}`}
                      onPointerDown={(e) => onPointerDown(e, r, c)}
                      onClick={() => {
                        if (painted.current) return;
                        setFocus({ row: r, col: c });
                        toggle(p.id, c);
                      }}
                      onKeyDown={(e) => onKeyDown(e, r, c)}
                      onFocus={() => {
                        if (focusRow !== r || focusCol !== c) setFocus({ row: r, col: c });
                      }}
                    >
                      <span className={s.note} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={band} className={s.playhead} hidden aria-hidden="true" />
        </div>
      </div>
      <p className={s.gridHint}>
        <span className={s.hintPointer}>Click a square to add a note, again to take it out; drag along a row to paint.</span>
        <span className={s.hintTouch}>Tap a square to add a note, again to take it out. Swipe sideways for the rest of the bar.</span>{" "}
        <span className={s.hintKeys}>In the grid, arrows move, Enter adds, Delete removes and 1, 2, 3 set ghost, hit or accent.</span>
      </p>
    </div>
  );
}
