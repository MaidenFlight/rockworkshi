"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { INSTRUMENTS, KINDS, addDays, api, localDate, toMinutes, toTime, viewerZone, when, zoneChoices } from "@/lib/studio";

const BLANK = {
  kind: "lesson",
  title: "",
  description: "",
  level: "",
  topics: "",
  instruments: [],
  capacity: "",
  timeZone: "Pacific/Honolulu",
  firstDate: "",
  time: "16:00",
  durationMinutes: 45,
  repeat: "none",
  repeatUntil: "",
  meetingUrl: "",
  songId: "",
};

// Creating or editing a class. When the new time clashes with something the teacher already
// teaches, the API answers with the clashes, which are shown here with a way to go ahead anyway.
export default function ClassForm({ initial = null, onSave, saveLabel = "Save class" }) {
  const [form, setForm] = useState(() =>
    initial
      ? { ...BLANK, ...initial, capacity: initial.capacity ?? "", repeatUntil: initial.repeatUntil ?? "", meetingUrl: initial.meetingUrl ?? "", songId: initial.songId ?? "", description: initial.description ?? "", level: initial.level ?? "", topics: initial.topics ?? "", time: toTime(initial.startMinute) }
      : { ...BLANK, firstDate: addDays(localDate(new Date(), viewerZone()), 7), timeZone: zoneChoices()[0] }
  );
  const [songs, setSongs] = useState([]);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/teacher/content").then((d) => setSongs(d.songs || [])).catch(() => setSongs([]));
  }, []);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setConflicts(null);
  };

  async function submit(e, allowConflicts = false) {
    e?.preventDefault();
    setError("");
    const startMinute = toMinutes(form.time);
    if (startMinute === null) return setError("Choose a start time.");
    const body = {
      kind: form.kind,
      title: form.title,
      description: form.description || null,
      level: form.level || null,
      topics: form.topics || null,
      instruments: form.instruments,
      capacity: form.capacity === "" ? null : Number(form.capacity),
      timeZone: form.timeZone,
      firstDate: form.firstDate,
      startMinute,
      durationMinutes: Number(form.durationMinutes),
      repeat: form.repeat,
      repeatUntil: form.repeat === "none" ? null : form.repeatUntil || null,
      meetingUrl: form.meetingUrl || null,
      songId: form.songId || null,
      allowConflicts,
    };
    setSaving(true);
    try {
      await onSave(body);
    } catch (err) {
      if (err.conflicts) setConflicts(err.conflicts);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const toggleInstrument = (i) => set({ instruments: form.instruments.includes(i) ? form.instruments.filter((x) => x !== i) : [...form.instruments, i] });

  return (
    <form className="rw-st-form" onSubmit={submit}>
      <div className="rw-st-row">
        <label className="rw-st-field">
          Kind of class
          <select value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rw-st-field" style={{ gridColumn: "span 2" }}>
          Title
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={120} placeholder="e.g. Saturday rock band basics" />
        </label>
      </div>

      <label className="rw-st-field">
        Description <small>What students will do and bring</small>
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} />
      </label>

      <fieldset className="rw-st-field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ marginBottom: 6 }}>Instruments</legend>
        <div className="rw-st-checks">
          {INSTRUMENTS.map((i) => (
            <label key={i} className="rw-st-check">
              <input type="checkbox" checked={form.instruments.includes(i)} onChange={() => toggleInstrument(i)} />
              {i}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rw-st-row">
        <label className="rw-st-field">
          Level <small>e.g. Beginner</small>
          <input value={form.level} onChange={(e) => set({ level: e.target.value })} maxLength={40} />
        </label>
        <label className="rw-st-field">
          Topics <small>Chords, timing, soloing…</small>
          <input value={form.topics} onChange={(e) => set({ topics: e.target.value })} maxLength={300} />
        </label>
        <label className="rw-st-field">
          Places <small>Empty for no limit</small>
          <input type="number" min={1} max={200} value={form.capacity} onChange={(e) => set({ capacity: e.target.value })} />
        </label>
      </div>

      <div className="rw-st-row">
        <label className="rw-st-field">
          {form.repeat === "none" ? "Date" : "First date"}
          <input type="date" value={form.firstDate} onChange={(e) => set({ firstDate: e.target.value })} required />
        </label>
        <label className="rw-st-field">
          Start time
          <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} required step={300} />
        </label>
        <label className="rw-st-field">
          Length (minutes)
          <input type="number" min={5} max={480} step={5} value={form.durationMinutes} onChange={(e) => set({ durationMinutes: e.target.value })} required />
        </label>
        <label className="rw-st-field">
          Time zone
          <select value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
            {[...new Set([form.timeZone, ...zoneChoices()])].map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rw-st-row">
        <label className="rw-st-field">
          Repeats
          <select value={form.repeat} onChange={(e) => set({ repeat: e.target.value })}>
            <option value="none">Doesn&apos;t repeat</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month, same date</option>
          </select>
        </label>
        {form.repeat !== "none" && (
          <label className="rw-st-field">
            Until
            <input type="date" value={form.repeatUntil} min={form.firstDate} onChange={(e) => set({ repeatUntil: e.target.value })} required />
          </label>
        )}
        <label className="rw-st-field">
          Song to work on <small>Optional</small>
          <select value={form.songId} onChange={(e) => set({ songId: e.target.value })}>
            <option value="">None</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="rw-st-field">
        Meeting link <small>Paste the Google Meet (or other) link students will join. Only students with a place see it.</small>
        <input type="url" value={form.meetingUrl} onChange={(e) => set({ meetingUrl: e.target.value })} placeholder="https://meet.google.com/…" pattern="https://.*" />
      </label>

      {error && (
        <div role="alert" className="rw-st-card" style={{ borderColor: "var(--rw-orange)" }}>
          <p className="rw-st-error">{error}</p>
          {conflicts && (
            <>
              <ul style={{ margin: "8px 0", paddingLeft: 18, fontSize: 14 }}>
                {conflicts.map((c) => (
                  <li key={c.occurrenceId}>
                    {c.title}, {when(c.startsAt)}
                  </li>
                ))}
              </ul>
              <button type="button" className="rw-st-btn" onClick={() => submit(null, true)} disabled={saving}>
                Schedule it anyway
              </button>
            </>
          )}
        </div>
      )}

      <div className="rw-st-actions">
        <button type="submit" className="rw-st-btn" data-tone="primary" disabled={saving}>
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </form>
  );
}

// Sends a class and turns a 409 clash into an error the form can show.
export async function saveClass(path, method, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.conflicts = data.conflicts;
    throw err;
  }
  return data;
}
