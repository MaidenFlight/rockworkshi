"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TaskFields from "@/components/teacher/TaskFields";
import WeekGroups from "@/components/teacher/WeekGroups";
import s from "@/components/teacher/Month.module.css";
import { DEFAULT_CRITERIA, dayLabel, requirementWords, taskForSaving } from "@/lib/months";
import { pill } from "@/lib/terms";
import { api, send } from "@/lib/studio";
import { STATUS_LABELS, formatDate } from "@/lib/teaching";

const TONE = { assigned: "draft", saved: "draft", ready: "ready", reviewed: "open" };

export default function MonthPage() {
  const { id } = useParams();
  const [month, setMonth] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null); // the task being edited, or "new-2" for a new one in week 2
  const [titles, setTitles] = useState(null);

  const load = useCallback(
    () =>
      api(`/teacher/months/${id}`)
        .then((d) => {
          setMonth(d.month);
          setTitles(d.month.weekTitles);
        })
        .catch((err) => setError(err.message)),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!month) return error ? <p className="rw-st-error">{error}</p> : <p className="rw-st-muted">Loading…</p>;
  const name = month.student.name || "This student";
  const titlesChanged = JSON.stringify(titles) !== JSON.stringify(month.weekTitles);

  async function saveTitles() {
    setError("");
    try {
      const d = await send(`/teacher/months/${id}`, "PUT", { weekTitles: titles });
      setMonth(d.month);
      setTitles(d.month.weekTitles);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(task) {
    if (!window.confirm(`Remove ${task.section || "this task"} from the month?`)) return;
    setError("");
    try {
      await send(`/teacher/assignments/${task.id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  // A new task starts from the week's others, so only what's different has to be set.
  function blankTask(week) {
    const like = month.tasks.findLast((t) => t.week === week) ?? month.tasks[month.tasks.length - 1];
    return { week, kind: "checkpoint", section: "", sectionStart: null, sectionEnd: null, instruction: "", level: like?.level ?? 1, media: "audio", audioAllowed: false, support: like?.support ?? null, targetSpeed: like?.targetSpeed ?? null, dueOn: like?.dueOn ?? null, criteria: [], reviewCheckpoint: false };
  }

  return (
    <div className="rw-st">
      <div>
        <Link href={`/teacher/students/${month.student.id}`} className="rw-st-muted">
          ← {name}
        </Link>
        <h1 className="rw-st-title" style={{ marginTop: 6 }}>
          {month.song?.title ?? "Removed song"}
        </h1>
        <p className="rw-st-lead">
          {name} · {month.student.instrument} · starts {dayLabel(month.startsOn)}
        </p>
      </div>

      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      {!month.canFilm && month.tasks.some((t) => t.media === "video") && (
        <p className={s.note}>{name} is under 18 and a guardian hasn&apos;t turned on Practice videos yet. Until they do, the video tasks ask for audio instead.</p>
      )}

      <div className={s.stack}>
        <WeekGroups
          tasks={month.tasks}
          title={(week) => (
            <input
              className={s.weekTitleInput}
              aria-label={`Name of week ${week}`}
              value={titles[week - 1]}
              maxLength={40}
              onChange={(e) => setTitles(titles.map((t, i) => (i === week - 1 ? e.target.value : t)))}
            />
          )}
          renderTask={(t) => (
            <Task
              key={t.id}
              task={t}
              sections={month.sections}
              editing={open === t.id}
              onEdit={() => setOpen(open === t.id ? null : t.id)}
              onRemove={() => remove(t)}
              onSaved={async () => {
                setOpen(null);
                await load();
              }}
            />
          )}
          foot={(week) =>
            open === `new-${week}` ? (
              <NewTask
                week={week}
                blank={blankTask(week)}
                monthId={id}
                sections={month.sections}
                onCancel={() => setOpen(null)}
                onSaved={async () => {
                  setOpen(null);
                  await load();
                }}
              />
            ) : (
              <div>
                <button type="button" className="rw-st-btn" onClick={() => setOpen(`new-${week}`)} style={{ minHeight: 44 }}>
                  Add a task to week {week}
                </button>
              </div>
            )
          }
        />
        {titlesChanged && (
          <div className={s.formActions}>
            <button type="button" className="rw-st-btn" data-tone="primary" onClick={saveTitles}>
              Save week names
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// One task of the month: where it stands, a way to hear what's been saved, and its settings.
function Task({ task: t, sections, editing, onEdit, onRemove, onSaved }) {
  const [draft, setDraft] = useState(t);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const sent = t.submissions.length;
  const newest = t.submissions[0];

  async function save() {
    setSaving(true);
    setError("");
    try {
      await send(`/teacher/assignments/${t.id}`, "PUT", taskForSaving(draft));
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={s.task} data-kind={t.kind}>
      <div className={s.taskRow}>
        <div className={s.taskMain}>
          <div className={s.taskName}>{t.section || "Untitled task"}</div>
          <div className={s.taskMeta}>{[...requirementWords(t), t.dueOn ? `due ${dayLabel(t.dueOn)}` : null, sent ? `${sent} sent, last ${formatDate(newest.createdAt)}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <span style={pill(TONE[t.status])}>{STATUS_LABELS[t.status]}</span>
        <div className={s.taskActions}>
          <Link href={`/teacher/assignments/${t.id}`} className="rw-st-btn">
            {t.status === "ready" ? "Review" : "Open"}
          </Link>
          <button
            type="button"
            className="rw-st-btn"
            aria-expanded={editing}
            onClick={() => {
              setDraft({ ...t, criteria: t.kind === "assessment" && !t.criteria.length ? [...DEFAULT_CRITERIA] : t.criteria });
              onEdit();
            }}
          >
            {editing ? "Close" : "Edit"}
          </button>
          {sent === 0 && (
            <button type="button" className="rw-st-btn" data-tone="quiet" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
      {t.kind === "checkpoint" && newest?.recording?.url && !editing && (
        <div className={s.takes}>
          {newest.recording.media === "video" ? <video controls preload="none" playsInline src={newest.recording.url} style={{ width: "100%", maxWidth: 460 }} /> : <audio controls preload="none" src={newest.recording.url} aria-label={`Latest take for ${t.section || "this task"}`} />}
        </div>
      )}
      {editing && (
        <>
          <TaskFields task={draft} sections={sections} onChange={(patch) => setDraft({ ...draft, ...patch })} />
          {sent > 0 && <p className="rw-st-muted">Takes already sent keep how they were made. This changes what&apos;s asked from now on.</p>}
          {error && (
            <p className="rw-st-error" role="alert">
              {error}
            </p>
          )}
          <div className={s.formActions}>
            <button type="button" className="rw-st-btn" data-tone="primary" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save task"}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function NewTask({ week, blank, monthId, sections, onCancel, onSaved }) {
  const [task, setTask] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await send(`/teacher/months/${monthId}/tasks`, "POST", taskForSaving(task));
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className={s.task}>
      <div className={s.taskName}>New task for week {week}</div>
      <TaskFields task={task} sections={sections} onChange={(patch) => setTask({ ...task, ...patch })} />
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      <div className={s.formActions}>
        <button type="button" className="rw-st-btn" data-tone="primary" disabled={saving} onClick={save}>
          {saving ? "Adding…" : "Add task"}
        </button>
        <button type="button" className="rw-st-btn" data-tone="quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
