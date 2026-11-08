"use client";

import { useEffect, useRef, useState } from "react";
import s from "@/components/teacher/Plans.module.css";
import { songLevels } from "@/lib/content";
import { INSTRUMENTS, send } from "@/lib/studio";

// Keeps this plan's shape as a template. The plan itself carries on as it was.
export default function SaveAsTemplate({ plan, onSaved, onCancel }) {
  const heading = useRef(null);
  const [name, setName] = useState(plan.name);
  const [instrument, setInstrument] = useState(plan.instrument);
  const [level, setLevel] = useState(plan.level);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { plan: template } = await send(`/teacher/plans/${plan.id}/template`, "POST", { name, instrument, level });
      onSaved(template);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className={s.tag} aria-labelledby="save-template-heading" onSubmit={save}>
      <h2 id="save-template-heading" ref={heading} tabIndex={-1}>
        Save as a template
      </h2>
      <p>Templates are organised by instrument and level. Editing one later never changes a month already given to students.</p>
      <div className={s.fieldStack}>
        <label className="rw-st-field">
          Template name
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="rw-st-row">
          <label className="rw-st-field">
            Instrument
            <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
              {INSTRUMENTS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          <label className="rw-st-field">
            Level
            <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {songLevels.map((l) => (
                <option key={l.n} value={l.n}>
                  {`${l.n}. ${l.name}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <button type="submit" className="rw-st-btn" data-tone="primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save template"}
        </button>
        <button type="button" className="rw-st-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
