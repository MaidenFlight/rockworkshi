"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import WeekGroups from "@/components/teacher/WeekGroups";
import m from "@/components/teacher/Month.module.css";
import s from "@/components/teacher/Plans.module.css";
import Audience from "@/components/teacher/plans/Audience";
import IndividualChanges from "@/components/teacher/plans/IndividualChanges";
import PlanTask from "@/components/teacher/plans/PlanTask";
import PublishPanel from "@/components/teacher/plans/PublishPanel";
import ReviewChanges from "@/components/teacher/plans/ReviewChanges";
import SaveAsTemplate from "@/components/teacher/plans/SaveAsTemplate";
import TemplateChanges from "@/components/teacher/plans/TemplateChanges";
import { songLevels } from "@/lib/content";
import { dayLabel } from "@/lib/months";
import { PLAN_STATUS, blankTask, count, moveTask } from "@/lib/plans";
import { INSTRUMENTS, api, send } from "@/lib/studio";
import { useDocSaver } from "@/lib/useDocSaver";

const CHIP = { draft: "off", published: "good", archived: "warn" };
const SAVE_WORDS = { saved: "All changes saved", unsaved: "Saving…", saving: "Saving…", error: "Not saved" };
const docOf = (p) => ({ name: p.name, startsOn: p.startsOn, instrument: p.instrument, level: p.level, weekTitles: p.weekTitles, tasks: p.tasks });
const forSaving = ({ tasks, ...rest }) => ({ ...rest, tasks: tasks.map(({ dueOn, ...task }) => task) });

