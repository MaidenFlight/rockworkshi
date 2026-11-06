"use client";

import { useRef } from "react";
import Icon from "@/components/member/Icon";
import { effective } from "@/lib/metronome/config";
import { cellsOf, countingText } from "@/lib/metronome/rhythm";
import { useVisual } from "./visual";
import s from "./metronome.module.css";

const LEVEL = { strong: "Strong", normal: "Normal", silent: "Silent" };

// The beats of one bar as large cells. Each is a button that steps Strong → Normal → Silent.
// The beat sounding now is lit on the audio clock (see visual.js), never by re-rendering.
export default function BeatCells({ config, onCycle, hintId, size }) {
  const cells = cellsOf(config.meter);
  const subs = effective(config).subdivision;
  const groups = [];
  cells.forEach((c) => (groups[c.groupIndex] ||= []).push(c));
  const grouped = config.meter.pulse === "count" && config.meter.groups.length > 1;
  const showCues = config.training.mode !== "silent" || config.training.silent.showCues;
  const cellEls = useRef([]);

  useVisual((snap) => {
    const running = Boolean(snap?.running) && !snap.waiting;
    const hidden = running && snap.phase === "rest" && !showCues;
    cellEls.current.forEach((el, i) => {
      if (!el) return;
      const on = running && !hidden && snap.cell === i;
      const mode = !on ? null : snap.countIn ? "count" : snap.phase === "rest" ? "rest" : "play";
      if (mode) el.setAttribute("data-now", mode);
      else el.removeAttribute("data-now");
      el.querySelectorAll("[data-dot]").forEach((dot, k) => {
        if (on && !snap.countIn && k <= snap.sub) dot.setAttribute("data-now", "");
        else dot.removeAttribute("data-now");
      });
    });
  });

  return (
    <div className={s.beats} data-size={size}>
      <div
        className={s.cells}
        role="group"
        aria-label={`Beats in each bar: ${cells.length}`}
        aria-describedby={hintId}
        data-grouped={grouped ? "true" : undefined}
      >
        {groups.map((group, g) => (
          <div key={g} className={s.cellGroup} style={{ "--n": group.length }}>
            <div className={s.cellRow}>
            {group.map((c) => {
              const level = config.accents[c.index];
              return (
                <button
                  key={c.index}
                  type="button"
                  ref={(el) => {
                    cellEls.current[c.index] = el;
                  }}
                  className={s.cell}
                  data-level={level}
                  onClick={() => onCycle(c.index)}
                  aria-label={`Beat ${c.index + 1}, ${LEVEL[level]}`}
                >
                  <span className={s.cellNum}>{c.index + 1}</span>
                  <span className={s.cellMeter} aria-hidden="true">
                    <span className={s.cellFill} />
                  </span>
                  <span className={s.cellLevel} aria-hidden="true">
                    {level === "silent" && <Icon name="sound-off" size={13} />}
                    {LEVEL[level]}
                  </span>
                  {subs > 1 && (
                    <span className={s.cellDots} aria-hidden="true">
                      {Array.from({ length: subs }, (_, k) => (
                        <span key={k} data-dot="" />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
            </div>
            {grouped && (
              <span className={s.groupMark} aria-hidden="true">
                {group.length}
              </span>
            )}
          </div>
        ))}
      </div>
      <CountingLine config={config} subs={subs} />
    </div>
  );
}

// "1 e & a 2 e & a": the syllable sounding now is underlined, on the same clock as the cells.
function CountingLine({ config, subs }) {
  const text = countingText(config.meter, subs);
  const root = useRef(null);
  useVisual((snap) => {
    if (!root.current) return;
    const running = Boolean(snap?.running) && !snap.waiting && !snap.countIn;
    const hidden = running && snap.phase === "rest" && config.training.mode === "silent" && !config.training.silent.showCues;
    root.current.querySelectorAll("[data-syl]").forEach((el) => {
      const on = running && !hidden && Number(el.dataset.cell) === snap.cell && Number(el.dataset.sub) === snap.sub;
      if (on) el.setAttribute("data-now", "");
      else el.removeAttribute("data-now");
    });
  });
  if (!text) {
    return (
      <p className={s.counting} data-plain="true">
        Count the beats: {cellsOf(config.meter).map((c) => c.index + 1).join(" ")}
      </p>
    );
  }
  return (
    <p className={s.counting} ref={root}>
      <span className={s.srOnly}>Count: </span>
      {text.map((syllables, cell) => (
        <span key={cell} className={s.countBeat}>
          {syllables.map((syl, sub) => (
            <span key={sub} data-syl="" data-cell={cell} data-sub={sub} data-head={sub === 0 ? "true" : undefined}>
              {syl}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
