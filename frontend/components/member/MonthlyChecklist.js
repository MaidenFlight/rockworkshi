"use client";

import Link from "next/link";
import { assignmentTitle, studentStatus } from "@/lib/teaching";
import { pill } from "@/lib/terms";
import { dayLabel, requirementWords } from "@/lib/months";
import Icon from "./Icon";
import s from "./MonthlyChecklist.module.css";

const ZONE = "Pacific/Honolulu";
const monthKey = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit" });
const monthName = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: ZONE, month: "long" });
const monthLabel = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: ZONE, month: "long", year: "numeric" });
// "Nov 5", with a no-break space so a date never splits across lines.
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: ZONE, month: "short", day: "numeric" }).replace(" ", " ");

const sent = (a) => a.status === "ready" || a.status === "reviewed";
const STATE = { assigned: "todo", saved: "saved", ready: "sent", reviewed: "done" };
// Each state's mark: a note to practise, a tick once a checkpoint's saved, a clock while the teacher has
// it, their reply once it's in. Drawn icons rather than boxes, so the rows don't read as the Today
// list's checkboxes.
const MARK = { todo: "note", saved: "check", sent: "clock", done: "feedback" };

// The teacher's work as a checklist, a month at a time (the month it was set, Honolulu time) and in the
// order it was set. Each task says whether it has been sent, how often, and whether the teacher has
// replied. It opens on the task's page, which lists every attempt with its feedback and sends it again.
// `currentId` is the task on the practice panel above, marked Today. Draws nothing without any work.
// other is for work set outside a month of weekly practice (WeeklyMonth.js), listed after it.
export default function MonthlyChecklist({ assignments, currentId, other = false }) {
  if (!assignments?.length) return null;

  const months = new Map();
  for (const a of [...assignments].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const key = monthKey(a.createdAt);
    if (!months.has(key)) months.set(key, { key, label: monthLabel(a.createdAt), name: monthName(a.createdAt), tasks: [] });
    months.get(key).tasks.push(a);
  }
  const [latest, ...earlier] = [...months.values()].sort((x, y) => y.key.localeCompare(x.key));
  const done = latest.tasks.filter(sent).length;
  // A month's work on one song names the song once, above the list, rather than on every row.
  const songs = new Set(latest.tasks.map((a) => a.song?.id ?? a.lesson?.id ?? a.id));
  const oneSong = songs.size === 1 ? assignmentTitle(latest.tasks[0]) : null;

  return (
    <section aria-labelledby="month-tasks">
      <div className={s.head}>
        <h2 id="month-tasks" className="rw-dash-h2">
          {other ? "Other tasks" : `${latest.name} tasks`}
        </h2>
        <span className={s.count}>
          {done} of {latest.tasks.length} sent
        </span>
      </div>
      <div className={s.bar} aria-hidden="true">
        <span style={{ width: `${(done / latest.tasks.length) * 100}%` }} />
      </div>
      {oneSong && <p className={s.song}>{oneSong}</p>}
      <Tasks tasks={latest.tasks} currentId={currentId} showSong={!oneSong} />
      <p className={s.note}>Open a task to see everything you sent and your teacher&apos;s replies. You can send any of them again, whenever you like.</p>

      {earlier.map((m) => (
        <details key={m.key} className={s.month}>
          <summary>
            {m.label} · {m.tasks.filter(sent).length} of {m.tasks.length} sent
          </summary>
          <Tasks tasks={m.tasks} currentId={currentId} showSong />
        </details>
      ))}
    </section>
  );
}

function Tasks({ tasks, currentId, showSong }) {
  return (
    <ol className={s.list}>
      {tasks.map((a) => (
        <Task key={a.id} task={a} current={a.id === currentId} showSong={showSong} />
      ))}
    </ol>
  );
}

// One task's row. kept says a take for it is waiting in this browser. preview draws the same row for a
// teacher looking ahead, going nowhere; children go under it.
export function Task({ task: a, current, showSong = false, kept = false, preview = false, children }) {
  const status = studentStatus(a);
  const state = STATE[a.status] ?? "todo";
  const attempts = a.attempts ?? a.submissions.length;
  const newest = a.submissions[0];
  const teacher = a.teacher?.name?.split(" ")[0] || "Your teacher";
  const checkpoint = a.week && a.kind === "checkpoint";
  const verb = !a.week ? "Sent" : checkpoint ? "Saved" : "Submitted";
  const none = !a.week ? "Not sent yet" : checkpoint ? "No take saved yet" : "Not submitted yet";
  const sends = !attempts
    ? none
    : `${attempts === 1 ? verb : `${verb} ${attempts === 2 ? "twice" : `${attempts} times`}, last`} ${day(newest.createdAt)}${newest.reviewedAt ? ` · ${teacher} replied ${day(newest.reviewedAt)}` : ""}`;
  const asks = a.week ? [...requirementWords(a), a.dueOn ? `due ${dayLabel(a.dueOn)}` : null].filter(Boolean).join(" · ") : null;
  const body = (
    <>
      <span className={s.mark} data-state={state} aria-hidden="true">
        <Icon name={MARK[state]} size={20} />
      </span>
      <span className={s.main}>
        <span className={s.title}>{a.section || assignmentTitle(a)}</span>
        {asks && <span className={s.meta}>{asks}</span>}
        <span className={s.meta}>{[showSong && a.section ? assignmentTitle(a) : null, sends, kept ? "a take is kept in this browser, not sent yet" : null].filter(Boolean).join(" · ")}</span>
      </span>
      <span className={s.tags}>
        {current && <span className={s.today}>Today</span>}
        <span style={pill(status.tone)}>{status.label}</span>
      </span>
    </>
  );

  return (
    <li>
      {preview ? (
        <div className={s.row} data-kind={a.week ? a.kind : undefined} data-preview="true">
          {body}
        </div>
      ) : (
        <Link href={`/member/assignment/${a.id}`} className={s.row} data-kind={a.week ? a.kind : undefined} aria-current={current ? "step" : undefined}>
          {body}
          <span className={s.go} aria-hidden="true">
            <Icon name="chevron-right" size={18} />
          </span>
        </Link>
      )}
      {children}
    </li>
  );
}
