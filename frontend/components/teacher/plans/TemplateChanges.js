"use client";

import { useEffect, useRef, useState } from "react";
import s from "@/components/teacher/Plans.module.css";
import { api, send } from "@/lib/studio";
import { MonthFieldLines, TaskChanges } from "./ChangeLines";

// A newer version of the template this plan came from: what bringing it in would change here. It stops
// at the plan. Students of a published plan still get nothing until those changes are reviewed and applied.
export default function TemplateChanges({ plan, onBrought, onCancel }) {
  const heading = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/teacher/plans/${plan.id}/template-changes`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [plan.id]);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function bringIn() {
    setBusy(true);
    setError("");
    try {
      const { plan: updated } = await send(`/teacher/plans/${plan.id}/template-changes`, "POST", { version: data.to });
      onBrought(updated);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className={s.tag} aria-labelledby="template-changes-heading">
      <h2 id="template-changes-heading" ref={heading} tabIndex={-1}>
        {`Changes in ${plan.template.name}`}
      </h2>
      {!data && !error && <p>Working out what&apos;s new…</p>}
      {data && (
        <>
          {!data.changesAnything && <p>Nothing in the template&apos;s new version changes this plan.</p>}
          {data.changesAnything && (
            <p>{plan.status === "published" ? "Bringing these into the plan doesn't reach students yet. You'll review them before they do." : "Bringing these into the plan doesn't touch what you've changed here."}</p>
          )}
          <MonthFieldLines fields={data.report.weekTitles} kept={data.report.weekTitlesKept} who="This plan" />
          {data.report.reordered && <div className={s.changeLine}>The order of the tasks changes.</div>}
          <TaskChanges changes={data.report.changes} adds={data.report.adds} removes={data.report.removes} keeps={data.report.keeps} who="This plan" />
        </>
      )}
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <button type="button" className="rw-st-btn" data-tone="primary" disabled={busy || !data} onClick={bringIn}>
          {busy ? "Bringing them in…" : "Bring these into this plan"}
        </button>
        <button type="button" className="rw-st-btn" onClick={onCancel}>
          Not now
        </button>
      </div>
    </section>
  );
}
