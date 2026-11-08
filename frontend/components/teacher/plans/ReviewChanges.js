"use client";

import { useEffect, useRef, useState } from "react";
import s from "@/components/teacher/Plans.module.css";
import { count } from "@/lib/plans";
import { api, send } from "@/lib/studio";
import { MonthFieldLines, TaskChanges } from "./ChangeLines";

const first = (name) => (name || "This student").split(" ")[0];

// Exactly what a change to a published plan would do, student by student, before anyone's work changes.
// Takes are never touched. If what would happen has moved by the time it's applied, the server refuses
// and this shows the new picture instead.
export default function ReviewChanges({ plan, onApplied, onDiscarded, onCancel }) {
  const heading = useRef(null);
  const [impact, setImpact] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function show(next) {
    setImpact(next);
    setChosen(next.students.filter((p) => p.linked && p.changeCount > 0).map((p) => p.studentId));
  }

  useEffect(() => {
    api(`/teacher/plans/${plan.id}/impact`)
      .then((d) => show(d.impact))
      .catch((err) => setError(err.message));
  }, [plan.id]);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function apply() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const { plan: updated, applied } = await send(`/teacher/plans/${plan.id}/apply`, "POST", { studentIds: chosen, basis: impact.basis });
      onApplied(updated, applied.length);
    } catch (err) {
      setBusy(false);
      // The server sends the new picture when the review has gone out of date.
      const fresh = await api(`/teacher/plans/${plan.id}/impact`).catch(() => null);
      if (fresh && fresh.impact.basis !== impact.basis) {
        show(fresh.impact);
        setNote("Something changed while you were looking, like a student sending a take. This is the up-to-date picture, so check it again.");
      } else {
        setError(err.message);
      }
    }
  }

  async function discard() {
    setBusy(true);
    setError("");
    try {
      const { plan: updated } = await send(`/teacher/plans/${plan.id}/discard`, "POST", {});
      onDiscarded(updated);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const total = impact?.totals;

  return (
    <section className={s.tag} aria-labelledby="review-heading">
      <h2 id="review-heading" ref={heading} tabIndex={-1}>
        Review changes for students
      </h2>
      {!impact && !error && <p>Working out what would change…</p>}
      {note && <p role="status">{note}</p>}
      {plan.check.problems.length > 0 && (
        <div>
          <p className={s.sectionName}>To fix before this can be applied</p>
          <ul className={s.lines}>
            {plan.check.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {impact && (
        <>
          {total.students === 0 ? (
            <p>Nothing here changes anything for your students.</p>
          ) : (
            <p>
              {`These changes reach ${count(total.students, "student")}${total.tasks ? ` and ${count(total.tasks, "task")}` : ""}. `}
              {total.withTakes > 0 ? `${count(total.withTakes, "task")} already ${total.withTakes === 1 ? "has" : "have"} takes, which stay exactly as they were. ` : ""}
              Nobody&apos;s work changes until you apply this.
            </p>
          )}
          {total.unlinked > 0 && <p>{`${count(total.unlinked, "student")} no longer linked to you ${total.unlinked === 1 ? "is" : "are"} left as they are.`}</p>}
          {impact.students.map((p) => {
            const name = first(p.name);
            const nothing = p.changeCount === 0;
            return (
              <div key={p.studentId} className={s.student}>
                {nothing || !p.linked ? (
                  <div className={s.personRow} data-off="true">
                    <span>
                      {p.name || "Unnamed student"}
                      <span className={s.personMeta}>{!p.linked ? " · not linked to you any more" : " · nothing changes"}</span>
                    </span>
                  </div>
                ) : (
                  <label className={s.personRow}>
                    <input type="checkbox" checked={chosen.includes(p.studentId)} onChange={(e) => setChosen((list) => (e.target.checked ? [...list, p.studentId] : list.filter((x) => x !== p.studentId)))} />
                    <span>
                      {p.name || "Unnamed student"}
                      <span className={s.personMeta}>{` · ${count(p.changeCount, "change")}`}</span>
                    </span>
                  </label>
                )}
                <div style={{ marginLeft: 30 }}>
                  <MonthFieldLines fields={p.monthFields} kept={p.monthKept} who={name} />
                  {p.reordered && <div className={s.changeLine}>The order of the tasks changes.</div>}
                </div>
                <TaskChanges changes={p.changes} adds={p.adds} removes={p.removes} keeps={p.keeps} who={name} />
              </div>
            );
          })}
        </>
      )}
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <button type="button" className="rw-st-btn" data-tone="primary" disabled={busy || !impact || !chosen.length || plan.check.problems.length > 0} onClick={apply}>
          {busy ? "Applying…" : `Apply to ${count(chosen.length, "student")}`}
        </button>
        <button type="button" className="rw-st-btn" onClick={onCancel}>
          Keep editing
        </button>
        <button type="button" className="rw-st-btn" data-tone="quiet" disabled={busy} onClick={discard}>
          Go back to what&apos;s published
        </button>
      </div>
    </section>
  );
}
