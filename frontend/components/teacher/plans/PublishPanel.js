"use client";

import { useEffect, useRef, useState } from "react";
import s from "@/components/teacher/Plans.module.css";
import { count } from "@/lib/plans";
import { send } from "@/lib/studio";

// The last look before a month reaches anyone: what still needs doing, exactly who gets it, and one
// explicit button. Someone with a different instrument isn't ticked to start with, but can be.
export default function PublishPanel({ plan, onPublished, onCancel }) {
  const heading = useRef(null);
  const can = plan.students.filter((p) => !p.month && !p.issues.some((i) => i.blocking));
  const blocked = plan.students.filter((p) => !p.month && p.issues.some((i) => i.blocking));
  const [chosen, setChosen] = useState(() => can.filter((p) => !p.issues.some((i) => i.kind === "other-instrument")).map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const shown = plan.check.problems;

  async function publish() {
    setBusy(true);
    setError("");
    try {
      const { plan: updated, published } = await send(`/teacher/plans/${plan.id}/publish`, "POST", { studentIds: chosen });
      onPublished(updated, published);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className={s.tag} aria-labelledby="publish-heading">
      <h2 id="publish-heading" ref={heading} tabIndex={-1}>
        Publish this month
      </h2>
      {shown.length > 0 && (
        <div>
          <p className={s.sectionName}>To fix before it can go out</p>
          <ul className={s.lines}>
            {shown.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.check.warnings.length > 0 && (
        <div>
          <p className={s.sectionName}>Worth a look</p>
          <ul className={s.lines}>
            {plan.check.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className={s.sectionName}>Who gets it</p>
        {can.length === 0 ? (
          <p>Nobody can get this yet. Add students under Who it&apos;s for.</p>
        ) : (
          <ul className={s.people}>
            {can.map((p) => (
              <li key={p.id}>
                <label className={s.personRow}>
                  <input type="checkbox" checked={chosen.includes(p.id)} onChange={(e) => setChosen((list) => (e.target.checked ? [...list, p.id] : list.filter((x) => x !== p.id)))} />
                  <span>
                    {p.name || "Unnamed student"}
                    <span className={s.personMeta}>{` · ${p.instrument}${Object.keys(p.overrides).length ? ` · ${count(Object.keys(p.overrides).length, "individual change")}` : ""}`}</span>
                  </span>
                </label>
                {p.issues.map((i) => (
                  <p key={i.kind} className={s.personNote}>
                    {i.text}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
      {blocked.length > 0 && (
        <div>
          <p className={s.sectionName}>Can&apos;t get it yet</p>
          <ul className={s.lines}>
            {blocked.map((p) => (
              <li key={p.id}>{`${p.name || "Unnamed student"}: ${p.issues.filter((i) => i.blocking).map((i) => i.text).join(" ")}`}</li>
            ))}
          </ul>
        </div>
      )}
      <p>Each student gets their own copy on their dashboard the next time they open it. No email or message is sent.</p>
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <button type="button" className="rw-st-btn" data-tone="primary" disabled={busy || !chosen.length || shown.length > 0} onClick={publish}>
          {busy ? "Publishing…" : `Publish to ${count(chosen.length, "student")}`}
        </button>
        <button type="button" className="rw-st-btn" onClick={onCancel}>
          Not yet
        </button>
      </div>
    </section>
  );
}