// One plan or template: everything about the month, worked on in one place. A plan saves itself as it's
// edited and reaches nobody until it's published. A template saves when told to, and each save is a new
// version. Once a plan is published, its changes wait here until they've been reviewed and applied.
export default function PlanPage() {
  const { id } = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState(null);
  const [doc, setDoc] = useState(null);
  const [roster, setRoster] = useState(null);
  const [failed, setFailed] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [open, setOpen] = useState(null); // the task being edited
  const [panel, setPanel] = useState(null); // "publish", "review", "template-changes" or "save-template"
  const [removed, setRemoved] = useState(null); // the last task taken out, to put back
  const [audience, setAudience] = useState(null); // who's ticked, while that's on its way to the server
  const audienceSending = useRef(false);
  const audienceNext = useRef(null);
  const revision = useRef(0);
  const noticeRef = useRef(null);
  const isTemplate = plan?.kind === "template";

  // Good news can be far above where the button was, so it's brought into view.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const persist = useCallback(
    async (next) => {
      const { plan: saved } = await send(`/teacher/plans/${id}`, "PUT", { revision: revision.current, ...forSaving(next) });
      revision.current = saved.revision;
      setPlan(saved);
    },
    [id]
  );
  const saver = useDocSaver(persist, { auto: !isTemplate });
  const { reset, saveNow, changed } = saver;

  const adopt = useCallback(
    (fresh) => {
      setPlan(fresh);
      revision.current = fresh.revision;
      const next = docOf(fresh);
      setDoc(next);
      reset(next);
    },
    [reset]
  );

  useEffect(() => {
    api(`/teacher/plans/${id}`)
      .then((d) => adopt(d.plan))
      .catch((err) => setFailed(err.message));
    api("/teacher/roster")
      .then(setRoster)
      .catch(() => setRoster({ students: [], classes: [] }));
  }, [id, adopt]);

  if (failed) {
    return (
      <p className="rw-st-error" role="alert">
        {failed} <Link href="/teacher/plans">Back to plans</Link>
      </p>
    );
  }
  if (!plan || !doc) return <p className="rw-st-muted">Loading…</p>;

  const readOnly = plan.status === "archived";
  const update = (change) => {
    const next = change(doc);
    setDoc(next);
    changed(next);
  };
  const setTasks = (change) => update((d) => ({ ...d, tasks: change(d.tasks) }));

  async function openPanel(name) {
    setError("");
    setNotice(null);
    if (await saveNow()) setPanel(name);
  }

  async function preview() {
    if (await saveNow()) router.push(`/teacher/plans/${id}/preview`);
  }

  function remove(task) {
    setRemoved(task);
    setOpen(null);
    setTasks((tasks) => tasks.filter((t) => t.id !== task.id));
  }

  function putBack() {
    setTasks((tasks) => [...tasks, removed]);
    setRemoved(null);
  }

  function addTask(week) {
    const task = blankTask(week, doc.tasks, doc.level);
    setTasks((tasks) => [...tasks, task]);
    setOpen(task.id);
  }

  async function act(path, done) {
    setError("");
    setNotice(null);
    if (!(await saveNow())) return;
    try {
      const { plan: updated } = await send(`/teacher/plans/${id}/${path}`, "POST", {});
      adopt(updated);
      done?.();
    } catch (err) {
      setError(err.message);
    }
  }

  // The ticks show at once and go to the server one at a time, the newest last, so ticking two people
  // quickly can't lose the first.
  async function changeAudience(next) {
    setAudience(next);
    setError("");
    audienceNext.current = next;
    if (audienceSending.current) return;
    audienceSending.current = true;
    try {
      while (audienceNext.current) {
        const body = audienceNext.current;
        audienceNext.current = null;
        const { plan: updated } = await send(`/teacher/plans/${id}/students`, "PUT", body);
        setPlan(updated);
      }
    } catch (err) {
      audienceNext.current = null;
      setError(err.message);
    } finally {
      audienceSending.current = false;
      setAudience(null);
    }
  }

  const waitingStudents = isTemplate ? [] : plan.students.filter((p) => !p.month);
  const published = !isTemplate && plan.status === "published";
  const pending = published && plan.pendingChanges > 0;
  const given = isTemplate ? [] : plan.students.filter((p) => p.month);
  const lead = [plan.song?.title ?? "Song removed", doc.instrument, `Level ${doc.level} ${songLevels.find((l) => l.n === doc.level)?.name ?? ""}`, !isTemplate && doc.startsOn ? `starts ${dayLabel(doc.startsOn)}` : null, isTemplate ? `version ${plan.version}` : null].filter(Boolean).join(" · ");

  return (
    <div className="rw-st">
      <div>
        <Link href={isTemplate ? "/teacher/plans?tab=templates" : "/teacher/plans"} className={`rw-st-muted ${s.back}`}>
          {isTemplate ? "← Templates" : "← Plans"}
        </Link>
        <div className="rw-st-head" style={{ marginTop: 6 }}>
          <div>
            <h1 className="rw-st-title">{doc.name || "Untitled"}</h1>
            <p className="rw-st-lead">{lead}</p>
          </div>
          <div className={s.actions}>
            {!isTemplate && !readOnly && (
              <button type="button" className="rw-st-btn" onClick={preview}>
                Preview as a student
              </button>
            )}
            {isTemplate && !readOnly && (
              <>
                <button type="button" className="rw-st-btn" disabled={saver.state === "saved" || saver.state === "saving"} onClick={saveNow}>
                  Save template
                </button>
                <Link href={`/teacher/plans/new?template=${plan.id}`} className="rw-st-btn" data-tone="primary">
                  Use this template
                </Link>
              </>
            )}
            {!isTemplate && !readOnly && !published && (
              <button type="button" className="rw-st-btn" data-tone="primary" onClick={() => openPanel("publish")}>
                Review and publish
              </button>
            )}
            {pending && !readOnly && (
              <button type="button" className="rw-st-btn" data-tone="primary" onClick={() => openPanel("review")}>
                Review changes for students
              </button>
            )}
            {published && !pending && !readOnly && waitingStudents.length > 0 && (
              <button type="button" className="rw-st-btn" data-tone="primary" onClick={() => openPanel("publish")}>
                Publish to the rest
              </button>
            )}
          </div>
        </div>
        <div className={s.statusLine}>
          <span className="rw-st-chip" data-tone={isTemplate ? (readOnly ? "warn" : "good") : CHIP[plan.status]}>
            {isTemplate ? (readOnly ? "Archived" : "Template") : PLAN_STATUS[plan.status]}
          </span>
          {!readOnly && (
            <span className={s.saveState} data-state={saver.state} role="status">
              {isTemplate && saver.state === "unsaved" ? "Unsaved changes" : SAVE_WORDS[saver.state]}
            </span>
          )}
          {saver.state === "error" && (
            <button type="button" className="rw-st-btn" data-size="small" onClick={saveNow}>
              Try again
            </button>
          )}
        </div>
      </div>

      {saver.error && (
        <p className="rw-st-error" role="alert">
          {saver.error}
        </p>
      )}
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} className={`rw-st-ok ${s.notice}`} role="status">
          {notice.text} {notice.href && <Link href={notice.href}>{notice.link}</Link>}
        </p>
      )}
      {removed && (
        <p className="rw-st-muted" role="status">
          {`Removed ${removed.section || "that task"}. `}
          <button type="button" className="rw-st-btn" data-size="small" onClick={putBack}>
            Put it back
          </button>
        </p>
      )}
      {readOnly && (
        <p className={m.note}>
          {isTemplate ? "This template is archived. Plans already made from it carry on." : "This plan is archived. Any months already published carry on as they were."}
        </p>
      )}
      {published && !readOnly && (
        <p className={m.note}>
          {pending
            ? `This plan has changes your students don't have yet: ${count(plan.pendingChanges, "change")}. Nothing reaches them until you review and apply it.`
            : `Published to ${count(given.length, "student")}. Edits you make here wait here until you review and apply them.`}
        </p>
      )}
      {!isTemplate && plan.template?.behind && !readOnly && (
        <p className={m.note}>
          {`The template this came from has changed since (version ${plan.template.version} to ${plan.template.latest}). `}
          <button type="button" className="rw-st-btn" data-size="small" onClick={() => openPanel("template-changes")}>
            See what&apos;s new
          </button>
        </p>
      )}

      {panel === "publish" && (
        <PublishPanel
          plan={plan}
          onCancel={() => setPanel(null)}
          onPublished={(updated, list) => {
            adopt(updated);
            setPanel(null);
            setNotice({ text: `Published to ${list.map((p) => p.name || "a student").join(", ")}. It's on their dashboard the next time they open it.` });
          }}
        />
      )}
      {panel === "review" && (
        <ReviewChanges
          plan={plan}
          onCancel={() => setPanel(null)}
          onApplied={(updated, n) => {
            adopt(updated);
            setPanel(null);
            setNotice({ text: `Changes applied for ${count(n, "student")}.` });
          }}
          onDiscarded={(updated) => {
            adopt(updated);
            setPanel(null);
            setNotice({ text: "Back to what's published. Your unapplied changes are gone." });
          }}
        />
      )}
      {panel === "template-changes" && (
        <TemplateChanges
          plan={plan}
          onCancel={() => setPanel(null)}
          onBrought={(updated) => {
            adopt(updated);
            setPanel(null);
            setNotice({ text: updated.status === "published" ? "Brought into this plan. Review them before they reach students." : "Brought into this plan." });
          }}
        />
      )}
      {panel === "save-template" && (
        <SaveAsTemplate
          plan={plan}
          onCancel={() => setPanel(null)}
          onSaved={(template) => {
            setPanel(null);
            setNotice({ text: `Saved as ${template.name}.`, href: `/teacher/plans/${template.id}`, link: "Open the template" });
          }}
        />
      )}

      {plan.song && !plan.song.hasChart && !readOnly && <p className={m.note}>This song has no chart with sections yet, so tasks can&apos;t be matched to its sections. You can still type times by hand.</p>}

      <div className={s.layout}>
        <div className={m.stack}>
          <WeekGroups
            tasks={doc.tasks}
            title={(week) =>
              readOnly ? (
                <span className={m.weekTitle}>{doc.weekTitles[week - 1]}</span>
              ) : (
                <input className={m.weekTitleInput} aria-label={`Name of week ${week}`} value={doc.weekTitles[week - 1]} maxLength={40} onChange={(e) => update((d) => ({ ...d, weekTitles: d.weekTitles.map((t, i) => (i === week - 1 ? e.target.value : t)) }))} />
              )
            }
            renderTask={(t) =>
              readOnly ? (
                <li key={t.id} className={m.task} data-kind={t.kind}>
                  <div className={m.taskName}>{t.section || "Untitled task"}</div>
                </li>
              ) : (
                <PlanTask
                  key={t.id}
                  task={t}
                  tasks={doc.tasks}
                  plan={plan}
                  startsOn={isTemplate ? null : doc.startsOn}
                  template={isTemplate}
                  editing={open === t.id}
                  onToggle={() => setOpen(open === t.id ? null : t.id)}
                  onChange={(patch) => setTasks((tasks) => tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))}
                  onMove={(direction) => setTasks((tasks) => moveTask(tasks, t.id, direction))}
                  onRemove={() => remove(t)}
                />
              )
            }
            foot={(week) =>
              !readOnly && (
                <div>
                  <button type="button" className="rw-st-btn" onClick={() => addTask(week)} style={{ minHeight: 44 }}>
                    {`Add a task to week ${week}`}
                  </button>
                </div>
              )
            }
          />
        </div>

        <aside className={s.side}>
          <section className="rw-st-card">
            <h2>Details</h2>
            <div className={s.fieldStack}>
              <label className="rw-st-field">
                Name
                <input maxLength={80} value={doc.name} disabled={readOnly} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} />
              </label>
              {!isTemplate && (
                <label className="rw-st-field">
                  First day of week 1
                  <input type="date" value={doc.startsOn} disabled={readOnly} onChange={(e) => e.target.value && update((d) => ({ ...d, startsOn: e.target.value }))} />
                  <small>Every due date moves with this.</small>
                </label>
              )}
              <div className="rw-st-row">
                <label className="rw-st-field">
                  Instrument
                  <select value={doc.instrument} disabled={readOnly} onChange={(e) => update((d) => ({ ...d, instrument: e.target.value }))}>
                    {INSTRUMENTS.map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </select>
                </label>
                <label className="rw-st-field">
                  Level
                  <select value={doc.level} disabled={readOnly} onChange={(e) => update((d) => ({ ...d, level: Number(e.target.value) }))}>
                    {songLevels.map((l) => (
                      <option key={l.n} value={l.n}>
                        {`${l.n}. ${l.name}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          {isTemplate ? (
            <section className="rw-st-card">
              <h2>Where it&apos;s used</h2>
              {plan.usedBy.length === 0 ? (
                <p className="rw-st-muted">Not used yet. Changing this template never changes a month already given to students.</p>
              ) : (
                <ul className={s.rows}>
                  {plan.usedBy.map((u) => (
                    <li key={u.id}>
                      <Link className={s.tallLink} href={`/teacher/plans/${u.id}`}>{u.name}</Link>
                      <div className={s.changeLine}>
                        {[u.startsOn ? `starts ${dayLabel(u.startsOn)}` : null, PLAN_STATUS[u.status], count(u.students, "student"), u.behind ? "on an older version" : "up to date"].filter(Boolean).join(" · ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              <section className="rw-st-card">
                <h2>Who it&apos;s for</h2>
                {roster ? (
                  <Audience
                    roster={roster}
                    selected={audience?.studentIds ?? plan.students.map((p) => p.id)}
                    classId={audience ? audience.classId : (plan.class?.id ?? null)}
                    instrument={doc.instrument}
                    given={given.map((p) => p.id)}
                    busy={readOnly}
                    notes={Object.fromEntries(plan.students.map((p) => [p.id, p.issues.map((i) => i.text)]))}
                    onChange={changeAudience}
                  />
                ) : (
                  <p className="rw-st-muted">Loading…</p>
                )}
                {given.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p className={s.sectionName}>Has this month</p>
                    <ul className={s.rows}>
                      {given.map((p) => (
                        <li key={p.id}>
                          <Link className={s.tallLink} href={`/teacher/months/${p.month.id}`}>{p.name || "Unnamed student"}</Link>
                          <span className={s.changeLine}>{` · ${p.month.done} of ${p.month.tasks} done`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {!readOnly && (
                <section className="rw-st-card">
                  <h2>Individual changes</h2>
                  <p className="rw-st-muted" style={{ marginBottom: 10 }}>
                    Leave a task out, or set a student&apos;s own speed, support, recording, due date or instructions. Everything else follows the plan.
                  </p>
                  <IndividualChanges plan={plan} startsOn={doc.startsOn} tasks={doc.tasks} beforeSave={saveNow} onSaved={setPlan} />
                </section>
              )}
            </>
          )}

          <section className="rw-st-card">
            <h2>More</h2>
            <div className={s.actions}>
              {!isTemplate && !readOnly && (
                <button type="button" className="rw-st-btn" onClick={() => openPanel("save-template")}>
                  Save as a template
                </button>
              )}
              {readOnly ? (
                <button type="button" className="rw-st-btn" onClick={() => act("restore", () => setNotice({ text: "Restored." }))}>
                  Restore
                </button>
              ) : (
                <button type="button" className="rw-st-btn" data-tone="quiet" onClick={() => act("archive", () => setNotice({ text: "Archived. You can restore it any time." }))}>
                  Archive
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
