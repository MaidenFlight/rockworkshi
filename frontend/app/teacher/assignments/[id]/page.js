"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import StemPlayer from "@/components/member/StemPlayer";
import ui from "@/components/teacher/Month.module.css";
import plans from "@/components/teacher/Plans.module.css";
import { HELP, MARKS, MARK_NAMES, dayLabel, requirementWords } from "@/lib/months";
import { inboxQuery } from "@/lib/plans";
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

export default function ReviewPage() {
  const { id } = useParams();
  // useSearchParams needs a Suspense boundary. The key starts afresh on the next assessment.
  return (
    <Suspense fallback={<p style={{ color: "var(--rw-meta)" }}>Loading…</p>}>
      <ReviewAssignment key={id} />
    </Suspense>
  );
}

function ReviewAssignment() {
  const { id } = useParams();
  const router = useRouter();
  const params = useSearchParams();
  // Opened from the inbox: it keeps the inbox's filters so "next" stays in the same queue.
  const fromInbox = params.get("inbox") === "1";
  const query = inboxQuery({ classId: params.get("classId") || "", studentId: params.get("studentId") || "", instrument: params.get("instrument") || "" });
  // undefined = loading, null = failed (see error)
  const [assignment, setAssignment] = useState(undefined);
  const [tracks, setTracks] = useState(null);
  const [mixLevel, setMixLevel] = useState(null);
  const [listeningTo, setListeningTo] = useState(null); // submission id playing with the band
  const [error, setError] = useState("");
  const [replies, setReplies] = useState(0); // how many times feedback has gone out from this page
  const queue = useQueue(fromInbox, id, query, replies);

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
        s.id === saved.id ? { ...s, feedback: saved.feedback, notes: saved.notes, marks: saved.marks, priorities: saved.priorities, reviewedAt: saved.reviewedAt } : s
      ),
    }));
    setReplies((n) => n + 1);
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
      {fromInbox ? (
        <QueueBar queue={queue} query={query} sentTo={replies > 0 ? studentName(a.student) : null} />
      ) : (
        <Link href="/teacher" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
          <Icon name="arrow-left" size={14} /> Your students
        </Link>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", margin: "10px 0 18px" }}>
        <div>
          <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 28, color: "var(--rw-ink)", margin: "0 0 4px" }}>{contentTitle(a)}</h1>
          <div style={{ color: "var(--rw-meta)", fontSize: 14 }}>
            {studentName(a.student)} · {a.instrument} · Level {a.level} {a.levelName}
            {a.section || times ? ` · ${a.section || "Section"}${times}` : ""}
          </div>
          {a.week && (
            <div style={{ color: "var(--rw-meta)", fontSize: 14, marginTop: 2 }}>
              Week {a.week} {a.kind === "assessment" ? "assessment" : "milestone"}
              {a.dueOn ? ` · due ${dayLabel(a.dueOn)}` : ""} ·{" "}
              <Link href={`/teacher/months/${a.month.id}`} style={{ color: "var(--rw-orange-deep)" }}>
                See the month
              </Link>
            </div>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rw-body)", whiteSpace: "nowrap", marginTop: 6 }}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>

      <div style={{ ...card, marginBottom: 28 }}>
        <div style={label}>What to practise</div>
        <p style={{ margin: 0, color: "var(--rw-ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.instruction}</p>
        {(a.month || a.media === "video" || a.support || a.targetSpeed) && <p className={ui.made} style={{ margin: "10px 0 0" }}>The final take: {requirementWords(a).join(" · ")}</p>}
        <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginTop: 10 }}>Set {formatDate(a.createdAt)}</div>
      </div>

      <h2 style={h2}>{a.kind === "checkpoint" ? "Saved takes" : "Sent for review"}</h2>
      {error && <p style={{ color: "var(--rw-orange-deep)" }}>{error}</p>}
      {a.submissions.length === 0 ? (
        <p style={{ color: "var(--rw-meta)", fontSize: 14 }}>
          {a.kind === "checkpoint" ? `${studentName(a.student)} hasn't saved a take for this yet.` : `${studentName(a.student)} hasn't marked this ready for review yet.`}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {a.submissions.map((s, i) => (
            <ReviewCard
              key={s.id}
              assignment={a}
              submission={s}
              latest={i === 0}
              tracks={tracks}
              mixLevel={mixLevel}
              listening={listeningTo === s.id}
              onListen={() => setListeningTo(listeningTo === s.id ? null : s.id)}
              onSaved={(saved) => applyFeedback(saved, i === 0)}
            />
          ))}
        </div>
      )}

      {fromInbox && replies > 0 && (
        <p className={plans.actions} style={{ margin: "16px 0 0" }}>
          <span className="rw-st-ok">{`Feedback sent to ${studentName(a.student)}.`}</span>
          {nextHref(queue, query) ? (
            <Link href={nextHref(queue, query)} className="rw-st-btn" data-tone="primary">
              {nextWords(queue.next)}
            </Link>
          ) : (
            queue && <span className="rw-st-muted">Nothing else is waiting.</span>
          )}
        </p>
      )}

      <div style={{ borderTop: "1px solid var(--rw-border)", marginTop: 36, paddingTop: 16 }}>
        <button onClick={remove} style={{ ...smallBtn, color: "var(--rw-orange-deep)" }}>
          Delete this practice work
        </button>
      </div>
    </div>
  );
}

