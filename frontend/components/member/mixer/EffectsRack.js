"use client";

import LevelSlider from "./LevelSlider";
import { DEFAULT_EFFECTS, EFFECT_PRESETS, REVERB_SIZES } from "@/lib/audio/takeEffects";
import { chip, eyebrow, hint, smallBtn } from "./styles";

const signedDb = (v) => `${v > 0 ? "+" : ""}${v} dB`;

function sameSettings(a, b) {
  return Object.keys(DEFAULT_EFFECTS).every((k) => a[k] === b[k]);
}

// EQ, drive, reverb and output level for the student's take. These only shape playback
// and the downloaded mix: the take itself stays exactly as recorded.
export default function EffectsRack({ fx, onChange }) {
  const set = (patch) => onChange({ ...fx, ...patch });
  const off = fx.bypass;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ ...eyebrow, marginBottom: 0, marginRight: "auto" }}>Effects on your take</div>
        <button
          type="button"
          onClick={() => set({ bypass: !fx.bypass })}
          aria-pressed={fx.bypass}
          style={{ ...smallBtn, ...(fx.bypass ? { background: "var(--rw-ink)", color: "#fff", border: "1px solid var(--rw-ink)" } : {}) }}
        >
          {fx.bypass ? "Bypassed" : "Bypass"}
        </button>
        <button type="button" onClick={() => onChange({ ...DEFAULT_EFFECTS })} style={smallBtn}>
          Reset effects
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }} role="group" aria-label="Effect presets">
        {EFFECT_PRESETS.map((p) => {
          const active = sameSettings({ ...p.settings, bypass: fx.bypass }, fx);
          return (
            <button key={p.id} type="button" onClick={() => onChange({ ...p.settings })} aria-pressed={active} style={chip(active)}>
              {p.label}
            </button>
          );
        })}
      </div>

      <fieldset disabled={off} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8, opacity: off ? 0.5 : 1 }}>
        <legend style={{ ...hint, marginBottom: 6 }}>EQ</legend>
        <LevelSlider label="Low" min={-12} max={12} step={0.5} value={fx.low} onChange={(low) => set({ low })} format={signedDb} />
        <LevelSlider label="Mid" min={-12} max={12} step={0.5} value={fx.mid} onChange={(mid) => set({ mid })} format={signedDb} />
        <LevelSlider label="High" min={-12} max={12} step={0.5} value={fx.high} onChange={(high) => set({ high })} format={signedDb} />
        <LevelSlider label="Drive" value={fx.drive} onChange={(drive) => set({ drive })} />
        <LevelSlider label="Reverb" value={fx.reverb} onChange={(reverb) => set({ reverb })} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 82 }} role="group" aria-label="Reverb size">
          {REVERB_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => set({ size: s.id })}
              aria-pressed={fx.size === s.id}
              style={{ ...chip(fx.size === s.id), padding: "5px 10px", fontSize: 12 }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <LevelSlider
          label="Output"
          min={-12}
          max={6}
          step={0.5}
          value={fx.output}
          onChange={(output) => set({ output })}
          format={signedDb}
        />
      </fieldset>
      <p style={{ ...hint, marginTop: 10 }}>
        Effects change how your take sounds here and in the downloaded mix. The recording itself stays as you played it.
      </p>
    </div>
  );
}
