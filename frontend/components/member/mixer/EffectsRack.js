"use client";

import LevelSlider from "./LevelSlider";
import EqGraph from "./EqGraph";
import Meter from "../player/Meter";
import { DEFAULT_EFFECTS, EFFECT_PRESETS, REVERB_SIZES } from "@/lib/audio/takeEffects";

const signedDb = (v) => `${v > 0 ? "+" : ""}${v} dB`;

// What each preset does, in words, read from its own settings so it can't drift from them.
function describe(s) {
  const bits = [];
  if (s.drive) bits.push(`${s.drive}% drive`);
  if (s.reverb) bits.push(`${REVERB_SIZES.find((r) => r.id === s.size)?.label.toLowerCase()} reverb ${s.reverb}%`);
  const tilt = s.high - s.low;
  if (tilt >= 2) bits.push("brighter");
  else if (tilt <= -2) bits.push("warmer");
  return bits.join(", ") || "flat";
}

function sameSettings(a, b) {
  return Object.keys(DEFAULT_EFFECTS).every((k) => a[k] === b[k]);
}

// EQ, drive, reverb and output level for the student's take. These only shape playback and the
// downloaded mix: the take itself stays exactly as recorded.
export default function EffectsRack({ fx, onChange, getTake, active }) {
  const set = (patch) => onChange({ ...fx, ...patch });
  const off = fx.bypass;
  const custom = !EFFECT_PRESETS.some((p) => sameSettings({ ...p.settings, bypass: fx.bypass }, fx)) && !sameSettings(DEFAULT_EFFECTS, { ...fx, bypass: false });

  return (
    <div className="rw-fx" data-bypassed={off ? "true" : "false"}>
      <div className="rw-fx-head">
        <span className="rw-studio-label">Effects on your take</span>
        <button type="button" className="rw-switch" onClick={() => set({ bypass: !fx.bypass })} aria-pressed={fx.bypass} title={fx.bypass ? "Turn the effects back on" : "Hear the take without effects"}>
          {fx.bypass ? "Bypassed" : "Bypass"}
        </button>
        <button type="button" className="rw-btn rw-btn-small" onClick={() => onChange({ ...DEFAULT_EFFECTS })}>
          Reset effects
        </button>
      </div>
      <p className="rw-fx-state" role="status">
        <span className="rw-fx-lamp" aria-hidden="true" />
        {off ? "Off: you're hearing your take as recorded." : custom ? "On, with your own settings." : "On."}
      </p>

      <div className="rw-fx-presets" role="group" aria-label="Effect presets">
        {EFFECT_PRESETS.map((p) => {
          const chosen = sameSettings({ ...p.settings, bypass: fx.bypass }, fx);
          return (
            <div key={p.id} className="rw-preset" data-chosen={chosen ? "true" : "false"}>
              <button type="button" onClick={() => onChange({ ...p.settings })} aria-pressed={chosen} aria-describedby={`fx-${p.id}`}>
                {p.label}
              </button>
              <span id={`fx-${p.id}`}>{describe(p.settings)}</span>
            </div>
          );
        })}
      </div>

      <fieldset disabled={off} className="rw-fx-controls">
        <legend className="rw-studio-label">EQ</legend>
        <EqGraph fx={fx} onChange={set} disabled={off} />
        <LevelSlider label="Low" min={-12} max={12} step={0.5} value={fx.low} onChange={(low) => set({ low })} format={signedDb} dim={off} />
        <LevelSlider label="Mid" min={-12} max={12} step={0.5} value={fx.mid} onChange={(mid) => set({ mid })} format={signedDb} dim={off} />
        <LevelSlider label="High" min={-12} max={12} step={0.5} value={fx.high} onChange={(high) => set({ high })} format={signedDb} dim={off} />

        <span className="rw-studio-label" style={{ marginTop: 8 }}>
          Drive and space
        </span>
        <LevelSlider label="Drive" value={fx.drive} onChange={(drive) => set({ drive })} tone="var(--rw-part-guitar)" dim={off} />
        <LevelSlider label="Reverb" value={fx.reverb} onChange={(reverb) => set({ reverb })} tone="var(--rw-sea-glass)" dim={off} />
        <div className="rw-fx-sizes" role="group" aria-label="Reverb size">
          {REVERB_SIZES.map((s) => (
            <button key={s.id} type="button" onClick={() => set({ size: s.id })} aria-pressed={fx.size === s.id} title={`Dies away over about ${s.seconds} s`}>
              {s.label}
            </button>
          ))}
          <span className="rw-studio-hint" style={{ alignSelf: "center" }}>
            {fx.reverb ? `Dies away over about ${REVERB_SIZES.find((s) => s.id === fx.size)?.seconds} s` : "Reverb is off at 0%"}
          </span>
        </div>

        <span className="rw-studio-label" style={{ marginTop: 8 }}>
          Output
        </span>
        <LevelSlider label="Output" min={-12} max={6} step={0.5} value={fx.output} onChange={(output) => set({ output })} format={signedDb} dim={off}>
          <Meter getNodes={getTake} active={active} vertical={false} length={56} thickness={5} title="Your take's level after effects" />
        </LevelSlider>
      </fieldset>
      <p className="rw-studio-hint">Effects change how your take sounds here and in the downloaded mix. The recording itself stays as you played it.</p>
    </div>
  );
}