// Where this assessment sits in the inbox and what comes next. Asked again after feedback goes out,
// because that takes this one out of the queue.
function useQueue(enabled, id, query, replies) {
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    teacherRequest(`/teacher/inbox/next?after=${id}${query ? `&${query}` : ""}`)
      .then((q) => !stale && setQueue(q))
      .catch(() => !stale && setQueue(false));
    return () => {
      stale = true;
    };
  }, [enabled, id, query, replies]);
  return queue;
}

const nextHref = (queue, query) => (queue?.next ? `/teacher/assignments/${queue.next.id}?inbox=1${query ? `&${query}` : ""}` : null);
const nextWords = (next) => `Next: ${studentName(next.student)}${next.week ? `, week ${next.week}` : ""}`;

// The way through the inbox: back to it, where this one sits, and on to the next that's waiting.
function QueueBar({ queue, query, sentTo }) {
  const back = `/teacher/inbox${query ? `?${query}` : ""}`;
  const onward = nextHref(queue, query);
  const place = queue ? (queue.position ? `${queue.position} of ${queue.total} waiting` : `${queue.total} still waiting`) : "";

  return (
    <div className={plans.actions} style={{ justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--rw-border)" }}>
      <div className={plans.actions}>
        <Link href={back} style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon name="arrow-left" size={14} /> Inbox
        </Link>
        {place && <span className="rw-st-muted">{place}</span>}
        {sentTo && (
          <span className="rw-st-ok" role="status">
            {`Feedback sent to ${sentTo}.`}
          </span>
        )}
      </div>
      {onward ? (
        <Link href={onward} className="rw-st-btn" data-tone="primary">
          {nextWords(queue.next)}
        </Link>
      ) : (
        queue && <span className="rw-st-muted">{queue.total === 0 ? "Nothing else is waiting." : "This is the only one waiting."}</span>
      )}
    </div>
  );
}

// One send, with its recording (alone, or with the band) and the feedback on it. moment() says where
// in the song the teacher is: the band player's position while it's open, else the recording's own
// time plus where it starts in the song.
function ReviewCard({ assignment: a, submission: s, latest, tracks, mixLevel, listening, onListen, onSaved }) {
  const audio = useRef(null);
  const band = useRef(null);
  const moment = () => {
    if (listening && band.current) return band.current();
    return audio.current ? (s.recording?.offset ?? 0) + audio.current.currentTime * (s.recording?.speed ?? 1) : null;
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <strong style={{ color: "var(--rw-ink)" }}>
          {latest ? "Latest" : "Earlier"} · sent {formatDate(s.createdAt)}
        </strong>
        <span style={{ fontSize: 13, color: "var(--rw-meta)" }}>{s.recording ? `Recording ${formatClock(s.recording.duration)}` : "No recording"}</span>
      </div>

      {s.recording?.url && (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {s.recording.media === "video" ? (
            <video ref={audio} controls preload="none" playsInline src={s.recording.url} style={{ width: "100%", maxHeight: 420, background: "var(--rw-console)" }} />
          ) : (
            <audio ref={audio} controls preload="none" src={s.recording.url} style={{ width: "100%" }} />
          )}
          {tracks && s.recording.media !== "video" && (
            <div>
              <button onClick={onListen} style={smallBtn}>
                {listening ? "Hide the band" : "Listen with the band"}
              </button>
            </div>
          )}
          {tracks && listening && s.recording.media !== "video" && (
            <StemPlayer
              key={s.id}
              tracks={tracks}
              myPart={partForInstrument(a.instrument)}
              partLabel="student's"
              title={a.song.title}
              mixLevel={mixLevel}
              review={{ url: s.recording.url, songTime: s.recording.offset ?? 0, label: "Student", speed: s.recording.speed }}
              positionRef={band}
            />
          )}
          <span style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>Recording links last 15 minutes. Reload the page if one stops playing.</span>
        </div>
      )}

      {s.recording && (
        <p className={ui.made} style={{ margin: "0 0 12px" }}>
          {madeWords(s.recording).join(" · ")}
        </p>
      )}

      <FeedbackForm assignment={a} submission={s} moment={s.recording?.url ? moment : null} onSaved={onSaved} />
    </div>
  );
}

// How a take was made, in a few words: each send keeps its own, whatever the task asks for now.
function madeWords(recording) {
  return [
    recording.media === "video" ? "Video" : "Audio",
    recording.support ? HELP[recording.support] : null,
    recording.speed < 1 ? `Played at ${Math.round(recording.speed * 100)}%` : "Full speed",
  ].filter(Boolean);
}

// "1:12" from seconds, and back (or null when it isn't a time).
const toClock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function fromClock(text) {
  const m = /^\s*(\d{1,2}):([0-5]\d)(?:\.(\d))?\s*$/.exec(text) || /^\s*(\d{1,4})\s*$/.exec(text);
  if (!m) return null;
  return m[2] === undefined ? Number(m[1]) : Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
}

const MAX_NOTES = 20;
const MAX_NOTE = 280;

function FeedbackForm({ assignment, submission, moment, onSaved }) {
  const [text, setText] = useState(submission.feedback || "");
  // A mark for each thing the task is marked on, and what to work on next. An earlier send can have
  // been marked on criteria the task no longer has, and keeps them.
  const criteria = [...new Set([...(assignment.criteria || []), ...(submission.marks || []).map((m) => m.criterion)])];
  const assessed = assignment.kind === "assessment" && criteria.length > 0;
  const [marks, setMarks] = useState(() => Object.fromEntries((submission.marks || []).map((m) => [m.criterion, m.mark])));
  const [priorities, setPriorities] = useState(() => [submission.priorities?.[0] ?? "", submission.priorities?.[1] ?? ""]);
  // Notes pinned to moments in the song: the student sees each with a way to hear it and practise it.
  const [notes, setNotes] = useState(() => (submission.notes || []).map((n, k) => ({ key: k, at: n.at, time: toClock(n.at), text: n.text })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const newest = useRef(null);
  // The time as typed counts even before its box loses focus (Enter in it sends the form).
  const cleanNotes = notes
    .filter((n) => n.text.trim())
    .map((n) => ({ at: fromClock(n.time) ?? n.at, text: n.text.trim() }))
    .sort((x, y) => x.at - y.at);
  const cleanMarks = criteria.filter((c) => marks[c]).map((c) => ({ criterion: c, mark: marks[c] }));
  const cleanPriorities = priorities.map((p) => p.trim()).filter(Boolean);
  const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const changed = text.trim() !== (submission.feedback || "") || !sameList(cleanNotes, submission.notes || []) || !sameList(cleanMarks, submission.marks || []) || !sameList(cleanPriorities, submission.priorities || []);

  function addNote() {
    const at = Math.max(0, Math.round((moment?.() ?? 0) * 100) / 100);
    setNotes((list) => [...list, { key: Date.now(), at, time: toClock(at), text: "" }]);
    requestAnimationFrame(() => newest.current?.focus());
  }

  const editNote = (key, change) => setNotes((list) => list.map((n) => (n.key === key ? { ...n, ...change } : n)));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { submission: saved } = await teacherRequest(`/teacher/submissions/${submission.id}/feedback`, {
        method: "PUT",
        body: JSON.stringify({ feedback: text, notes: cleanNotes, ...(assignment.kind === "assessment" ? { marks: cleanMarks, priorities: cleanPriorities } : {}) }),
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
      {assessed && (
        <fieldset className={ui.marks} style={{ marginBottom: 6 }}>
          <legend style={label}>How it went</legend>
          {criteria.map((c) => (
            <fieldset key={c} className={ui.mark}>
              <legend>{c}</legend>
              <div className={ui.markChoices}>
                {MARKS.map((m) => (
                  <label key={m} className={ui.markChoice}>
                    <input type="radio" name={`${submission.id}-${c}`} checked={marks[c] === m} onChange={() => setMarks({ ...marks, [c]: m })} />
                    <span>{MARK_NAMES[m]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </fieldset>
      )}
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
          borderRadius: "var(--rw-radius-sm)",
          border: "1px solid var(--rw-line)",
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.5,
          resize: "vertical",
        }}
      />
      <div style={{ display: "grid", gap: 8, margin: "6px 0 4px" }}>
        <div style={label}>Notes on moments</div>
        {notes.length > 0 && (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {notes.map((n, k) => (
              <li key={n.key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  aria-label={`Note ${k + 1}: when in the song (minutes:seconds)`}
                  value={n.time}
                  onChange={(e) => editNote(n.key, { time: e.target.value })}
                  onBlur={() => {
                    const at = fromClock(n.time);
                    editNote(n.key, at === null ? { time: toClock(n.at) } : { at, time: toClock(at) });
                  }}
                  style={{ ...field, width: 72, fontVariantNumeric: "tabular-nums" }}
                />
                <input
                  ref={k === notes.length - 1 ? newest : null}
                  aria-label={`Note ${k + 1}`}
                  value={n.text}
                  maxLength={MAX_NOTE}
                  onChange={(e) => editNote(n.key, { text: e.target.value })}
                  placeholder="What you hear here, like: the change to G is late"
                  style={{ ...field, flex: "1 1 240px" }}
                />
                <button type="button" onClick={() => setNotes((list) => list.filter((x) => x.key !== n.key))} style={smallBtn}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={addNote} disabled={notes.length >= MAX_NOTES} style={smallBtn}>
            {moment ? "Add a note at this moment" : "Add a note"}
          </button>
          <span style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
            {moment
              ? "Pause the recording where you mean. The student can jump straight there to hear it and practise it."
              : "Type the time in the song it's about. The student can jump straight there to practise it."}
          </span>
        </div>
      </div>
      {assignment.kind === "assessment" && (
        <div style={{ margin: "6px 0 4px" }}>
          <p className={ui.sectionLabel}>Priorities for next week</p>
          <div className={ui.priorities}>
            {priorities.map((p, i) => (
              <input
                key={i}
                aria-label={`Priority ${i + 1} for next week`}
                value={p}
                maxLength={120}
                placeholder={i === 0 ? "The one thing to work on first" : "A second, if there is one"}
                onChange={(e) => setPriorities(priorities.map((x, k) => (k === i ? e.target.value : x)))}
              />
            ))}
          </div>
        </div>
      )}
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

const h2 = { fontWeight: 800, textTransform: "uppercase", fontSize: 19, color: "var(--rw-ink)", margin: "0 0 12px" };
const label = { fontSize: 13, fontWeight: 700, color: "var(--rw-ink)", marginBottom: 6, display: "block" };
const card = {
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
  background: "var(--rw-surface)",
  padding: "16px 18px",
};
const field = {
  boxSizing: "border-box",
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  fontFamily: "inherit",
  fontSize: 14,
};
const smallBtn = {
  padding: "7px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
const primaryBtn = {
  padding: "9px 16px",
  borderRadius: "var(--rw-radius-sm)",
  border: "none",
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
