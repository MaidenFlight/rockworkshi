"use client";

import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import WeekCalendar from "@/components/studio/WeekCalendar";
import { api, send, when } from "@/lib/studio";
import { STATUS_LABELS } from "@/lib/teaching";

const PURPOSE_TEXT = {
  profile: "Keep a music profile (instruments, goals, favourite music) that their teachers can read",
  "share-practice": "Share practice activity with their teachers (used from a later update)",
  "band-matching": "Be considered for teacher-arranged bands (used from a later update)",
};

export default function FamilyPage() {
  return (
    <ProtectedRoute>
      <Family />
    </ProtectedRoute>
  );
}

function Family() {
  const [children, setChildren] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/family/children").then((d) => setChildren(d.children)).catch((err) => (setError(err.message), setChildren([]))), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rw-st" style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 24px 100px" }}>
      <div>
        <h1 className="rw-st-title">Your family</h1>
        <p className="rw-st-lead">Classes, practice work and teacher feedback for the students you follow, and what you allow the school to keep.</p>
      </div>
      {error && <p className="rw-st-error">{error}</p>}
      {children?.length === 0 && !error && (
        <div className="rw-st-empty">
          <strong>No students linked yet</strong>The school sends an invitation to link you to your student.
        </div>
      )}
      {children?.length > 0 && <WeekCalendar />}
      {(children || []).map((c) => (
        <section key={c.id} className="rw-st-card" aria-labelledby={`child-${c.id}`}>
          <h2 id={`child-${c.id}`}>{c.name || "Your student"}</h2>
          <div className="rw-st-two">
            <div>
              <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Practice work</h3>
              {c.assignments.length === 0 ? (
                <p className="rw-st-muted">Nothing set yet.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 14 }}>
                  {c.assignments.map((a) => (
                    <li key={a.id}>
                      <strong>{a.title}</strong>
                      {a.section ? ` · ${a.section}` : ""} <span className="rw-st-chip">{STATUS_LABELS[a.status] || a.status}</span>
                      {a.feedback && (
                        <div className="rw-st-muted">
                          Feedback from {a.teacher || "their teacher"}, {when(a.feedback.reviewedAt, undefined, { dateOnly: true })}: {a.feedback.feedback}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>What you allow</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {Object.entries(PURPOSE_TEXT).map(([purpose, label]) => (
                  <label key={purpose} className="rw-st-check" style={{ alignItems: "flex-start", padding: "8px 12px", fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={c.consents[purpose] === true}
                      onChange={async (e) => {
                        if (!e.target.checked && purpose === "profile" && !window.confirm("Withdrawing this deletes the profile they've written. Continue?")) return;
                        await send(`/family/children/${c.id}/consents`, "POST", { purpose, granted: e.target.checked });
                        await load();
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="rw-st-muted" style={{ marginTop: 8 }}>
                You can change these at any time. Each change is recorded.
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
