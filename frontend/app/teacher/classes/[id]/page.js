"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ClassForm, { saveClass } from "@/components/studio/ClassForm";
import { ATTENDANCE, api, kindLabel, localDate, repeatText, send, toMinutes, toTime, viewerZone, when } from "@/lib/studio";

export default function ClassPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [now] = useState(() => Date.now());

  const load = useCallback(
    () =>
      api(`/teacher/classes/${id}`)
        .then((d) => (setData(d), setError("")))
        .catch((err) => setError(err.message)),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <p className="rw-st-error">{error}</p>;
  if (!data) return <p className="rw-st-muted">Loading…</p>;

  const c = data.class;
  const upcoming = data.occurrences.filter((o) => new Date(o.endsAt).getTime() >= now);
  const past = data.occurrences.filter((o) => new Date(o.endsAt).getTime() < now).reverse();
  const enrolled = data.roster.filter((r) => r.status === "enrolled");
  const waiting = data.roster.filter((r) => r.status === "waitlisted");

  async function act(fn) {
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rw-st">
      <div>
        <Link href="/teacher/classes" className="rw-st-muted">
          ← Classes
        </Link>
        <div className="rw-st-head" style={{ marginTop: 6 }}>
          <div>
            <h1 className="rw-st-title">{c.title}</h1>
            <p className="rw-st-lead">
              {kindLabel(c.kind)} · {repeatText(c)} · {toTime(c.startMinute)} for {c.durationMinutes} min, {c.timeZone.replace(/_/g, " ")}
              {c.status !== "active" && (
                <span className="rw-st-chip" data-tone="red" style={{ marginLeft: 8 }}>
                  Cancelled
                </span>
              )}
            </p>
          </div>
          {c.status === "active" && (
            <div className="rw-st-actions">
              <Link href={`/teacher/plans/new?class=${c.id}`} className="rw-st-btn" data-tone="primary">
                Plan a month for this class
              </Link>
              <button type="button" className="rw-st-btn" onClick={() => setEditing(!editing)} aria-expanded={editing}>
                {editing ? "Close editing" : "Edit class"}
              </button>
              <button
                type="button"
                className="rw-st-btn"
                onClick={() => act(async () => router.push(`/teacher/classes/${(await send(`/teacher/classes/${c.id}/duplicate`, "POST", {})).class.id}`))}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="rw-st-btn"
                data-tone="quiet"
                onClick={() => window.confirm("Cancel every future session of this class? Past sessions and attendance stay.") && act(() => send(`/teacher/classes/${c.id}/cancel`, "POST", {}))}
              >
                Cancel class
              </button>
            </div>
          )}
        </div>
      </div>
      {error && <p className="rw-st-error" role="alert">{error}</p>}

      {editing && (
        <div className="rw-st-card">
          <h2>Edit class</h2>
          <ClassForm
            initial={c}
            onSave={async (body) => {
              await saveClass(`/teacher/classes/${c.id}`, "PATCH", body);
              setEditing(false);
              await load();
            }}
          />
          <p className="rw-st-muted" style={{ marginTop: 10 }}>
            Changing the time updates future sessions. Sessions you moved or cancelled, and ones with attendance taken, stay as they are.
          </p>
        </div>
      )}

      <div className="rw-st-two">
        <section className="rw-st-card" aria-labelledby="sessions">
          <h2 id="sessions">Sessions</h2>
          {upcoming.length === 0 ? (
            <p className="rw-st-muted">No sessions ahead.</p>
          ) : (
            <div className="rw-sessions">
              {upcoming.map((o) => (
                <Session key={o.id} o={o} c={c} enrolled={enrolled} act={act} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button type="button" className="rw-st-btn" data-size="small" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
                {showPast ? "Hide past sessions" : `Past sessions (${past.length})`}
              </button>
              {showPast && (
                <div className="rw-sessions" style={{ marginTop: 10 }}>
                  {past.map((o) => (
                    <Session key={o.id} o={o} c={c} enrolled={enrolled} act={act} past />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div style={{ display: "grid", gap: 16 }}>
          <section className="rw-st-card" aria-labelledby="roster">
            <h2 id="roster">
              Students {c.capacity ? `(${enrolled.length} of ${c.capacity})` : `(${enrolled.length})`}
            </h2>
            {enrolled.length === 0 ? (
              <p className="rw-st-muted">Nobody is enrolled yet. The school office enrols students in classes.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                {enrolled.map((s) => (
                  <li key={s.id}>
                    <Link href={`/teacher/students/${s.id}`}>{s.name || "Student"}</Link>
                    {s.instrument ? <span className="rw-st-muted"> · {s.instrument}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {waiting.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: "14px 0 6px" }}>Waitlist</h3>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {waiting.map((s) => (
                    <li key={s.id}>{s.name || "Student"}</li>
                  ))}
                </ol>
                <p className="rw-st-muted" style={{ marginTop: 6 }}>
                  When a place frees up, the first person waiting moves in.
                </p>
              </>
            )}
          </section>
          <section className="rw-st-card">
            <h2>Details</h2>
            <dl className="rw-st-dl">
              {c.instruments.length > 0 && (
                <>
                  <dt>Instruments</dt>
                  <dd>{c.instruments.join(", ")}</dd>
                </>
              )}
              {c.level && (
                <>
                  <dt>Level</dt>
                  <dd>{c.level}</dd>
                </>
              )}
              {c.topics && (
                <>
                  <dt>Topics</dt>
                  <dd>{c.topics}</dd>
                </>
              )}
              {c.song && (
                <>
                  <dt>Song</dt>
                  <dd>{c.song.title}</dd>
                </>
              )}
              <dt>Meeting</dt>
              <dd>
                {c.meetingUrl ? (
                  <a href={c.meetingUrl} target="_blank" rel="noreferrer">
                    {c.meetingUrl}
                  </a>
                ) : (
                  "No link yet"
                )}
              </dd>
            </dl>
            {c.description && <p style={{ fontSize: 14, whiteSpace: "pre-wrap", marginBottom: 0 }}>{c.description}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Session({ o, c, enrolled, act, past = false }) {
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(localDate(o.startsAt, c.timeZone));
  const [time, setTime] = useState(() => new Date(o.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: c.timeZone }));
  const [clash, setClash] = useState(null);
  const [marking, setMarking] = useState(false);
  const [marks, setMarks] = useState(o.attendance || {});
  const [notes, setNotes] = useState(o.notes || "");
  const [saved, setSaved] = useState("");
  const cancelled = o.status === "cancelled";
  const viewerDiffers = c.timeZone !== viewerZone();

  async function move(allowConflicts = false) {
    setClash(null);
    try {
      await send(`/teacher/occurrences/${o.id}/move`, "POST", { date, startMinute: toMinutes(time), allowConflicts });
      setMoving(false);
      await act(async () => {});
    } catch (err) {
      setClash(err.message);
    }
  }

  return (
    <div className="rw-session" id={`session-${o.id}`} data-past={past ? "true" : undefined} data-session={o.id}>
      <div className="rw-session-head">
        <strong>{when(o.startsAt, c.timeZone, { withZone: viewerDiffers })}</strong>
        {viewerDiffers && <span className="rw-st-muted">({when(o.startsAt)} your time)</span>}
        {cancelled ? <span className="rw-st-chip" data-tone="red">Cancelled</span> : o.moved ? <span className="rw-st-chip" data-tone="warn">Moved</span> : null}
        {Object.keys(o.attendance || {}).length > 0 && <span className="rw-st-chip" data-tone="good">Attendance taken</span>}
        <div className="rw-st-actions">
          {!past && !cancelled && (
            <>
              <button type="button" className="rw-st-btn" data-size="small" onClick={() => setMoving(!moving)} aria-expanded={moving}>
                Move
              </button>
              <button type="button" className="rw-st-btn" data-size="small" onClick={() => act(() => send(`/teacher/occurrences/${o.id}/cancel`, "POST", {}))}>
                Cancel
              </button>
            </>
          )}
          {!past && cancelled && c.status === "active" && (
            <button type="button" className="rw-st-btn" data-size="small" onClick={() => act(() => send(`/teacher/occurrences/${o.id}/restore`, "POST", { allowConflicts: true }))}>
              Restore
            </button>
          )}
          {!cancelled && enrolled.length > 0 && (
            <button type="button" className="rw-st-btn" data-size="small" onClick={() => setMarking(!marking)} aria-expanded={marking}>
              Attendance
            </button>
          )}
        </div>
      </div>

      {moving && (
        <div className="rw-st-actions">
          <label className="rw-st-field">
            New date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="rw-st-field">
            Time ({c.timeZone.replace(/_/g, " ")})
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={300} />
          </label>
          <button type="button" className="rw-st-btn" data-tone="primary" onClick={() => move(false)} style={{ alignSelf: "end" }}>
            Move session
          </button>
          {clash && (
            <>
              <p className="rw-st-error" style={{ flexBasis: "100%" }}>
                {clash}
              </p>
              <button type="button" className="rw-st-btn" onClick={() => move(true)}>
                Move it anyway
              </button>
            </>
          )}
        </div>
      )}

      {marking && (
        <div className="rw-attendance" role="group" aria-label="Attendance">
          {enrolled.map((s) => (
            <div key={s.id} className="rw-attendance-row">
              <span>{s.name || "Student"}</span>
              {ATTENDANCE.map((a) => (
                <label key={a.id} className="rw-st-check">
                  <input type="radio" name={`att-${o.id}-${s.id}`} checked={marks[s.id] === a.id} onChange={() => setMarks({ ...marks, [s.id]: a.id })} />
                  {a.label}
                </label>
              ))}
            </div>
          ))}
          <label className="rw-st-field">
            Private lesson notes <small>Only you see these</small>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
          </label>
          <div className="rw-st-actions">
            <button
              type="button"
              className="rw-st-btn"
              data-tone="primary"
              onClick={async () => {
                const entries = Object.entries(marks).map(([userId, status]) => ({ userId, status }));
                await act(async () => {
                  if (entries.length) await send(`/teacher/occurrences/${o.id}/attendance`, "PUT", { entries });
                  await send(`/teacher/occurrences/${o.id}/notes`, "PUT", { notes });
                });
                setSaved("Saved.");
              }}
            >
              Save attendance and notes
            </button>
            {saved && <span className="rw-st-ok">{saved}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
