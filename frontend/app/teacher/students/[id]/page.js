"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { WEEKDAYS, api, kindLabel, send, toTime, when } from "@/lib/studio";
import { STATUS_LABELS } from "@/lib/teaching";

const FORMAT = { online: "Online", "in-person": "In person", either: "Online or in person" };

export default function TeacherStudentPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(
    () =>
      api(`/teacher/students/${id}`)
        .then((d) => (setData(d), setNotes(d.notes)))
        .catch((err) => setError(err.message)),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <p className="rw-st-error">{error}</p>;
  if (!data) return <p className="rw-st-muted">Loading…</p>;
  const { student, profile } = data;

  async function assess(instrument, teacherLevel) {
    await send(`/teacher/students/${id}/instruments/${instrument}`, "PUT", { teacherLevel });
    await load();
  }

  return (
    <div className="rw-st">
      <div>
        <Link href="/teacher/students" className="rw-st-muted">
          ← Students
        </Link>
        <div className="rw-st-head" style={{ marginTop: 6 }}>
          <div>
            <h1 className="rw-st-title">{student.name || "Student"}</h1>
            <p className="rw-st-lead">{student.isMinor ? "Under 18 · contact goes through the school and their guardian" : "Adult student"}</p>
          </div>
          <Link href={`/teacher/new?student=${student.id}`} className="rw-st-btn" data-tone="primary">
            Set practice work
          </Link>
        </div>
      </div>

      <div className="rw-st-two">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="rw-st-card">
            <h2>Instruments</h2>
            {data.instruments.length === 0 ? (
              <p className="rw-st-muted">{student.instrument ? `${student.instrument}${student.level ? `, ${student.level}` : ""} (from signup)` : "None given yet."}</p>
            ) : (
              <div className="rw-st-table-wrap">
                <table className="rw-st-table">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Their own view</th>
                      <th>Your assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.instruments.map((i) => (
                      <tr key={i.instrument}>
                        <td>
                          {i.instrument}
                          {i.primary && (
                            <span className="rw-st-chip" style={{ marginLeft: 6 }}>
                              Main
                            </span>
                          )}
                        </td>
                        <td>{i.selfLevel || <span className="rw-st-muted">Not given</span>}</td>
                        <td>
                          <select className="rw-st-input" value={i.teacherLevel || ""} onChange={(e) => assess(i.instrument, e.target.value || null)} aria-label={`Your assessment for ${i.instrument}`}>
                            <option value="">Not assessed</option>
                            {["Beginner", "Developing", "Intermediate", "Advanced"].map((l) => (
                              <option key={l}>{l}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="rw-st-muted" style={{ marginTop: 8 }}>
              A student&apos;s own view and your assessment are kept apart. Neither is shown as a score.
            </p>
          </section>

          <section className="rw-st-card">
            <h2>Classes with you</h2>
            {data.classes.length === 0 ? (
              <p className="rw-st-muted">Not enrolled in any of your classes.</p>
            ) : (
              <div className="rw-st-table-wrap">
                <table className="rw-st-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Next</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classes.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/teacher/classes/${c.id}`}>{c.title}</Link>
                          <div className="rw-st-muted">
                            {kindLabel(c.kind)}
                            {c.status === "waitlisted" ? " · on the waitlist" : ""}
                          </div>
                        </td>
                        <td>{c.next ? when(c.next) : "—"}</td>
                        <td>
                          {c.attendance.sessionsHeld === 0 ? (
                            <span className="rw-st-muted">No sessions yet</span>
                          ) : (
                            <>
                              {c.attendance.present} of {c.attendance.recorded} recorded
                              {c.attendance.recorded < c.attendance.sessionsHeld && (
                                <div className="rw-st-muted">
                                  {c.attendance.sessionsHeld - c.attendance.recorded} session{c.attendance.sessionsHeld - c.attendance.recorded === 1 ? "" : "s"} not taken
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rw-st-card">
            <h2>Practice work</h2>
            <p style={{ margin: 0, fontSize: 14 }}>
              {Object.keys(STATUS_LABELS)
                .filter((k) => data.assignments[k])
                .map((k) => `${data.assignments[k]} ${STATUS_LABELS[k].toLowerCase()}`)
                .join(" · ") || "None set yet."}{" "}
              <Link href="/teacher">See it under Assignments</Link>
            </p>
          </section>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <section className="rw-st-card">
            <h2>Profile</h2>
            {profile ? (
              <dl className="rw-st-dl">
                {profile.goals && (
                  <>
                    <dt>Goals</dt>
                    <dd>{profile.goals}</dd>
                  </>
                )}
                {profile.genres.length > 0 && (
                  <>
                    <dt>Genres</dt>
                    <dd>{profile.genres.join(", ")}</dd>
                  </>
                )}
                {profile.favouriteArtists && (
                  <>
                    <dt>Favourites</dt>
                    <dd>{profile.favouriteArtists}</dd>
                  </>
                )}
                {profile.learningPreferences && (
                  <>
                    <dt>Likes to learn by</dt>
                    <dd>{profile.learningPreferences}</dd>
                  </>
                )}
                {profile.rehearsalFormat && (
                  <>
                    <dt>Rehearsals</dt>
                    <dd>{FORMAT[profile.rehearsalFormat]}</dd>
                  </>
                )}
                <dt>Interested in</dt>
                <dd>
                  {[profile.bandInterest && "joining a band", profile.performInterest && "performing", profile.productionInterest && "recording and production"].filter(Boolean).join(", ") || "Not said"}
                </dd>
                {data.availability.length > 0 && (
                  <>
                    <dt>Usually free</dt>
                    <dd>
                      {data.availability.map((a) => (
                        <div key={a.id}>
                          {WEEKDAYS[a.weekday]} {toTime(a.startMinute)}–{toTime(a.endMinute)} <span className="rw-st-muted">({a.timeZone.replace(/_/g, " ")})</span>
                        </div>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="rw-st-muted">{data.profileHidden ? "This student keeps their profile private." : "They haven't filled in a profile yet."}</p>
            )}
          </section>

          <section className="rw-st-card">
            <h2>Your private notes</h2>
            <label className="rw-st-field">
              <small>Only you see these. Not the student, not their guardian.</small>
              <textarea value={notes} onChange={(e) => (setNotes(e.target.value), setSaved(""))} maxLength={10000} style={{ minHeight: 140 }} aria-label="Your private notes" />
            </label>
            <div className="rw-st-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="rw-st-btn"
                data-tone="primary"
                onClick={async () => {
                  try {
                    await send(`/teacher/students/${id}/notes`, "PUT", { notes });
                    setSaved("Notes saved.");
                  } catch (err) {
                    setSaved(err.message);
                  }
                }}
              >
                Save notes
              </button>
              {saved && <span className="rw-st-ok">{saved}</span>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
