"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Task } from "@/components/member/MonthlyChecklist";
import list from "@/components/member/MonthlyChecklist.module.css";
import { Week } from "@/components/member/WeeklyMonth";
import s from "@/components/teacher/Plans.module.css";
import { WEEKS, dayLabel, todayHere, weekOf } from "@/lib/months";
import { fieldName, taskPlace } from "@/lib/plans";
import { api } from "@/lib/studio";

export default function PreviewPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <Preview />
    </Suspense>
  );
}

// What a student would see, drawn from the plan with the student's own month layout. The month doesn't
// exist yet, so nothing here can be marked, counted or sent; the rows go nowhere.
function Preview() {
  const { id } = useParams();
  const router = useRouter();
  const studentId = useSearchParams().get("student") || "";
  const [plan, setPlan] = useState(null);
  const [state, setState] = useState({ key: null, preview: null, error: "" });
  const key = `${id}:${studentId}`;

  useEffect(() => {
    api(`/teacher/plans/${id}`)
      .then((d) => setPlan(d.plan))
      .catch((err) => setState({ key: `${id}:`, preview: null, error: err.message }));
  }, [id]);

  useEffect(() => {
    let stale = false;
    api(`/teacher/plans/${id}/preview${studentId ? `?studentId=${studentId}` : ""}`)
      .then((d) => !stale && setState({ key, preview: d.preview, error: "" }))
      .catch((err) => !stale && setState({ key, preview: null, error: err.message }));
    return () => {
      stale = true;
    };
  }, [id, studentId, key]);

  const preview = state.key === key ? state.preview : null;
  const error = state.error;
  const back = `/teacher/plans/${id}`;

  if (error) {
    return (
      <p className="rw-st-error" role="alert">
        {error} <Link href={back}>Back to the plan</Link>
      </p>
    );
  }
  if (!preview || !plan) return <p className="rw-st-muted">Loading…</p>;

  const name = preview.student?.name?.split(" ")[0] ?? "A student";
  const today = todayHere();
  const now = weekOf(preview.startsOn, today);
  const month = {
    id: "preview",
    startsOn: preview.startsOn,
    weekTitles: preview.weekTitles,
    song: preview.song,
    tasks: preview.assignments,
  };

  return (
    <div className="rw-st">
      <div>
        <Link href={back} className={`rw-st-muted ${s.back}`}>
          ← Back to the plan
        </Link>
        <h1 className="rw-st-title" style={{ marginTop: 6 }}>
          Student preview
        </h1>
        <p className="rw-st-lead">{preview.name}</p>
      </div>

      <p className={s.previewNote} role="note">
        {`This is what ${preview.student ? name : "a student"} would see. It's only a preview: nothing here is saved, marked or sent, and ${preview.student ? "they can't see it" : "nobody can see it"} until it's published.`}
      </p>

      {plan.kind === "plan" && plan.students.length > 0 && (
        <label className="rw-st-field" style={{ maxWidth: 320 }}>
          Preview for
          <select value={studentId} style={{ minHeight: 44 }} onChange={(e) => router.replace(`/teacher/plans/${id}/preview${e.target.value ? `?student=${e.target.value}` : ""}`)}>
            <option value="">The plan as written</option>
            {plan.students.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Unnamed student"}
              </option>
            ))}
          </select>
        </label>
      )}

      {preview.assumedStart && <p className="rw-st-muted">{`A template has no dates of its own, so this uses today, ${dayLabel(preview.startsOn)}, as the first day.`}</p>}
      {!preview.canFilm && <p className="rw-st-muted">{`${name} is under 18 and a guardian hasn't turned on Practice videos, so video tasks will ask for audio until they do.`}</p>}

      <section className={s.previewBody} aria-label="What the student sees">
        <div className={list.head}>
          <h2 className="rw-dash-h2">{preview.song?.title ?? "This month's song"}</h2>
          <span className={list.count}>{`0 of ${preview.assignments.length} done`}</span>
        </div>
        <div className={list.bar} aria-hidden="true">
          <span style={{ width: "0%" }} />
        </div>
        {preview.assignments.length === 0 && <p className="rw-st-muted">Nothing to show yet. Add some tasks to the plan.</p>}
        {WEEKS.map((n) => (
          <Week
            key={n}
            number={n}
            month={month}
            now={n === now && preview.startsOn <= today}
            open
            renderTask={(t) => (
              <Task key={t.id} task={t} preview>
                <div className={s.previewDetail}>
                  {t.instruction && <p>{t.instruction}</p>}
                  {t.kind === "assessment" && t.criteria.length > 0 && <p>{`What your teacher listens for: ${t.criteria.join(", ")}`}</p>}
                  {t.changedFor.length > 0 && <p className={s.different}>{`Different for ${name}: ${t.changedFor.map((f) => fieldName(f).toLowerCase()).join(", ")}`}</p>}
                </div>
              </Task>
            )}
          />
        ))}
        {preview.leftOut.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p className={s.sectionName}>{`Left out for ${name}`}</p>
            <ul className={s.lines}>
              {preview.leftOut.map((t) => (
                <li key={t.taskId}>{`${taskPlace(t)}: ${t.label}`}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
