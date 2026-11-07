"use client";

import { useState } from "react";
import { GRID_ORDER } from "@/lib/drums/kit";
import { MAX_PARTS, METERS, addPart, replaceNotes, setMeter, setSwing, setTempo, stepsPerBar } from "@/lib/drums/beat";
import { GROOVES, STYLES, grooveNotes } from "@/lib/drums/grooves";
import s from "./beats.module.css";

// A groove drawn small: a line per drum it uses, a mark per note (bigger for an accent, hollow for
// a ghost). Only a picture of the rows written beside it.
function MiniPattern({ groove }) {
  const notes = grooveNotes(groove);
  const rows = GRID_ORDER.filter((id) => notes[id]);
  const steps = stepsPerBar(METERS[groove.meter]);
  const w = 8;
  const h = 8;
  return (
    <svg className={s.mini} viewBox={`0 0 ${steps * w} ${rows.length * h}`} width={steps * w} height={rows.length * h} aria-hidden="true">
      {rows.map((id, r) =>
        notes[id].map((level, c) =>
          level ? (
            level === 1 ? (
              <rect key={`${id}${c}`} x={c * w + 2} y={r * h + 2} width={4} height={4} className={s.miniGhost} />
            ) : (
              <rect key={`${id}${c}`} x={c * w + (level === 3 ? 0.5 : 1.5)} y={r * h + (level === 3 ? 0.5 : 1.5)} width={level === 3 ? 7 : 5} height={level === 3 ? 7 : 5} className={s.miniHit} />
            )
          ) : null,
        ),
      )}
    </svg>
  );
}

export default function SettingsGrooves({ m }) {
  const { beat, selected } = m;
  const [style, setStyle] = useState("All");
  const [withTempo, setWithTempo] = useState(true);
  const [message, setMessage] = useState("");
  const list = GROOVES.filter((g) => style === "All" || g.style === style);
  const full = beat.parts.length >= MAX_PARTS;

  // The groove's tempo and swing come with it, unless that's switched off.
  const feel = (b, g) => (withTempo ? setSwing(setTempo(b, g.tempo), g.swing || 0, g.swingUnit || 8) : b);

  function use(g) {
    const id = selected.id;
    m.edit((b) => feel(replaceNotes(setMeter(b, g.meter), id, grooveNotes(g)), g));
    setMessage(`${selected.name} now plays ${g.name}${g.meter !== beat.meter ? `, and the beat is in ${g.meter}` : ""}. Undo takes it back.`);
  }

  function addAsPart(g) {
    const r = addPart(setMeter(beat, g.meter), g.name, grooveNotes(g));
    if (!r.id) return;
    m.edit(() => feel(r.beat, g));
    m.selectPart(r.id);
    setMessage(`Added ${g.name} as a new part.`);
  }

  return (
    <div className={s.sections}>
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Start from a groove</h3>
        <p className={s.prose}>
          The beats every drummer learns, by style. Use one in <strong>{selected.name}</strong> to replace its notes, or add it as a part of its
          own. While the beat plays, each one you choose comes in straight away.
        </p>
        <div className={s.chips} role="radiogroup" aria-label="Style">
          {["All", ...STYLES].map((st) => (
            <button key={st} type="button" role="radio" aria-checked={style === st} className={s.chip} onClick={() => setStyle(st)}>
              {st}
            </button>
          ))}
        </div>
        <label className={s.check}>
          <input type="checkbox" checked={withTempo} onChange={(e) => setWithTempo(e.target.checked)} />
          Set the tempo and swing to suit each groove
        </label>
        <p className={s.liveMessage} role="status">
          {message}
        </p>
        <ul className={s.grooveList}>
          {list.map((g) => (
            <li key={g.id} className={s.groove}>
              <div className={s.grooveText}>
                <span className={s.grooveName}>{g.name}</span>
                <span className={s.grooveMeta}>
                  {g.fill ? "Fill" : g.style} · {g.meter} · {g.tempo} BPM{g.swing ? ` · swing ${g.swing}%` : ""}
                </span>
                <span className={s.grooveNote}>{g.note}</span>
                {g.meter !== beat.meter && <span className={s.grooveWarn}>Changes the beat to {g.meter}</span>}
              </div>
              <MiniPattern groove={g} />
              <div className={s.grooveKeys}>
                <button type="button" className={s.paperButtonStrong} onClick={() => use(g)}>
                  Use in {selected.name}
                </button>
                <button type="button" className={s.paperButton} onClick={() => addAsPart(g)} disabled={full}>
                  Add as a part
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
