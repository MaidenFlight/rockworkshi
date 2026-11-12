"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, send, STATUS } from "@/lib/meetings";

const DURATIONS = [30, 45, 60, 90, 120];

// Today in Hawaii, as "YYYY-MM-DD".
function hawaiiToday() {
  return new Date(Date.now() - 10 * 3600000).toISOString().slice(0, 10);
}

const EMPTY = { title: "Monthly sing-along", description: "", date: "", time: "16:00", durationMinutes: 60, repeat: "none", repeatUntil: "", classId: "", studentIds: [] };

export default function AdminMeetingsPage() {
  const [meetings, setMeetings] = useState(null);
  const [past, setPast] = useState(false);
  const [options, setOptions] = useState({ classes: [], students: [] });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // the meeting being edited
  const [scope, setScope] = useState("one");
  const [find, setFind] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api(`/admin/meetings${past ? "?scope=past" : ""}`)
        .then((d) => setMeetings(d.meetings))
        .catch((err) => (setError(err.message), setMeetings([]))),
    [past],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api("/admin/meetings/options").then(setOptions).catch((err) => setError(err.message));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));
  const picked = new Set(form.studentIds);
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return options.students.filter((p) => picked.has(p.id) || !q || `${p.name} ${p.email}`.toLowerCase().includes(q)).slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.students, find, form.studentIds]);

  function toggleStudent(id) {
    setForm((f) => ({ ...f, studentIds: f.studentIds.includes(id) ? f.studentIds.filter((x) => x !== id) : [...f.studentIds, id] }));
  }

  function body() {
    return {
      title: form.title,
      description: form.description,
      start: `${form.date}T${form.time}`,
      durationMinutes: Number(form.durationMinutes),
      repeat: form.repeat,
      repeatUntil: form.repeat === "monthly" ? form.repeatUntil : undefined,
      classId: form.classId || null,
      studentIds: form.studentIds,
    };
  }

  async function act(fn, done) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      setMessage(done(result));
      await load();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function schedule(e) {
    e.preventDefault();
    if (editing) {
      const { repeat, repeatUntil, ...changes } = body();
      act(
        () => send(`/admin/meetings/${editing.id}`, "PATCH", { ...changes, scope }),
        (r) => (r.changed > 1 ? `Saved ${r.changed} dates.` : "Saved. Anyone affected has been told."),
      ).then((r) => r && stopEditing());
      return;
    }
    act(
      () => send("/admin/meetings", "POST", body()),
      (r) => `Scheduled ${r.meetings.length === 1 ? "it" : `${r.meetings.length} monthly dates`}. ${r.invited} ${r.invited === 1 ? "student was" : "students were"} invited, with their guardians told.`,
    ).then((r) => r && setForm(EMPTY));
  }

  function startNow() {
    const { title, description, durationMinutes, classId, studentIds } = body();
    act(
      () => send("/admin/meetings/now", "POST", { title, description, durationMinutes, classId, studentIds }),
      () => "It's live. Open the host view to run it.",
    ).then((r) => r && (window.location.href = `/admin/meetings/${r.meeting.id}/host`));
  }

  async function edit(m) {
    setError("");
    const { meeting } = await api(`/admin/meetings/${m.id}`);
    const [date, time] = meeting.startLocal.split("T");
    setEditing(meeting);
    setScope("one");
    setForm({
      title: meeting.title,
      description: meeting.description || "",
      date,
      time,
      durationMinutes: meeting.durationMinutes,
      repeat: "none",
      repeatUntil: "",
      classId: meeting.classId || "",
      studentIds: meeting.studentIds,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stopEditing() {
    setEditing(null);
    setForm(EMPTY);
  }

  function cancel(m, series) {
    const what = series ? `"${m.title}" on ${m.when} and every later date` : `"${m.title}" on ${m.when}`;
    if (!window.confirm(`Cancel ${what}? Everyone invited is told.`)) return;
    act(
      () => send(`/admin/meetings/${m.id}/cancel`, "POST", { scope: series ? "series" : "one" }),
      (r) => `Cancelled ${r.cancelled === 1 ? "it" : `${r.cancelled} dates`}. Everyone invited has been told.`,
    );
  }

  function start(m) {
    act(() => send(`/admin/meetings/${m.id}/start`, "POST"), () => "It's live. Open the host view to run it.");
  }

  function end(m) {
    if (!window.confirm(`End "${m.title}" for everyone?`)) return;
    act(() => send(`/admin/meetings/${m.id}/end`, "POST"), () => "Ended. Everyone in the room was sent out.");
  }

  return (
    <div className="rw-st">
      <div>
        <h1 className="rw-st-title">Meetings</h1>
        <p className="rw-st-lead">
          Live sing-alongs on the site. Invite a class or students; they and their guardians are told, reminded a day and 15
          minutes before, and see a Join button once you start. Times are Hawaii time.
        </p>
      </div>

      <form className="rw-st-card rw-st-form" onSubmit={schedule} aria-labelledby="meeting-form">
        <h2 id="meeting-form" className="rw-st-h2">
          {editing ? `Edit: ${editing.title}` : "Schedule a meeting"}
        </h2>
        <label className="rw-st-field">
          Name
          <input value={form.title} onChange={set("title")} maxLength={120} required />
        </label>
        <label className="rw-st-field">
          Note for families <small>(optional)</small>
          <textarea value={form.description} onChange={set("description")} maxLength={2000} rows={2} />
        </label>
        <div className="rw-st-row">
          <label className="rw-st-field">
            Date
            <input type="date" value={form.date} min={hawaiiToday()} onChange={set("date")} required />
          </label>
          <label className="rw-st-field">
            Time <small>(Hawaii)</small>
            <input type="time" value={form.time} onChange={set("time")} required />
          </label>
          <label className="rw-st-field">
            Length
            <select value={form.durationMinutes} onChange={set("durationMinutes")}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} minutes` : d === 60 ? "1 hour" : `${d / 60} hours`}
                </option>
              ))}
            </select>
          </label>
          {!editing && (
            <label className="rw-st-field">
              Repeats
              <select value={form.repeat} onChange={set("repeat")}>
                <option value="none">Just once</option>
                <option value="monthly">Every month, same day</option>
              </select>
            </label>
          )}
          {!editing && form.repeat === "monthly" && (
            <label className="rw-st-field">
              Until <small>(up to a year)</small>
              <input type="date" value={form.repeatUntil} min={form.date || hawaiiToday()} onChange={set("repeatUntil")} required />
            </label>
          )}
          {editing?.seriesId && (
            <label className="rw-st-field">
              Apply to
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="one">Only this date</option>
                <option value="series">This and later dates (same time of day)</option>
              </select>
            </label>
          )}
        </div>

        <fieldset className="rw-st-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Who&apos;s invited</legend>
          <select value={form.classId} onChange={set("classId")} aria-label="Invite a class">
            <option value="">No class, only the students ticked below</option>
            {options.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.enrolled} enrolled)
              </option>
            ))}
          </select>
          <input
            className="rw-st-input"
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find students by name or email"
            aria-label="Find students"
            style={{ marginTop: 8 }}
          />
          <div className="rw-st-checks" style={{ marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
            {shown.map((p) => (
              <label key={p.id} className="rw-st-check">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggleStudent(p.id)} />
                {p.name || p.email}
              </label>
            ))}
            {!shown.length && <span className="rw-st-muted">No students match.</span>}
          </div>
          <small className="rw-st-muted">
            {form.classId ? "Everyone enrolled in the class, " : ""}
            {form.studentIds.length} {form.studentIds.length === 1 ? "student" : "students"} ticked. Guardians of invited students are told too.
          </small>
        </fieldset>

        {error && (
          <p className="rw-st-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="rw-st-ok" role="status">
            {message}
          </p>
        )}
        <div className="rw-st-actions">
          <button type="submit" className="rw-st-btn" data-tone="primary" disabled={busy}>
            {editing ? "Save changes" : "Schedule"}
          </button>
          {editing ? (
            <button type="button" className="rw-st-btn" data-tone="quiet" onClick={stopEditing}>
              Stop editing
            </button>
          ) : (
            <button type="button" className="rw-st-btn" onClick={startNow} disabled={busy || !form.title}>
              Start now instead
            </button>
          )}
        </div>
      </form>

      <div className="rw-st-tabs" role="tablist">
        <button type="button" className="rw-st-tab" role="tab" aria-selected={!past} aria-current={!past ? "page" : undefined} onClick={() => setPast(false)}>
          Upcoming
        </button>
        <button type="button" className="rw-st-tab" role="tab" aria-selected={past} aria-current={past ? "page" : undefined} onClick={() => setPast(true)}>
          Past and cancelled
        </button>
      </div>

      {meetings === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : meetings.length === 0 ? (
        <div className="rw-st-empty">
          <strong>{past ? "Nothing yet" : "No meetings coming up"}</strong>
          {past ? "Meetings that are over show here." : "Schedule one above."}
        </div>
      ) : (
        <div className="rw-st-table-wrap">
          <table className="rw-st-table">
            <thead>
              <tr>
                <th>Meeting</th>
                <th>When (Hawaii)</th>
                <th>Invited</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.title}</strong>
                    <div>
                      <span className="rw-st-chip" data-tone={STATUS[m.status]?.tone}>
                        {STATUS[m.status]?.label}
                      </span>
                      {m.seriesId && <span className="rw-st-muted"> Monthly</span>}
                    </div>
                  </td>
                  <td>{m.when}</td>
                  <td>
                    {m.invitedCount}
                    {m.className && <div className="rw-st-muted">{m.className}</div>}
                  </td>
                  <td>
                    <div className="rw-st-actions" style={{ justifyContent: "flex-end" }}>
                      {m.status === "live" && (
                        <>
                          <Link className="rw-st-btn" data-tone="primary" data-size="small" href={`/admin/meetings/${m.id}/host`}>
                            Host view
                          </Link>
                          <button type="button" className="rw-st-btn" data-size="small" onClick={() => end(m)} disabled={busy}>
                            End
                          </button>
                        </>
                      )}
                      {m.status === "scheduled" && (
                        <>
                          <button type="button" className="rw-st-btn" data-size="small" onClick={() => start(m)} disabled={busy}>
                            Start
                          </button>
                          <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => edit(m)} disabled={busy}>
                            Edit
                          </button>
                          <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => cancel(m, false)} disabled={busy}>
                            {m.seriesId ? "Cancel date" : "Cancel"}
                          </button>
                          {m.seriesId && (
                            <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => cancel(m, true)} disabled={busy}>
                              Cancel rest
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
