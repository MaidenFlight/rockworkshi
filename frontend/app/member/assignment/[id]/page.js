"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import CompareTakes from "@/components/member/CompareTakes";
import UnsentTake from "@/components/member/UnsentTake";
import { HELP, MARK_NAMES, dayLabel, requirementWords } from "@/lib/months";
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
  const [canFilm, setCanFilm] = useState(true);

  useEffect(() => {
    teacherRequest(`/assignments/${id}`)
      .then((data) => {
        setAssignment(data.assignment);
        setCanFilm(data.canFilm !== false);
      })
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
  const who = a.teacher?.name?.split(" ")[0];
  const teacher = who || "Your teacher";
  // Sent takes that can be heard (links last 15 minutes), for comparing two of them.
  const takes = a.submissions
    .map((s, i) => ({ id: s.id, label: `${a.week && a.kind === "checkpoint" ? "Take" : "Attempt"} ${a.submissions.length - i}`, date: shortDate(s.createdAt), recording: s.recording }))
    .filter((t) => t.recording?.url);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href="/member" className="rw-back">
        <Icon name="arrow-left" size={14} /> Practice
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", margin: "10px 0 22px" }}>
        <div>
          <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 30, lineHeight: 1.05, color: "var(--rw-ink)", margin: "0 0 4px" }}>{assignmentTitle(a)}</h1>
          <p style={{ color: "var(--rw-meta)", margin: 0 }}>{[item?.artist, `From ${a.teacher?.name || "your teacher"}`].filter(Boolean).join(" · ")}</p>
          {a.week && (
            <p style={{ color: "var(--rw-ink)", fontWeight: 700, margin: "4px 0 0" }}>
              Week {a.week} {a.kind === "assessment" ? "assessment" : "checkpoint"}
              {a.dueOn ? ` · due ${dayLabel(a.dueOn)}` : ""}
            </p>
          )}
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
        {a.week && (
          <div style={{ margin: "0 0 16px" }}>
            <h2 style={subheading}>{a.kind === "assessment" ? "What your final take needs" : "How to record it"}</h2>
            <p style={{ margin: 0, color: "var(--rw-ink)", fontWeight: 700 }}>{requirementWords(a).join(" · ")}</p>
            {a.kind === "checkpoint" && <p style={{ margin: "4px 0 0", color: "var(--rw-body)", lineHeight: 1.55 }}>That&apos;s what to aim for. Practise it any way that helps, and save a take as often as you like.</p>}
            {a.media === "video" && !canFilm && (
              <p style={{ margin: "4px 0 0", color: "var(--rw-body)", lineHeight: 1.55 }}>
                A parent or guardian hasn&apos;t turned on Practice videos, so send audio for this one. They can turn it on from their family page.
              </p>
            )}
            {a.criteria.length > 0 && (
              <>
                <h2 style={subheading}>What {who || "your teacher"} listens for</h2>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--rw-body)", lineHeight: 1.6 }}>
                  {a.criteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
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

      <h2 style={heading}>{!a.week ? (sent ? "Send it again" : "Send for review") : a.kind === "checkpoint" ? (sent ? "Save another take" : "Save a take") : sent ? "Submit a new take" : "Submit a take"}</h2>
      {a.song && <UnsentTake songId={a.song.id} assignmentId={a.id} />}
      {a.week ? (
        <section style={panel}>
          <p style={{ margin: "0 0 12px", color: "var(--rw-body)", lineHeight: 1.55 }}>
            {a.kind === "checkpoint"
              ? `Record it in the player, listen back, and choose Save to checkpoint when you've got one you like. ${who || "Your teacher"} can listen to what you save, and you can save another whenever you like.`
              : `Record it in the player, listen back, then submit the take you've chosen. Nothing goes to ${who || "your teacher"} until you do, and you don't have to finish the checkpoints first.`}
          </p>
          {a.song && (
            <Button href={`/member/song/${a.song.id}?assignment=${a.id}`} size="sm">
              Open the player
            </Button>
          )}
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--rw-meta)" }}>
            {demo ? "In the student demo, what you send stays in the demo: no real teacher gets it, and it's deleted when you leave." : "Only your teacher can hear your recording or read their feedback."}
          </p>
        </section>
      ) : (
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
      )}

      <h2 style={heading}>{a.kind === "checkpoint" && a.week ? "Your saved takes" : "Your submissions"}</h2>
      {takes.length > 1 && <CompareTakes takes={takes} />}
      {a.submissions.length === 0 ? (
        <p style={{ margin: 0, color: "var(--rw-meta)" }}>{a.week ? (a.kind === "checkpoint" ? "No take saved yet." : "Nothing submitted yet.") : "Nothing sent yet."}</p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {a.submissions.map((s, i) => (
            <Attempt key={s.id} assignment={a} submission={s} number={a.submissions.length - i} newest={i === 0} teacher={teacher} who={who} demo={demo} />
          ))}
        </ol>
      )}
    </div>
  );
}

// One send: where it stands, the recording, the teacher's reply, and their notes on moments in the song.
// Each note can be heard in this recording (from a second before) and practised in the player, which
// opens there looping the bars around it.
function Attempt({ assignment: a, submission: s, number, newest, teacher, who, demo }) {
  const audio = useRef(null);
  const checkpoint = Boolean(a.week) && a.kind === "checkpoint";
  const assessment = Boolean(a.week) && a.kind === "assessment";
  const word = checkpoint ? "Saved" : assessment ? "Submitted" : "Sent";
  const state = s.reviewedAt
    ? { tone: "open", label: `${teacher} replied ${shortDate(s.reviewedAt)}` }
    : checkpoint && a.status === "saved"
      ? { tone: "draft", label: `Saved ${shortDate(s.createdAt)}` }
      : newest
        ? { tone: "ready", label: `${assessment ? "Submitted · w" : "W"}aiting for ${who || "your teacher"}` }
        : { tone: "draft", label: word };
  const offset = s.recording?.offset ?? 0;
  // A take played slowed covers less of the song than it lasts.
  const speed = s.recording?.speed ?? 1;
  const inRecording = (at) => s.recording?.url && at >= offset && at <= offset + (s.recording.duration ?? 0) * speed;

  function hear(at) {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, (at - offset) / speed - 1);
    el.play().catch(() => {});
    el.focus();
  }

  return (
    <li style={panel}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px 12px" }}>
        <strong style={{ color: "var(--rw-ink)" }}>
          {checkpoint ? "Take" : "Attempt"} {number}
          {newest && a.submissions.length > 1 ? " · newest" : ""}
        </strong>
        <span style={pill(state.tone)}>{state.label}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--rw-meta)", marginTop: 4 }}>
        {word} {formatDate(s.createdAt)} · {s.recording ? `${formatClock(s.recording.duration)} recording` : demo ? "the recording isn't part of the demo" : "no recording"}
        {a.week && s.recording ? ` · ${[s.recording.support ? HELP[s.recording.support] : null, s.recording.speed < 1 ? `${Math.round(s.recording.speed * 100)}% speed` : "full speed"].filter(Boolean).join(" · ")}` : ""}
      </div>
      {s.recording?.url &&
        (s.recording.media === "video" ? (
          <video ref={audio} controls preload="none" playsInline src={s.recording.url} aria-label={`Your video, attempt ${number}`} style={{ width: "100%", maxHeight: 420, marginTop: 10, background: "var(--rw-console)" }} />
        ) : (
          <audio ref={audio} controls preload="none" src={s.recording.url} aria-label={`Your recording, attempt ${number}`} style={{ width: "100%", marginTop: 10 }} />
        ))}
      {(s.feedback || !newest) && (
        <p style={{ margin: "10px 0 0", color: "var(--rw-body)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {s.feedback || (checkpoint ? "Saved for your teacher to listen to." : "No reply to this one: your teacher replies to the newest.")}
        </p>
      )}
      {s.marks?.length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 2, fontSize: 14 }} aria-label={`${teacher}'s marks`}>
          {s.marks.map((m) => (
            <li key={m.criterion} style={{ color: "var(--rw-body)" }}>
              {m.criterion}: <strong style={{ color: "var(--rw-ink)" }}>{MARK_NAMES[m.mark]}</strong>
            </li>
          ))}
        </ul>
      )}
      {s.priorities?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, color: "var(--rw-ink)", fontSize: 14 }}>Next, work on</div>
          <ul style={{ margin: "2px 0 0", paddingLeft: 18, color: "var(--rw-body)", lineHeight: 1.55, fontSize: 15 }}>
            {s.priorities.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {s.notes?.length > 0 && (
        <ol className="rw-moments" aria-label={`${teacher}'s notes on moments`}>
          {s.notes.map((n) => (
            <li key={`${n.at}-${n.text}`} className="rw-moment">
              <span className="rw-moment-at">{formatClock(n.at)}</span>
              <span className="rw-moment-text">{n.text}</span>
              <span className="rw-moment-go">
                {inRecording(n.at) && (
                  <button type="button" onClick={() => hear(n.at)}>
                    <Icon name="play" size={12} />
                    Hear it
                  </button>
                )}
                {a.song && (
                  <Link href={`/member/song/${a.song.id}?assignment=${a.id}&at=${n.at}`}>
                    <Icon name="loop" size={14} />
                    Practise this part
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

// "Nov 5", in the school's time, for a status that has to stay short.
const shortDate = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "Pacific/Honolulu", month: "short", day: "numeric" });

const panel = { padding: "18px 20px", background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)" };
const heading = { fontWeight: 800, textTransform: "uppercase", fontSize: 24, color: "var(--rw-ink)", margin: "30px 0 10px" };
const subheading = { fontFamily: "inherit", fontWeight: 700, fontSize: 15, color: "var(--rw-ink)", margin: "12px 0 4px" };
