"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_LABELS, contentTitle, formatDate, studentName, teacherRequest } from "@/lib/teaching";

export default function TeacherDashboard() {
  const [students, setStudents] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [studentFilter, setStudentFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([teacherRequest("/teacher/students"), teacherRequest("/teacher/assignments")])
      .then(([s, a]) => {
        setStudents(s.students);
        setAssignments(a.assignments);
      })
      .catch((err) => {
        setError(err.message);
        setStudents([]);
      });
  }, []);

  const waiting = assignments.filter((a) => a.status === "ready");
  const shown = assignments.filter((a) => !studentFilter || a.student?.id === studentFilter);

  return (
    <div>
      <div style={eyebrow}>Teaching</div>
      <h1 style={{ fontWeight: 600, fontSize: 30, color: "var(--rw-ink)", margin: "6px 0 24px" }}>Your students</h1>

      {error && <p style={{ color: "var(--rw-orange-deep)" }}>{error}</p>}

      {students === null ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : (
        <>
          <section style={{ marginBottom: 32 }}>
            <h2 style={h2}>Waiting for review</h2>
            {waiting.length === 0 ? (
              <p style={muted}>Nothing to review right now.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {waiting.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
              </div>
            )}
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={h2}>Students</h2>
            {students.length === 0 ? (
              <p style={muted}>No students are linked to you yet. The school links students to teachers.</p>
            ) : (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                {students.map((s) => (
                  <div key={s.id} style={card}>
                    <div style={{ fontWeight: 700, color: "var(--rw-ink)" }}>{studentName(s)}</div>
                    <div style={{ fontSize: 13, color: "var(--rw-meta)", margin: "2px 0 10px" }}>
                      {[s.instrument, s.level].filter(Boolean).join(" · ") || "No instrument set"}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--rw-body)", marginBottom: 12 }}>
                      {Object.keys(STATUS_LABELS)
                        .filter((k) => s.assignments[k])
                        .map((k) => `${s.assignments[k]} ${STATUS_LABELS[k].toLowerCase()}`)
                        .join(" · ") || "No work set yet"}
                    </div>
                    <Link href={`/teacher/new?student=${s.id}`} style={smallBtn}>
                      Set practice work
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={h2}>All practice work</h2>
              {students.length > 0 && (
                <select
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  style={select}
                  aria-label="Show work for"
                >
                  <option value="">All students</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {studentName(s)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {shown.length === 0 ? (
              <p style={muted}>No practice work yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {shown.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AssignmentRow({ assignment: a }) {
  const latest = a.submissions[0];
  return (
    <Link href={`/teacher/assignments/${a.id}`} style={{ ...card, display: "flex", gap: 12, alignItems: "center", textDecoration: "none" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--rw-ink)" }}>
          {studentName(a.student)} · {contentTitle(a)}
        </div>
        <div style={{ fontSize: 13, color: "var(--rw-meta)" }}>
          {a.instrument} · Level {a.level} {a.levelName}
          {a.section ? ` · ${a.section}` : ""}
          {latest ? ` · sent ${formatDate(latest.createdAt)}` : ""}
          {latest?.recording ? " · with recording" : ""}
        </div>
      </div>
      <span style={pill(a.status)}>{STATUS_LABELS[a.status]}</span>
    </Link>
  );
}

function pill(status) {
  const colors = {
    assigned: ["#eef0ec", "var(--rw-body)"],
    ready: ["#ffe8ec", "#96082c"],
    reviewed: ["#e3f3ea", "#1f7a4d"],
  }[status] || ["#eef0ec", "var(--rw-body)"];
  return {
    fontSize: 11.5,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    background: colors[0],
    color: colors[1],
    whiteSpace: "nowrap",
  };
}

const eyebrow = { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)" };
const h2 = { fontWeight: 600, fontSize: 19, color: "var(--rw-ink)", margin: "0 0 12px" };
const muted = { color: "var(--rw-meta)", fontSize: 14, margin: 0 };
const card = {
  border: "1px solid var(--rw-border)",
  borderRadius: 10,
  background: "var(--rw-surface)",
  padding: "14px 16px",
};
const select = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  fontSize: 13.5,
  background: "#fff",
  marginBottom: 12,
};
const smallBtn = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  textDecoration: "none",
};
