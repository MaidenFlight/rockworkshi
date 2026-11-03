"use client";

import { useId } from "react";

// A labelled range input with its value shown as text. Screen readers get the
// formatted value too (aria-valuetext), e.g. "80%" or "+2 dB", not a bare number.
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
  children,
}) {
  const id = useId();
  const text = format(value);
  return (
    <div className="rw-level-row" style={{ display: "flex", alignItems: "center", gap: 10, opacity: disabled ? 0.5 : 1 }}>
      <label
        htmlFor={id}
        style={{
          width: labelWidth,
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 700,
          color: dim ? "var(--rw-meta)" : "var(--rw-ink)",
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={text}
        style={{ flex: 1, minWidth: 0, accentColor: dim ? "var(--rw-meta)" : "var(--rw-orange)" }}
      />
      <output
        htmlFor={id}
        style={{ width: 44, textAlign: "right", fontSize: 12.5, color: "var(--rw-body)", fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </output>
      {children}
    </div>
  );
}
