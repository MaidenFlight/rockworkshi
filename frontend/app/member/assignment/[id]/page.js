"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { assignmentTitle, formatClock, formatDate, hasLoop, sendForReview, studentStatus, teacherRequest } from "@/lib/teaching";
import { pill } from "@/lib/terms";

// The student's view of one piece of practice work: what to do, sending it for review, and feedback.
export default function AssignmentPage() {
  const { id } = useParams();
  // In the student demo (backend lib/demo.js) the teacher is made up and recordings aren't uploaded.
  const demo = Boolean(useAuth().user?.isDemo);
  // undefined = loading, null = failed (see error)
  const [assignment, setAssignment] = useState(undefined);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    teacherRequest(`/assignments/${id}`)
      .then((data) => setAssignment(data.assignment))
      .catch((err) => {
        setError(err.message);
        setAssignment(null);
      });
  }, [id]);

  async function markReady() {
    setSending(true);
    setSendError("");
    try {
      await sendForReview(id, null);
      const data = await teacherRequest(`/assignments/${id}`);
      setAssignment(data.assignment);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (assignment === undefined) {
    return (
      <p role="status" style={{ maxWidth: 800, margin: "80px auto", textAlign: "center", color: "var(--rw-body)" }}>
        Loading…
      </p>
    );
  }
  if (!assignment) {
    return (
      <p role="alert" style={{ maxWidth: 800, margin: "80px auto", textAlign: "center", color: "var(--rw-body)" }}>
        {error || "Not found."}{" "}
        <Link href="/member" style={{ color: "var(--rw-orange-deep)" }}>
          Back to your dashboard
        </Link>
      </p>
    );
  }

  const a = assignment;
  const item = a.song || a.lesson;
  const status = studentStatus(a);
  const times = hasLoop(a) ? `${formatClock(a.sectionStart)}–${formatClock(a.sectionEnd)}` : "";
  // Work can be sent again at any time; every send is kept as an attempt, newest first.
  const sent = a.submissions.length;
  const teacher = a.teacher?.name?.split(" ")[0] || "Your teacher";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href="/member" className="rw-back">
        <Icon name="arrow-left" size={14} /> Practice
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", margin: "10px 0 22px" }}>
        <div>
          <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 30, lineHeight: 1.05, color: "var(--rw-ink)", margin: "0 0 4px" }}>{assignmentTitle(a)}</h1>
          <p style={{ color: "var(--rw-meta)", margin: 0 }}>{[item?.artist, `From ${a.teacher?.name || "your teacher"}`].filter(Boolean).join(" · ")}</p>
        </div>
        <span style={{ ...pill(status.tone), marginTop: 6 }}>{status.label}</span>
      </div>

      <section style={panel}>
        <div style={{ fontWeight: 700, color: "var(--rw-ink)", marginBottom: 4 }}>
          {[a.instrument, `Level ${a.level}${a.levelName ? ` · ${a.levelName}` : ""}`].join(" · ")}
        </div>
        {(a.section || times) && (
          <p style={{ margin: "0 0 4px", color: "var(--rw-body)" }}>
            Section: {[a.section, times].filter(Boolean).join(", ")}
            {times && a.song ? " (the player loops it for you)" : ""}
          </p>
        )}
        <h2 style={subheading}>What to practise</h2>
        <p style={{ margin: "0 0 16px", color: "var(--rw-body)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.instruction}</p>
        {a.song ? (
          <Button href={`/member/song/${a.song.id}?assignment=${a.id}`} size="sm">
            Practise with the band
          </Button>
        ) : a.lesson ? (
          <Button href={`/member/lesson/${a.lesson.id}`} size="sm">
            Open the lesson
          </Button>
        ) : (
          <p style={{ margin: 0, color: "var(--rw-meta)" }}>This song or lesson has been removed from the library.</p>
        )}
      </section>

      <h2 style={heading}>{sent ? "Send it again" : "Send for review"}</h2>
      <section style={panel}>
        {a.song && (
          <p style={{ margin: "0 0 12px", color: "var(--rw-body)", lineHeight: 1.55 }}>
            To send a recording, open the player, record yourself and choose Send to your teacher. Your teacher hears it with the band.
          </p>
        )}
        {sent > 0 && (
          <p style={{ margin: "0 0 14px", color: "var(--rw-body)", lineHeight: 1.55 }}>
            You&apos;ve sent this {sent === 1 ? "once" : sent === 2 ? "twice" : `${sent} times`}. Send it again whenever you like: every send is kept below, newest
            first, and your teacher replies to the newest.
          </p>
        )}
        <Button type="button" onClick={markReady} disabled={sending} size="sm" variant={a.song ? "secondary" : "primary"}>
          {sending ? "Sending…" : a.song ? (sent ? "Send again without a recording" : "Mark ready without a recording") : sent ? "Send again" : "Mark ready for review"}
        </Button>
        {sendError && (
          <p role="alert" style={{ margin: "10px 0 0", color: "var(--rw-orange-deep)", fontSize: 14 }}>
            {sendError}
          </p>
        )}
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--rw-meta)" }}>
          {demo
            ? "In the student demo, what you send stays in the demo: no real teacher gets it, and it's deleted when you leave."
            : "Only your teacher can hear your recording or read their feedback."}
        </p>
      </section>

      <h2 style={heading}>Your submissions</h2>
      {a.submissions.length === 0 ? (
        <p style={{ margin: 0, color: "var(--rw-meta)" }}>Nothing sent yet.</p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {a.submissions.map((s, i) => (
            <li key={s.id} style={panel}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "4px 12px" }}>
                <strong style={{ color: "var(--rw-ink)" }}>
                  Attempt {a.submissions.length - i}
                  {i === 0 && a.submissions.length > 1 ? " · newest" : ""}
                </strong>
                <span style={{ fontSize: 13, color: "var(--rw-meta)" }}>
                  Sent {formatDate(s.createdAt)} · {s.recording ? `${formatClock(s.recording.duration)} recording` : "no recording"}
                </span>
              </div>
              {s.recording?.url && <audio controls preload="none" src={s.recording.url} aria-label={`Your recording, attempt ${a.submissions.length - i}`} style={{ width: "100%", marginTop: 10 }} />}
              <p style={{ margin: "10px 0 0", color: "var(--rw-body)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {s.feedback || (i === 0 ? "Waiting for your teacher." : "No reply to this one: your teacher replies to the newest.")}
              </p>
              {s.reviewedAt && (
                <div style={{ fontSize: 13, color: "var(--rw-meta)", marginTop: 8 }}>
                  {teacher} replied {formatDate(s.reviewedAt)}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const panel = { padding: "18px 20px", background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)" };
const heading = { fontWeight: 800, textTransform: "uppercase", fontSize: 24, color: "var(--rw-ink)", margin: "30px 0 10px" };
const subheading = { fontFamily: "inherit", fontWeight: 700, fontSize: 15, color: "var(--rw-ink)", margin: "12px 0 4px" };
