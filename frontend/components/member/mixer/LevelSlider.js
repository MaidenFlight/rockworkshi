"use client";

import { useId } from "react";

// A labelled range input with its value shown as text. Screen readers get the formatted value
// too (aria-valuetext), e.g. "80%" or "+2 dB", not a bare number. The track fills from zero (the
// middle, for a control that cuts and boosts) to the value, so the amount reads at a glance.
export default function LevelSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v) => `${v}%`,
  disabled = false,
  dim = false,
  labelWidth = 72,
  tone = "var(--rw-gold)",
  children,
}) {
  const id = useId();
  const text = format(value);
  const at = (v) => ((v - min) / (max - min)) * 100;
  const zero = min < 0 && max > 0 ? at(0) : 0;
  const [a, b] = [Math.min(zero, at(value)), Math.max(zero, at(value))];
  return (
    <div className="rw-level-row" data-dim={dim ? "true" : undefined} style={{ display: "flex", alignItems: "center", gap: 10, opacity: disabled ? 0.5 : 1 }}>
      <label htmlFor={id} className="rw-level-label" style={{ width: labelWidth }}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        className="rw-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={text}
        style={{
          "--tone": dim ? "var(--rw-console-meta)" : tone,
          background: `linear-gradient(90deg, var(--rw-console-well) ${a}%, var(--tone) ${a}%, var(--tone) ${b}%, var(--rw-console-well) ${b}%)`,
        }}
      />
      <output htmlFor={id} className="rw-level-value" data-zero={value === 0 && min < 0 ? "true" : undefined}>
        {text}
      </output>
      {children}
    </div>
  );
}
