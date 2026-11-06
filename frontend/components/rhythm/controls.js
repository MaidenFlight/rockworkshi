"use client";

import { useId } from "react";
import s from "./rhythm.module.css";

// A labelled row of mutually exclusive buttons. `tone` picks the paper or console treatment; the
// selected button carries a fill as well as a colour.
export function Segmented({ label, value, options, onChange, tone = "paper", disabled = false, hint }) {
  const id = useId();
  return (
    <div className={s.field} data-tone={tone}>
      <span className={s.fieldLabel} id={id}>
        {label}
      </span>
      <div className={s.seg} role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={s.segBtn}
            aria-pressed={value === o.value}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className={s.fieldHint}>{hint}</p>}
    </div>
  );
}

export const ON_OFF = [
  { value: true, label: "On" },
  { value: false, label: "Off" },
];
