"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TaskFields from "@/components/teacher/TaskFields";
import WeekGroups from "@/components/teacher/WeekGroups";
import s from "@/components/teacher/Month.module.css";
import { songLevels } from "@/lib/content";
import { dayLabel, requirementWords, taskForSaving, todayHere } from "@/lib/months";
import { api, send } from "@/lib/studio";

export default function NewMonthPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <NewMonth />
    </Suspense>
  );
}

const draftKey = (studentId) => `rw-month-draft:${studentId}`;

function readDraft(studentId) {
  try {
    return JSON.parse(window.localStorage.getItem(draftKey(studentId)) || "null");
  } catch {
    return null;
  }
}

// Plans a month for one student: a song and a start date give a suggested four weeks, built from the
// song's own sections, and every task can be changed before the student sees any of it. Until then it's
// only a draft in this browser.
function NewMonth() {
  const router = useRouter();
  const studentId = useSearchParams().get("student") || "";
  const [student, setStudent] = useState(null);
  const [songs, setSongs] = useState(null);
  const [setup, setSetup] = useState(() => ({ songId: "", startsOn: todayHere(), level: 1, readsChart: false }));
  // { weekTitles, tasks, sections, canFilm }
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(null); // the task being edited
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([api(`/teacher/students/${studentId}`), api("/teacher/content")])
      .then(([one, content]) => {
        setStudent(one.student);
        setSongs(content.songs.filter((x) => x.hasTracks));
        const stored = readDraft(studentId);
        if (stored?.draft?.tasks?.length) {
          setSetup(stored.setup);
          setDraft(stored.draft);
        }
      })
      .catch((err) => setError(err.message));
  }, [studentId]);

  // The draft survives a reload, so a long edit isn't lost.
  useEffect(() => {
    if (!studentId || !draft) return;
    try {
      window.localStorage.setItem(draftKey(studentId), JSON.stringify({ setup, draft }));
    } catch {
      // Only a convenience: it just won't be there after a reload.
    }
  }, [studentId, setup, draft]);

  function forgetDraft() {
    try {
      window.localStorage.removeItem(draftKey(studentId));
    } catch {
      // Nothing to clear, then.
    }
  }

  async function build(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { draft: built, canFilm } = await send("/teacher/months/draft", "POST", { studentId, ...setup });
      if (!built.tasks.length) {
        setError("This song has no chart with sections yet, so there's nothing to suggest. Choose another song.");
        return;
      }
      setDraft({ ...built, canFilm, tasks: built.tasks.map((t, i) => ({ ...t, key: i })) });
      setOpen(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const change = (key, patch) => setDraft((d) => ({ ...d, tasks: d.tasks.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));

  function addTask(week) {
    const like = draft.tasks.findLast((t) => t.week === week) ?? draft.tasks[draft.tasks.length - 1];
    const key = Math.max(...draft.tasks.map((t) => t.key)) + 1;
    setDraft((d) => ({
      ...d,
      tasks: [...d.tasks, { key, week, kind: "checkpoint", section: "", sectionStart: null, sectionEnd: null, instruction: "", level: like.level, media: "audio", audioAllowed: false, support: like.support, targetSpeed: like.targetSpeed, dueOn: like.dueOn, criteria: [], reviewCheckpoint: false }],
    }));
    setOpen(key);
  }

  async function setMonth() {
    setBusy(true);
    setError("");
    try {
      // Stored in the order they're shown: each week's checkpoints, then its assessment.
      const ordered = [...draft.tasks].sort((a, b) => a.week - b.week || (a.kind === b.kind ? a.key - b.key : a.kind === "checkpoint" ? -1 : 1));
      const { month } = await send("/teacher/months", "POST", {
        studentId,
        songId: setup.songId,
        startsOn: setup.startsOn,
        weekTitles: draft.weekTitles,
        tasks: ordered.map(taskForSaving),
      });
      forgetDraft();
      router.push(`/teacher/months/${month.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!studentId) return <p className="rw-st-error">Open this from a student&apos;s page.</p>;
  if (!student || !songs) return error ? <p className="rw-st-error">{error}</p> : <p className="rw-st-muted">Loading…</p>;
  const name = student.name || "This student";
  const song = songs.find((x) => x.id === setup.songId);

  return (
    <div className="rw-st">
      <div>
        <Link href={`/teacher/students/${studentId}`} className="rw-st-muted">
          ← {name}
        </Link>
        <h1 className="rw-st-title" style={{ marginTop: 6 }}>
          Plan a month
        </h1>
        <p className="rw-st-lead">{draft && song ? `${name} · ${song.title} · starts ${dayLabel(setup.startsOn)}` : `Four weeks on one song for ${name}, built from the song's own sections.`}</p>
      </div>

      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}

      {!draft ? (
        <form onSubmit={build} className={`rw-st-card rw-st-form ${s.setup}`}>
          <label className="rw-st-field">
            Song
            <select required value={setup.songId} onChange={(e) => setSetup({ ...setup, songId: e.target.value })}>
              <option value="">Choose a song</option>
              {songs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                  {x.artist ? ` · ${x.artist}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="rw-st-row">
            <label className="rw-st-field">
              First day of week 1
              <input type="date" required value={setup.startsOn} onChange={(e) => setSetup({ ...setup, startsOn: e.target.value })} />
            </label>
            <label className="rw-st-field">
              Level
              <select value={setup.level} onChange={(e) => setSetup({ ...setup, level: Number(e.target.value) })}>
                {songLevels.map((l) => (
                  <option key={l.n} value={l.n}>
                    {l.n}. {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="rw-st-check">
            <input type="checkbox" checked={setup.readsChart} onChange={(e) => setSetup({ ...setup, readsChart: e.target.checked })} />
            Learning to read notation: keep the chart in the On my own weeks
          </label>
          <div className={s.formActions}>
            <button type="submit" className="rw-st-btn" data-tone="primary" disabled={busy || !setup.songId}>
              {busy ? "Building…" : "Suggest four weeks"}
            </button>
          </div>
        </form>
      ) : (
        <div className={s.stack}>
          {!draft.canFilm && draft.tasks.some((t) => t.media === "video") && (
            <p className={s.note}>{name} is under 18 and a guardian hasn&apos;t turned on Practice videos yet. Until they do, the video tasks will ask for audio instead.</p>
          )}
          <WeekGroups
            tasks={draft.tasks}
            title={(week) => (
              <input
                className={s.weekTitleInput}
                aria-label={`Name of week ${week}`}
                value={draft.weekTitles[week - 1]}
                maxLength={40}
                onChange={(e) => setDraft((d) => ({ ...d, weekTitles: d.weekTitles.map((t, i) => (i === week - 1 ? e.target.value : t)) }))}
              />
            )}
            renderTask={(t) => (
              <li key={t.key} className={s.task} data-kind={t.kind}>
                <div className={s.taskRow}>
                  <div className={s.taskMain}>
                    <div className={s.taskName}>{t.section || "Untitled task"}</div>
                    <div className={s.taskMeta}>{[...requirementWords(t), t.dueOn ? `due ${dayLabel(t.dueOn)}` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className={s.taskActions}>
                    <button type="button" className="rw-st-btn" aria-expanded={open === t.key} onClick={() => setOpen(open === t.key ? null : t.key)}>
                      {open === t.key ? "Close" : "Edit"}
                    </button>
                    <button type="button" className="rw-st-btn" data-tone="quiet" onClick={() => setDraft((d) => ({ ...d, tasks: d.tasks.filter((x) => x.key !== t.key) }))}>
                      Remove
                    </button>
                  </div>
                </div>
                {open === t.key && <TaskFields task={t} sections={draft.sections} onChange={(patch) => change(t.key, patch)} />}
              </li>
            )}
            foot={(week) => (
              <div>
                <button type="button" className="rw-st-btn" onClick={() => addTask(week)} style={{ minHeight: 44 }}>
                  Add a task to week {week}
                </button>
              </div>
            )}
          />
          <div className={s.formActions}>
            <button type="button" className="rw-st-btn" data-tone="primary" disabled={busy || !draft.tasks.length} onClick={setMonth}>
              {busy ? "Setting it…" : "Set this month"}
            </button>
            <button
              type="button"
              className="rw-st-btn"
              data-tone="quiet"
              onClick={() => {
                forgetDraft();
                setDraft(null);
              }}
            >
              Start over
            </button>
            <span className="rw-st-muted">{name} sees it once it&apos;s set. This draft stays in this browser until then.</span>
          </div>
        </div>
      )}
    </div>
  );
}
