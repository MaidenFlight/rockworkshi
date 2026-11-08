"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";
import s from "@/components/teacher/Plans.module.css";
import { dayLabel, requirementWords } from "@/lib/months";
import { count, inboxQuery, recordingWords, taskPlace, waitingFor } from "@/lib/plans";
import { api } from "@/lib/studio";
import { contentTitle, formatDate, studentName } from "@/lib/teaching";

export default function InboxPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <Inbox />
    </Suspense>
  );
}

const VIEWS = [
  { id: "waiting", label: "Waiting for review" },
  { id: "reviewed", label: "Reviewed" },
  { id: "checkpoints", label: "Practice checkpoints" },
];

// One queue for submitted assessments, the longest wait first. Practice checkpoints are kept apart: they're
// there to look at, and waiting on nobody. The filters live in the address, so coming back from an
// assessment lands in the same place.
function Inbox() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = VIEWS.find((v) => v.id === params.get("view")) ?? VIEWS[0];
  const filters = { classId: params.get("classId") || "", studentId: params.get("studentId") || "", instrument: params.get("instrument") || "" };
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const query = inboxQuery(filters);

  const [state, setState] = useState({ url: null, data: null, error: "" });
  const [now, setNow] = useState(null);
  const url = view.id === "checkpoints" ? `/teacher/checkpoints?page=${page}${query ? `&${query}` : ""}` : `/teacher/inbox?view=${view.id}&page=${page}${query ? `&${query}` : ""}`;

  useEffect(() => {
    let stale = false;
    api(url)
      .then((data) => {
        if (stale) return;
        setState({ url, data, error: "" });
        setNow(Date.now());
      })
      .catch((err) => !stale && setState((s2) => ({ url, data: s2.data, error: err.message })));
    return () => {
      stale = true;
    };
  }, [url]);

  function go(changes) {
    const next = new URLSearchParams(window.location.search);
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  const data = state.data;
  const shown = state.url === url ? data : null;
  const filtering = Boolean(filters.classId || filters.studentId || filters.instrument);
  const waiting = shown?.waiting ?? data?.waiting;
  const backTo = `inbox=1${query ? `&${query}` : ""}`;

  return (
    <div className="rw-st">
      <div>
        <h1 className="rw-st-title">Inbox</h1>
        <p className="rw-st-lead">
          {waiting === undefined
            ? "Weekly assessments your students have submitted."
            : filtering
              ? `${count(waiting, "assessment")} waiting that ${waiting === 1 ? "matches" : "match"} these filters.`
              : waiting === 0
                ? "Nothing is waiting for your review."
                : `${count(waiting, "assessment")} waiting for your review, the longest wait first.`}
        </p>
      </div>

      <nav className="rw-st-tabs" aria-label="Inbox" style={{ marginBottom: 0 }}>
        {VIEWS.map((v) => {
          const target = new URLSearchParams(query);
          if (v.id !== "waiting") target.set("view", v.id);
          const text = target.toString();
          return (
            <Link key={v.id} href={text ? `/teacher/inbox?${text}` : "/teacher/inbox"} className="rw-st-tab" aria-current={v.id === view.id ? "page" : undefined}>
              {v.label}
            </Link>
          );
        })}
      </nav>

      {data?.filters && (
        <div className={s.filters}>
          <label className="rw-st-field">
            Class
            <select value={filters.classId} onChange={(e) => go({ classId: e.target.value })}>
              <option value="">All classes</option>
              {data.filters.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="rw-st-field">
            Student
            <select value={filters.studentId} onChange={(e) => go({ studentId: e.target.value })}>
              <option value="">All students</option>
              {data.filters.students.map((p) => (
                <option key={p.id} value={p.id}>
                  {studentName(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="rw-st-field">
            Instrument
            <select value={filters.instrument} onChange={(e) => go({ instrument: e.target.value })}>
              <option value="">All instruments</option>
              {data.filters.instruments.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          {filtering && (
            <button type="button" className="rw-st-btn" onClick={() => go({ classId: "", studentId: "", instrument: "" })}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {state.error && (
        <p className="rw-st-error" role="alert">
          {state.error}
        </p>
      )}

      {!data && !state.error && <p className="rw-st-muted">Loading…</p>}
      {shown && shown.items.length === 0 && !state.error && <Empty view={view.id} filtering={filtering} />}
      {data && (shown ?? data).items.length > 0 && (
        <>
          <ul className={s.rows} aria-busy={!shown} style={shown ? undefined : { opacity: 0.6 }}>
            {(shown ?? data).items.map((a) => (
              <li key={a.id}>{view.id === "checkpoints" ? <CheckpointRow task={a} /> : <AssessmentRow task={a} backTo={backTo} now={now} reviewedView={view.id === "reviewed"} />}</li>
            ))}
          </ul>
          <Pagination pagination={(shown ?? data).pagination} onChange={(n) => go({ page: n > 1 ? String(n) : "" })} label="Inbox pages" />
        </>
      )}
    </div>
  );
}

function Empty({ view, filtering }) {
  if (filtering) {
    return (
      <div className="rw-st-empty">
        <strong>Nothing matches these filters</strong>
        Try a different class, student or instrument.
      </div>
    );
  }
  const words = {
    waiting: ["Nothing waiting", "Assessments appear here as soon as a student submits one."],
    reviewed: ["Nothing reviewed yet", "Assessments you've given feedback on appear here."],
    checkpoints: ["No checkpoints saved yet", "Takes students save for practice checkpoints appear here. They don't need a review."],
  }[view];
  return (
    <div className="rw-st-empty">
      <strong>{words[0]}</strong>
      {words[1]}
    </div>
  );
}

function workName(a) {
  const place = a.week ? taskPlace(a) : "Single task";
  return a.section ? `${place}: ${a.section}` : place;
}

function AssessmentRow({ task: a, backTo, now, reviewedView }) {
  const latest = a.submissions[0];
  const asked = requirementWords(a).join(" · ");
  const flagged = a.kind === "checkpoint";
  return (
    <Link href={reviewedView ? `/teacher/assignments/${a.id}` : `/teacher/assignments/${a.id}?${backTo}`} className={s.row}>
      <div className={s.rowMain}>
        <div className={s.rowTitle}>{`${studentName(a.student)} · ${a.instrument}`}</div>
        <div className={s.rowMeta}>{`${contentTitle(a)} · ${workName(a)}`}</div>
        <div className={s.rowMeta}>
          {reviewedView
            ? `Sent ${formatDate(a.sentAt)}${latest?.reviewedAt ? ` · reviewed ${formatDate(latest.reviewedAt)}` : ""}`
            : `Sent ${formatDate(a.sentAt)} · ${now ? waitingFor(a.sentAt, now) : ""}${a.dueOn ? ` · due ${dayLabel(a.dueOn)}` : ""}`}
        </div>
        <div className={s.rowMeta}>{`Sent as: ${recordingWords(latest?.recording).join(" · ")}. Asked for: ${asked}.`}</div>
      </div>
      <div className={s.chips}>
        {flagged && <span className="rw-st-chip">Checkpoint you asked to see</span>}
        <span className="rw-st-chip" data-tone={a.resubmission ? "warn" : undefined}>
          {a.resubmission ? `Resubmission, attempt ${a.attempts}` : "First submission"}
        </span>
        {a.audioInstead && <span className="rw-st-chip" data-tone="warn">Audio instead of video</span>}
        <span className="rw-st-chip" data-tone={reviewedView ? "good" : "red"}>
          {reviewedView ? "Reviewed" : "Waiting"}
        </span>
      </div>
    </Link>
  );
}

function CheckpointRow({ task: a }) {
  const latest = a.submissions[0];
  return (
    <Link href={`/teacher/assignments/${a.id}`} className={s.row}>
      <div className={s.rowMain}>
        <div className={s.rowTitle}>{`${studentName(a.student)} · ${a.instrument}`}</div>
        <div className={s.rowMeta}>{`${contentTitle(a)} · ${workName(a)}`}</div>
        <div className={s.rowMeta}>{`${count(a.attempts, "take")} saved, last ${formatDate(a.sentAt)}. ${recordingWords(latest?.recording).join(" · ")}.`}</div>
      </div>
      <div className={s.chips}>
        <span className="rw-st-chip">Practice</span>
      </div>
    </Link>
  );
}
