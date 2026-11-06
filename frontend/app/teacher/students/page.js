"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INSTRUMENTS, api } from "@/lib/studio";
import { STATUS_LABELS } from "@/lib/teaching";

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState("");
  const [instrument, setInstrument] = useState("");
  const [students, setStudents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      const q = new URLSearchParams({ ...(search ? { search } : {}), ...(instrument ? { instrument } : {}) });
      api(`/teacher/students?${q}`)
        .then((d) => (setStudents(d.students), setError("")))
        .catch((err) => (setError(err.message), setStudents([])));
    }, 250);
    return () => clearTimeout(id);
  }, [search, instrument]);

  const filtering = Boolean(search || instrument);

  return (
    <div className="rw-st">
      <div className="rw-st-head">
        <div>
          <h1 className="rw-st-title">Students</h1>
          <p className="rw-st-lead">The students the school has linked to you. Open one for their profile, classes and your private notes.</p>
        </div>
      </div>
      <div className="rw-st-search" role="search">
        <input className="rw-st-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" aria-label="Search students" />
        <select className="rw-st-input" value={instrument} onChange={(e) => setInstrument(e.target.value)} aria-label="Instrument">
          <option value="">All instruments</option>
          {INSTRUMENTS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </div>
      {error && <p className="rw-st-error">{error}</p>}

      {students === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : students.length === 0 ? (
        <div className="rw-st-empty">
          <strong>{filtering ? "No one matches" : "No students yet"}</strong>
          {filtering ? "Try another name or instrument." : "The school links students to teachers. Once they do, your students show here."}
        </div>
      ) : (
        <div className="rw-st-table-wrap">
          <table className="rw-st-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Instruments</th>
                <th>Practice work</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const kit = s.instruments?.length ? s.instruments : s.instrument ? [{ instrument: s.instrument, selfLevel: s.level }] : [];
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/teacher/students/${s.id}`}>{s.name || "Unnamed student"}</Link>
                    </td>
                    <td>
                      {kit.length
                        ? kit.map((i) => (
                            <div key={i.instrument}>
                              {i.instrument}
                              <span className="rw-st-muted">
                                {i.teacherLevel ? ` · ${i.teacherLevel} (your assessment)` : i.selfLevel ? ` · ${i.selfLevel} (their own view)` : ""}
                              </span>
                            </div>
                          ))
                        : <span className="rw-st-chip" data-tone="off">Not given</span>}
                    </td>
                    <td>
                      {Object.keys(STATUS_LABELS)
                        .filter((k) => s.assignments[k])
                        .map((k) => `${s.assignments[k]} ${STATUS_LABELS[k].toLowerCase()}`)
                        .join(" · ") || <span className="rw-st-muted">None set</span>}
                    </td>
                    <td>
                      <Link href={`/teacher/new?student=${s.id}`} className="rw-st-btn" data-size="small">
                        Set practice work
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
