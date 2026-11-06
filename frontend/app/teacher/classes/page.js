"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, kindLabel, repeatText, when } from "@/lib/studio";

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/teacher/classes")
      .then((d) => setClasses(d.classes))
      .catch((err) => (setError(err.message), setClasses([])));
  }, []);

  const active = (classes || []).filter((c) => c.status === "active");
  const ended = (classes || []).filter((c) => c.status !== "active");

  return (
    <div className="rw-st">
      <div className="rw-st-head">
        <div>
          <h1 className="rw-st-title">Classes</h1>
          <p className="rw-st-lead">Lessons, group classes, workshops, rehearsals and performances you teach. The school office enrols students.</p>
        </div>
        <Link href="/teacher/classes/new" className="rw-st-btn" data-tone="primary">
          New class
        </Link>
      </div>
      {error && <p className="rw-st-error">{error}</p>}

      {classes === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : active.length === 0 ? (
        <div className="rw-st-empty">
          <strong>No classes yet</strong>
          Create a one-off lesson or a weekly class. Once the school office enrols students, they&apos;ll see it on their dashboard.
        </div>
      ) : (
        <div className="rw-st-table-wrap">
          <table className="rw-st-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>When</th>
                <th>Next session</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/teacher/classes/${c.id}`}>{c.title}</Link>
                    <div className="rw-st-muted">
                      {kindLabel(c.kind)}
                      {c.instruments.length ? ` · ${c.instruments.join(", ")}` : ""}
                    </div>
                  </td>
                  <td>{repeatText(c)}</td>
                  <td>{c.next ? when(c.next.startsAt, c.timeZone) : <span className="rw-st-chip" data-tone="off">None ahead</span>}</td>
                  <td>
                    {c.enrolled}
                    {c.capacity ? ` of ${c.capacity}` : ""}
                    {c.waitlisted ? (
                      <span className="rw-st-chip" data-tone="warn" style={{ marginLeft: 6 }}>
                        {c.waitlisted} waiting
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ended.length > 0 && (
        <details>
          <summary className="rw-st-muted" style={{ cursor: "pointer", fontWeight: 700 }}>
            Cancelled classes ({ended.length})
          </summary>
          <ul style={{ fontSize: 14 }}>
            {ended.map((c) => (
              <li key={c.id}>
                <Link href={`/teacher/classes/${c.id}`}>{c.title}</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
