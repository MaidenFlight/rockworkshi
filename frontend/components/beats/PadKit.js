"use client";

import { GROUPS, LEVEL, piecesIn } from "@/lib/drums/kit";
import { useKeyLabels } from "./keyLabels";
import s from "./beats.module.css";

// The kit as pads, laid out by where each drum sits: cymbals, toms, hi-hat, snare, kick. A pad
// sounds the moment it is pressed (pointerdown, not on release), several at once with several
// fingers. Each pad shows its computer key; Shift plays an accent.
export default function PadKit({ m, playPiece }) {
  const keyLabels = useKeyLabels();
  const recording = m.engineState.recording && m.engineState.status === "running";

  return (
    <div className={s.padsWrap} id="bm-part-panel" role="tabpanel" aria-labelledby={`bm-part-${m.selected.id}`}>
      <div className={s.kit}>
        {GROUPS.map((g) => (
          <div key={g.id} className={s.padGroup} data-group={g.id} role="group" aria-label={g.name}>
            <p className={s.padGroupName} aria-hidden="true">
              {g.name}
            </p>
            <div className={s.padRow}>
              {piecesIn(g.id).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={s.pad}
                  data-flash={p.id}
                  aria-label={p.name}
                  aria-keyshortcuts={keyLabels[p.code]}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    // No focus ring or text selection from a tap; the sound comes now.
                    e.preventDefault();
                    playPiece(p.id, e.shiftKey ? LEVEL.accent : m.tool);
                  }}
                  onClick={(e) => {
                    // Enter or Space on a focused pad, or a screen reader's activation.
                    if (e.detail === 0) playPiece(p.id, m.tool);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className={s.padName}>{p.short}</span>
                  <kbd className={s.key}>{keyLabels[p.code]}</kbd>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className={s.gridHint}>
        {recording
          ? `Recording into ${m.selected.name}: what you play lands on the nearest step.`
          : "Tap the pads, or play them from the keyboard. Press Record to put what you play into the part."}
      </p>
    </div>
  );
}
