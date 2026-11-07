"use client";

import { GRID_ORDER, LEVEL, PIECE_BY_ID } from "@/lib/drums/kit";
import { useKeyLabels } from "./keyLabels";
import s from "./beats.module.css";

const pct = (v) => `${Math.round(v * 100)}%`;

// This browser's mix: the whole kit's volume, each drum's level, and mutes. Muting the drums you
// want to play yourself turns any beat into a play-along.
export default function SettingsKit({ m, playPiece }) {
  const { prefs, setPrefs } = m;
  const keyLabels = useKeyLabels();
  const changed = Object.keys(prefs.mix).length > 0 || prefs.muted.length > 0;

  const setLevel = (id, value) => setPrefs((p) => ({ mix: { ...p.mix, [id]: value } }));
  const setMuted = (id, on) => setPrefs((p) => ({ muted: on ? [...p.muted, id] : p.muted.filter((x) => x !== id) }));

  return (
    <div className={s.sections}>
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Volume</h3>
        <div className={s.sliderField}>
          <label className={s.sliderLabel} htmlFor="bm-volume">
            Whole kit
          </label>
          <input
            id="bm-volume"
            className={s.paperSlider}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={prefs.volume}
            aria-valuetext={pct(prefs.volume)}
            onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
          />
          <span className={s.sliderValue}>{pct(prefs.volume)}</span>
        </div>
      </section>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>Mix</h3>
        <p className={s.prose}>
          Turn a drum up or down, or mute it. To practise, mute the drums you want to play yourself and play them on the pads along with the
          beat. The mix stays in this browser and doesn&rsquo;t travel with a shared beat.
        </p>
        <ul className={s.mixList}>
          {GRID_ORDER.map((id) => {
            const p = PIECE_BY_ID[id];
            const level = prefs.mix[id] ?? 1;
            const muted = prefs.muted.includes(id);
            return (
              <li key={id} className={s.mixRow} data-muted={muted ? "true" : undefined}>
                <button type="button" className={s.hear} onClick={() => playPiece(id, LEVEL.normal)} aria-label={`Hear the ${p.name.toLowerCase()}`}>
                  <span className={s.mixName}>{p.name}</span>
                  <kbd className={s.paperKey}>{keyLabels[p.code]}</kbd>
                </button>
                <input
                  className={s.paperSlider}
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={level}
                  aria-label={`${p.name} level`}
                  aria-valuetext={muted ? `${pct(level)}, muted` : pct(level)}
                  onChange={(e) => setLevel(id, Number(e.target.value))}
                />
                <span className={s.sliderValue}>{pct(level)}</span>
                <label className={s.muteCheck}>
                  <input type="checkbox" checked={muted} onChange={(e) => setMuted(id, e.target.checked)} />
                  Mute
                </label>
              </li>
            );
          })}
        </ul>
        <div className={s.buttonRow}>
          <button type="button" className={s.paperButton} disabled={!changed} onClick={() => setPrefs({ mix: {}, muted: [] })}>
            Reset the mix
          </button>
        </div>
      </section>
    </div>
  );
}
