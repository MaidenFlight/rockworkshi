"use client";

import LevelSlider from "./LevelSlider";
import { hint, smallBtn, toggleBtn } from "./styles";

// Volume, mute and solo per stem, plus master and the take. Changing any of these only
// moves gains on the running audio graph: playback never stops or restarts.
export default function MixerPanel({ parts, mix, levels, onChange, takeLabel, onReset }) {
  const setStem = (part, patch) =>
    onChange({ ...mix, stems: { ...mix.stems, [part]: { ...mix.stems[part], ...patch } } });

  const anySolo = parts.some((p) => mix.stems[p]?.soloed);
  const bandSilent = parts.every((p) => !levels[p]?.audible);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {parts.map((part) => {
        const stem = mix.stems[part];
        const audible = levels[part]?.audible;
        return (
          <LevelSlider
            key={part}
            label={audible ? part : `${part} (off)`}
            labelWidth={96}
            value={stem.volume}
            onChange={(volume) => setStem(part, { volume })}
            dim={!audible}
          >
            <button
              type="button"
              onClick={() => setStem(part, { muted: !stem.muted })}
              aria-pressed={stem.muted}
              aria-label={`Mute ${part}`}
              title={`Mute ${part}`}
              style={toggleBtn(stem.muted, "var(--rw-orange-deep)")}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => setStem(part, { soloed: !stem.soloed })}
              aria-pressed={stem.soloed}
              aria-label={`Solo ${part}`}
              title={`Solo ${part}`}
              style={toggleBtn(stem.soloed, "var(--rw-teal)")}
            >
              S
            </button>
          </LevelSlider>
        );
      })}

      {takeLabel && (
        <LevelSlider
          label={mix.takeMuted ? `${takeLabel} (off)` : takeLabel}
          labelWidth={96}
          value={mix.take}
          onChange={(take) => onChange({ ...mix, take })}
          dim={mix.takeMuted}
        >
          <button
            type="button"
            onClick={() => onChange({ ...mix, takeMuted: !mix.takeMuted })}
            aria-pressed={mix.takeMuted}
            aria-label={`Mute ${takeLabel}`}
            title={`Mute ${takeLabel}`}
            style={toggleBtn(mix.takeMuted, "var(--rw-orange-deep)")}
          >
            M
          </button>
          <span style={{ width: 30 }} aria-hidden="true" />
        </LevelSlider>
      )}

      <div style={{ borderTop: "1px solid var(--rw-border)", marginTop: 4, paddingTop: 10 }}>
        <LevelSlider label="Master" labelWidth={96} value={mix.master} onChange={(master) => onChange({ ...mix, master })}>
          <button type="button" onClick={onReset} style={{ ...smallBtn, width: 68 }}>
            Reset mix
          </button>
        </LevelSlider>
      </div>

      {(bandSilent || anySolo) && (
        <p style={hint} role="status">
          {bandSilent
            ? "The band is silent: the play mode, mute and solo leave no part playing."
            : "Solo is on: only soloed parts play. Your take has its own mute."}
        </p>
      )}
    </div>
  );
}
