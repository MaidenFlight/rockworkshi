"use client";

import { useId, useState } from "react";
import s from "./metronome.module.css";

// A set of square choices that behave as radio buttons (arrow keys move between them).
// options: [{ value, label, detail, disabled, title }]
export function Choices({ legend, name, value, options, onChange, help, columns, size, hideLegend }) {
  const auto = useId();
  const group = name || auto;
  return (
    <fieldset className={s.field}>
      <legend className={hideLegend ? s.srOnly : s.fieldLegend}>{legend}</legend>
      <div className={s.choices} data-columns={columns} data-size={size}>
        {options.map((o) => (
          <label key={String(o.value)} className={s.choice} data-disabled={o.disabled ? "true" : undefined} title={o.title}>
            <input
              type="radio"
              className={s.choiceInput}
              name={group}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
            />
            <span className={s.choiceLabel}>{o.label}</span>
            {o.detail && <span className={s.choiceDetail}>{o.detail}</span>}
          </label>
        ))}
      </div>
      {help && <div className={s.fieldHelp}>{help}</div>}
    </fieldset>
  );
}

// A whole-number field that checks itself when you leave it or press Enter, and says what it
// did with a number out of range instead of silently changing it.
export function NumberField({ label, value, min, max, onCommit, suffix, help, disabled }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (!/^\d{1,3}$/.test(text)) {
      setError(`Enter a number from ${min} to ${max}.`);
      return;
    }
    const n = Number(text);
    const clamped = Math.min(max, Math.max(min, n));
    setError(clamped === n ? "" : `${n < min ? "The lowest" : "The highest"} is ${clamped}, so it's set to ${clamped}.`);
    onCommit(clamped);
  }

  return (
    <div className={s.numberField}>
      <label className={s.numberLabel} htmlFor={id}>
        {label}
      </label>
      <span className={s.numberRow}>
        <input
          id={id}
          className={s.numberInput}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          autoComplete="off"
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value.replace(/\D/g, ""));
            setError("");
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(null);
              setError("");
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setDraft(null);
              setError("");
              onCommit(Math.min(max, Math.max(min, value + (e.key === "ArrowUp" ? 1 : -1))));
            }
          }}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        />
        {suffix && <span className={s.numberSuffix}>{suffix}</span>}
      </span>
      {error ? (
        <span className={s.fieldError} id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : (
        help && (
          <span className={s.numberHelp} id={`${id}-help`}>
            {help}
          </span>
        )
      )}
    </div>
  );
}

// A labelled slider from 0 to 100% with its value beside it.
export function PercentSlider({ label, value, onChange, disabled, help }) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className={s.sliderField} data-disabled={disabled ? "true" : undefined}>
      <label className={s.sliderLabel} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        className={s.paperSlider}
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-valuetext={`${pct}%`}
      />
      <output className={s.sliderValue} htmlFor={id}>
        {pct}%
      </output>
      {help && <span className={s.sliderHelp}>{help}</span>}
    </div>
  );
}
