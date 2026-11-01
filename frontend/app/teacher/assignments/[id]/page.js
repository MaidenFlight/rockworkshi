"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import StemPlayer from "@/components/member/StemPlayer";
import {
  STATUS_LABELS,
  contentTitle,
  formatClock,
  formatDate,
  partForInstrument,
  studentName,
  teacherRequest,
} from "@/lib/teaching";

const MAX_FEEDBACK = 2000;

export default function ReviewAssignment() {
  const { id } = useParams();
  const router = useRouter();
  // undefined = loading, null = failed (see error)
  const [assignment, setAssignment] = useState(undefined);
  const [tracks, setTracks] = useState(null);
  const [mixLevel, setMixLevel] = useState(null);
  const [listeningTo, setListeningTo] = useState(null); // submission id playing with the band
  const [error, setError] = useState("");

  function load() {
    return teacherRequest(`/teacher/assignments/${id}`)
      .then(({ assignment: a }) => {
        setAssignment(a);
        // The band is only needed to hear a recording in context.
        if (a.song && a.submissions.some((s) => s.recording)) {
          teacherRequest(`/songs/${a.song.id}/tracks`)
            .then((data) => {
              setTracks(data.tracks);
              setMixLevel(data.mixLevel);
            })
            .catch(() => setTracks(null));
        }
      })
      .catch((err) => {
        setError(err.message);
        setAssignment(null);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Updates the one submission in place. Reloading would re-sign the recording links
  // and make an open band player download every stem again.
  function applyFeedback(saved, isLatest) {
    setAssignment((current) => ({
      ...current,
      status: isLatest ? "reviewed" : current.status,
      submissions: current.submissions.map((s) =>
        s.id === saved.id ? { ...s, feedback: saved.feedback, reviewedAt: saved.reviewedAt } : s
      ),
    }));
  }

  async function remove() {
    if (!window.confirm("Delete this practice work, the student's recordings and your feedback?")) return;
    try {
      await teacherRequest(`/teacher/assignments/${id}`, { method: "DELETE" });
      router.push("/teacher");
    } catch (err) {
      setError(err.message);
    }
  }

  if (assignment === undefined) return <p style={{ color: "var(--rw-meta)" }}>Loading…</p>;
  if (!assignment) {
    return (
      <p style={{ color: "var(--rw-body)" }}>
        {error || "Not found."}{" "}
        <Link href="/teacher" style={{ color: "var(--rw-orange-deep)" }}>
          Back to your students
        </Link>
      </p>
    );
  }

  const a = assignment;
  const times =
    a.sectionStart !== null && a.sectionEnd !== null ? ` (${formatClock(a.sectionStart)}–${formatClock(a.sectionEnd)})` : "";

  return (
    <div style={{ maxWidth: 800 }}>
      <Link href="/teacher" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        &larr; Your students
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", margin: "10px 0 18px" }}>
        <div>
          <div style={eyebrow}>{studentName(a.student)}</div>
          <h1 style={{ fontWeight: 600, fontSize: 28, color: "var(--rw-ink)", margin: "6px 0 4px" }}>{contentTitle(a)}</h1>
          <div style={{ color: "var(--rw-meta)", fontSize: 14 }}>
            {a.instrument} · Level {a.level} {a.levelName}
            {a.section || times ? ` · ${a.section || "Section"}${times}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rw-body)", whiteSpace: "nowrap", marginTop: 6 }}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>

      <div style={{ ...card, marginBottom: 28 }}>
        <div style={label}>What to practise</div>
        <p style={{ margin: 0, color: "var(--rw-ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.instruction}</p>
        <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginTop: 10 }}>Set {formatDate(a.createdAt)}</div>
      </div>

      <h2 style={h2}>Sent for review</h2>
      {error && <p style={{ color: "var(--rw-orange-deep)" }}>{error}</p>}
      {a.submissions.length === 0 ? (
        <p style={{ color: "var(--rw-meta)", fontSize: 14 }}>
          {studentName(a.student)} hasn&apos;t marked this ready for review yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {a.submissions.map((s, i) => (
            <div key={s.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <strong style={{ color: "var(--rw-ink)" }}>
                  {i === 0 ? "Latest" : "Earlier"} · sent {formatDate(s.createdAt)}
                </strong>
                <span style={{ fontSize: 13, color: "var(--rw-meta)" }}>
                  {s.recording ? `Recording ${formatClock(s.recording.duration)}` : "No recording"}
                </span>
              </div>

              {s.recording?.url && (
                <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                  <audio controls preload="none" src={s.recording.url} style={{ width: "100%" }} />
                  {tracks && (
                    <div>
                      <button
                        onClick={() => setListeningTo(listeningTo === s.id ? null : s.id)}
                        style={smallBtn}
                      >
                        {listeningTo === s.id ? "Hide the band" : "Listen with the band"}
                      </button>
                    </div>
                  )}
                  {tracks && listeningTo === s.id && (
                    <StemPlayer
                      key={s.id}
                      tracks={tracks}
                      myPart={partForInstrument(a.instrument)}
                      partLabel="student's"
                      title={a.song.title}
                      mixLevel={mixLevel}
                      review={{ url: s.recording.url, songTime: s.recording.offset ?? 0, label: "Student" }}
                    />
                  )}
                  <span style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
                    Recording links last 15 minutes. Reload the page if one stops playing.
                  </span>
                </div>
              )}

              <FeedbackForm submission={s} onSaved={(saved) => applyFeedback(saved, i === 0)} />
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--rw-border)", marginTop: 36, paddingTop: 16 }}>
        <button onClick={remove} style={{ ...smallBtn, color: "var(--rw-orange-deep)" }}>
          Delete this practice work
        </button>
      </div>
    </div>
  );
}

function FeedbackForm({ submission, onSaved }) {
  const [text, setText] = useState(submission.feedback || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = text.trim() !== (submission.feedback || "");

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { submission: saved } = await teacherRequest(`/teacher/submissions/${submission.id}/feedback`, {
        method: "PUT",
        body: JSON.stringify({ feedback: text }),
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 8 }}>
      <label style={label} htmlFor={`feedback-${submission.id}`}>
        Feedback for the student
      </label>
      <textarea
        id={`feedback-${submission.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_FEEDBACK}
        rows={4}
        placeholder="What went well, and what to work on next."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 12px",
          borderRadius: 8,
          border: "1px solid var(--rw-line)",
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.5,
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" disabled={saving || !text.trim() || !changed} style={primaryBtn}>
          {saving ? "Saving…" : submission.feedback ? "Update feedback" : "Send feedback"}
        </button>
        <span style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
          {submission.reviewedAt
            ? `Sent ${formatDate(submission.reviewedAt)}. Only this student can read it.`
            : "Only this student can read it."}
        </span>
      </div>
      {error && <p style={{ color: "var(--rw-orange-deep)", margin: 0, fontSize: 13.5 }}>{error}</p>}
    </form>
  );
}

const eyebrow = { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)" };
const h2 = { fontWeight: 600, fontSize: 19, color: "var(--rw-ink)", margin: "0 0 12px" };
const label = { fontSize: 13, fontWeight: 700, color: "var(--rw-ink)", marginBottom: 6, display: "block" };
const card = {
  border: "1px solid var(--rw-border)",
  borderRadius: 10,
  background: "var(--rw-surface)",
  padding: "16px 18px",
};
const smallBtn = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
const primaryBtn = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
