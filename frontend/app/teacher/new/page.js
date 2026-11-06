"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { useRouter, useSearchParams } from "next/navigation";
import { instruments, songLevels } from "@/lib/content";
import { parseClock, studentName, teacherRequest } from "@/lib/teaching";

const MAX_INSTRUCTION = 500;

export default function NewAssignmentPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p style={{ color: "var(--rw-meta)" }}>Loading…</p>}>
      <NewAssignment />
    </Suspense>
  );
}

function NewAssignment() {
  const router = useRouter();
  const params = useSearchParams();

  const [students, setStudents] = useState(null);
  const [content, setContent] = useState({ songs: [], lessons: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState("song");
  const [itemId, setItemId] = useState("");
  const [instrument, setInstrument] = useState("");
  const [level, setLevel] = useState(1);
  const [section, setSection] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [instruction, setInstruction] = useState("");

  // Work is set for the student's own instrument, the only part of a song they can open.
  function pickStudent(id, list = students) {
    setStudentId(id);
    const own = list?.find((s) => s.id === id)?.instrument;
    setInstrument(instruments.find((i) => i.name.toLowerCase() === (own || "").trim().toLowerCase())?.name || "");
  }

  useEffect(() => {
    const preselected = params.get("student") || "";
    Promise.all([teacherRequest("/teacher/students"), teacherRequest("/teacher/content")])
      .then(([s, c]) => {
        setStudents(s.students);
        setContent(c);
        if (preselected) pickStudent(preselected, s.students);
      })
      .catch((err) => {
        setError(err.message);
        setStudents([]);
      });
    // Runs once: the ?student= preselection only applies on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = kind === "song" ? content.songs : content.lessons;

  async function submit(e) {
    e.preventDefault();
    setError("");
    const sectionStart = kind === "song" ? parseClock(start) : null;
    const sectionEnd = kind === "song" ? parseClock(end) : null;
    if (Number.isNaN(sectionStart) || Number.isNaN(sectionEnd)) {
      setError("Write section times like 1:05.");
      return;
    }
    if (!instrument) {
      setError("This student has no instrument set yet. Ask the admin to set it first.");
      return;
    }

    setSaving(true);
    try {
      const { assignment } = await teacherRequest("/teacher/assignments", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          songId: kind === "song" ? itemId : undefined,
          lessonId: kind === "lesson" ? itemId : undefined,
          instrument,
          level,
          section,
          sectionStart,
          sectionEnd,
          instruction,
        }),
      });
      router.push(`/teacher/assignments/${assignment.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (students === null) return <p style={{ color: "var(--rw-meta)" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href="/teacher" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        <Icon name="arrow-left" size={14} /> Your students
      </Link>
      <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 28, color: "var(--rw-ink)", margin: "10px 0 20px" }}>Set practice work</h1>

      {students.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No students are linked to you yet. The school links students to teachers.</p>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 18 }}>
          <Field label="Student">
            <select value={studentId} onChange={(e) => pickStudent(e.target.value)} required style={input}>
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentName(s)}
                  {s.instrument ? ` · ${s.instrument}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={labelText}>Practise a</legend>
            <div style={{ display: "flex", gap: 8 }}>
              {["song", "lesson"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setItemId("");
                  }}
                  aria-pressed={kind === k}
                  style={chip(kind === k)}
                >
                  {k === "song" ? "Song" : "Lesson"}
                </button>
              ))}
            </div>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} required style={input} aria-label={kind}>
              <option value="">Choose a {kind}…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id} disabled={kind === "song" && !item.hasTracks}>
                  {item.title}
                  {item.artist ? ` · ${item.artist}` : ""}
                  {kind === "song" ? (item.hasTracks ? " (play-along)" : " (coming soon)") : ""}
                </option>
              ))}
            </select>
            {kind === "song" && (
              <span style={hint}>Students can record themselves on songs marked play-along and send you the take.</span>
            )}
          </fieldset>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Instrument">
              {/* Fixed to the student's own: students only open their instrument's part of a song. */}
              <input value={instrument || (studentId ? "Not set: ask the admin to set it" : "Choose a student first")} readOnly aria-readonly="true" style={{ ...input, color: instrument ? undefined : "var(--rw-meta)" }} />
            </Field>
            <Field label="Level">
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))} style={input}>
                {songLevels.map((l) => (
                  <option key={l.n} value={l.n}>
                    {l.n}. {l.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Section (optional)">
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              maxLength={80}
              placeholder="e.g. Chorus"
              style={input}
            />
          </Field>
          {kind === "song" && (
            <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Starts at (optional)">
                <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="0:45" style={input} />
              </Field>
              <Field label="Ends at">
                <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="1:10" style={input} />
              </Field>
              <span style={{ ...hint, gridColumn: "1 / -1", marginTop: -10 }}>
                With both times set, the phone app loops that part of the song for the student.
              </span>
            </div>
          )}

          <Field label="What to practise">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={MAX_INSTRUCTION}
              required
              rows={4}
              placeholder="e.g. Play the chorus chords at 75% until the changes are clean, then try full speed."
              style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
            />
            <span style={{ ...hint, textAlign: "right" }}>
              {instruction.length}/{MAX_INSTRUCTION}
            </span>
          </Field>

          {error && <p style={{ color: "var(--rw-orange-deep)", margin: 0, fontSize: 14 }}>{error}</p>}

          <div>
            <button type="submit" disabled={saving} style={primaryBtn}>
              {saving ? "Saving…" : "Set this work"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={labelText}>{label}</span>
      {children}
    </label>
  );
}

function chip(active) {
  return {
    padding: "8px 14px",
    borderRadius: "var(--rw-radius-sm)",
    border: `1px solid ${active ? "var(--rw-orange)" : "var(--rw-line)"}`,
    background: active ? "var(--rw-orange-tint)" : "#fff",
    color: "var(--rw-ink)",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };
}

const labelText = { fontSize: 13, fontWeight: 700, color: "var(--rw-ink)", padding: 0 };
const hint = { fontSize: 12.5, color: "var(--rw-meta)", lineHeight: 1.5 };
const input = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  boxSizing: "border-box",
};
const primaryBtn = {
  padding: "11px 20px",
  borderRadius: "var(--rw-radius-sm)",
  border: "none",
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
