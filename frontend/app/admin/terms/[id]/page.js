"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { useParams, useRouter } from "next/navigation";
import { pill, slotStatus, termRequest } from "@/lib/terms";

export default function AdminTerm() {
  const { id } = useParams();
  const router = useRouter();
  const [group, setGroup] = useState(undefined); // undefined loading, null failed
  const [songs, setSongs] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      termRequest(`/admin/terms/${id}`),
      termRequest("/admin/songs"),
      termRequest("/admin/lessons"),
      // Everyone, for the add-a-student picker.
      termRequest("/admin/teaching"),
    ])
      .then(([g, s, l, p]) => {
        setGroup(g.group);
        setSongs(s.songs);
        setLessons(l.lessons);
        setPeople(p.people);
      })
      .catch((err) => {
        setError(err.message);
        setGroup(null);
      });
  }, [id]);

  // Every change returns the whole group, so the page always shows what the server saved.
  async function change(path, options, done) {
    setError("");
    setMessage("");
    try {
      const data = await termRequest(path, options);
      if (data.group) setGroup(data.group);
      if (done) setMessage(done);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  if (group === undefined) return <p style={{ color: "var(--rw-meta)" }}>Loading…</p>;
  if (!group) {
    return (
      <p role="alert" style={{ color: "var(--rw-orange-deep)" }}>
        {error || "Term not found."} <Link href="/admin/terms">Back to terms</Link>
      </p>
    );
  }

  const memberIds = new Set(group.members.map((m) => m.id));

  return (
    <div>
      <Link href="/admin/terms" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        <Icon name="arrow-left" size={14} /> Terms
      </Link>
      <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 24, color: "var(--rw-ink)", margin: "8px 0 4px" }}>{group.name}</h1>
      <p style={{ color: "var(--rw-meta)", fontSize: 13.5, margin: "0 0 18px" }}>{group.period}</p>

      {error && (
        <p role="alert" style={{ ...banner, background: "var(--rw-orange-tint)" }}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" style={banner}>
          {message}
        </p>
      )}

      <Details group={group} onSave={(body) => change(`/admin/terms/${id}`, { method: "PUT", body: JSON.stringify(body) }, "Term saved.")} />

      <h2 style={h2}>Monthly songs</h2>
      <p style={{ fontSize: 13, color: "var(--rw-meta)", margin: "-6px 0 12px", lineHeight: 1.5 }}>
        Students only see a month&apos;s song once its unlock time (Honolulu) has passed and it&apos;s published. Before
        that they see the date, or &ldquo;Your next song is being prepared&rdquo; if the date passes first.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {group.slots.map((slot) => (
          <SlotEditor
            key={`${slot.month}-${slot.song?.id}-${slot.unlockAtLocal}-${slot.lesson?.id}`}
            slot={slot}
            songs={songs}
            lessons={lessons}
            onSave={(body, done) => change(`/admin/terms/${id}/slots/${slot.month}`, { method: "PUT", body: JSON.stringify(body) }, done)}
            onSetupFirstSong={() => change(`/admin/terms/${id}/setup-first-song`, { method: "POST" }, "Month 1 now uses “Have You Ever Seen the Rain”. It's still a draft.")}
          />
        ))}
      </div>

      <h2 style={h2}>Students ({group.members.length})</h2>
      <Members
        members={group.members}
        candidates={people.filter((p) => !memberIds.has(p.id))}
        onAdd={(userId) => change(`/admin/terms/${id}/members`, { method: "POST", body: JSON.stringify({ userIds: [userId] }) }, "Student added.")}
        onRemove={async (userId) => {
          if (await change(`/admin/terms/${id}/members/${userId}`, { method: "DELETE" }, "Student removed.")) {
            setGroup((g) => ({ ...g, members: g.members.filter((m) => m.id !== userId) }));
          }
        }}
      />

      <div style={{ borderTop: "1px solid var(--rw-border)", marginTop: 32, paddingTop: 14 }}>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Delete ${group.name}? Students keep the songs that have already opened for them; months that haven't opened are gone.`)) return;
            if (await change(`/admin/terms/${id}`, { method: "DELETE" })) router.push("/admin/terms");
          }}
          style={{ ...small, color: "var(--rw-orange-deep)" }}
        >
          Delete this term
        </button>
      </div>
    </div>
  );
}

function Details({ group, onSave }) {
  const [form, setForm] = useState({ name: group.name, startDate: group.startDate, endDate: group.endDate });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}
    >
      <label style={{ ...field, flex: "2 1 220px" }}>
        Name
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required style={input} />
      </label>
      <label style={field}>
        Starts
        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required style={input} />
      </label>
      <label style={field}>
        Ends
        <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required style={input} />
      </label>
      <button type="submit" style={small}>
        Save details
      </button>
      <span style={{ flexBasis: "100%", fontSize: 12, color: "var(--rw-meta)" }}>
        Changing the term dates doesn&apos;t move the monthly unlock dates below.
      </span>
    </form>
  );
}

function SlotEditor({ slot, songs, lessons, onSave, onSetupFirstSong }) {
  const [unlock, setUnlock] = useState(slot.unlockAtLocal);
  const [songId, setSongId] = useState(slot.song?.id || "");
  const [lessonId, setLessonId] = useState(slot.lesson?.id || "");
  const status = slotStatus(slot);
  const dirty = unlock !== slot.unlockAtLocal || songId !== (slot.song?.id || "") || lessonId !== (slot.lesson?.id || "");
  const blocking = slot.warnings.filter((w) => w.blocking);

  return (
    <section aria-label={`Month ${slot.month}`} style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ color: "var(--rw-ink)" }}>Month {slot.month}</strong>
        <span style={pill(status.tone)}>{status.label}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={field}>
          Unlocks (Honolulu time)
          <input type="datetime-local" value={unlock} onChange={(e) => setUnlock(e.target.value)} required style={input} />
        </label>
        <label style={{ ...field, flex: "2 1 220px" }}>
          Song
          <select value={songId} onChange={(e) => setSongId(e.target.value)} style={input}>
            <option value="">Not chosen yet</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.artist ? ` · ${s.artist}` : ""}
                {s.published ? "" : " (hidden)"}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...field, flex: "2 1 200px" }}>
          Lesson (optional)
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={input}>
            <option value="">None</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--rw-meta)", margin: "8px 0" }}>Currently unlocks {slot.unlockAtDisplay}.</div>

      {slot.warnings.length > 0 && (
        <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, color: "var(--rw-body)" }}>
          {slot.warnings.map((w) => (
            <li key={w.text} style={{ color: w.blocking ? "var(--rw-orange-deep)" : "var(--rw-body)" }}>
              {w.blocking ? "Must fix before publishing: " : "Check: "}
              {w.text}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => onSave({ unlockAtLocal: unlock, songId: songId || null, lessonId: lessonId || null }, `Month ${slot.month} saved.`)}
          style={small}
        >
          {slot.published ? "Save changes (stays published)" : "Save draft"}
        </button>
        {slot.published ? (
          <button type="button" onClick={() => onSave({ published: false }, `Month ${slot.month} is back in draft.`)} style={small}>
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            disabled={dirty || blocking.length > 0}
            title={dirty ? "Save your changes first" : blocking.length ? "Fix the warnings first" : undefined}
            onClick={() => onSave({ published: true }, `Month ${slot.month} published. Students see it from ${slot.unlockAtDisplay}.`)}
            style={{ ...small, background: "var(--rw-orange)", color: "#fff", border: "1px solid var(--rw-orange)" }}
          >
            Publish
          </button>
        )}
        {slot.month === 1 && !slot.song && (
          <button type="button" onClick={onSetupFirstSong} style={small}>
            Use “Have You Ever Seen the Rain” (CCR)
          </button>
        )}
      </div>
    </section>
  );
}

function Members({ members, candidates, onAdd, onRemove }) {
  const [adding, setAdding] = useState("");
  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      {members.length === 0 && <span style={{ fontSize: 13, color: "var(--rw-meta)" }}>No students in this term yet.</span>}
      {members.map((m) => (
        <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: 13.5, color: "var(--rw-ink)" }}>
            <strong>{m.name || m.email}</strong> · {m.email}
            {m.instrument ? ` · ${m.instrument}` : ""}
            {!m.paid && <span style={{ color: "var(--rw-orange-deep)" }}> · membership not active</span>}
          </span>
          <button type="button" onClick={() => onRemove(m.id)} style={small} aria-label={`Remove ${m.name || m.email}`}>
            Remove
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Student to add" style={{ ...input, flex: "1 1 260px" }}>
          <option value="">Add a student…</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "No name"} · {p.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!adding}
          onClick={async () => {
            if (await onAdd(adding)) setAdding("");
          }}
          style={small}
        >
          Add to term
        </button>
      </div>
    </div>
  );
}

const h2 = { fontWeight: 800, textTransform: "uppercase", fontSize: 18, color: "var(--rw-ink)", margin: "28px 0 12px" };
const card = { border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)", background: "var(--rw-surface)", padding: "14px 16px" };
const banner = { padding: "10px 12px", borderRadius: "var(--rw-radius-sm)", border: "1px solid var(--rw-border)", background: "var(--rw-sand)", fontSize: 13.5, color: "var(--rw-ink)" };
const field = { display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--rw-ink)" };
const input = { padding: "8px 10px", borderRadius: "var(--rw-radius-sm)", border: "1px solid var(--rw-line)", fontSize: 13.5, fontFamily: "inherit", background: "#fff" };
const small = {
  padding: "7px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
