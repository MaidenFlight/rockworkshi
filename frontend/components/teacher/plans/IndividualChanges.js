"use client";

import { useState } from "react";
import s from "@/components/teacher/Plans.module.css";
import { HELP } from "@/lib/months";
import { addDays, dueDayFrom, dueOnOf, MAX_DUE_DAY, overrideWords, taskPlace } from "@/lib/plans";
import { send } from "@/lib/studio";

// What's different for one student: a task left out, or their own speed, support, recording, due date or
// instructions. Everything else follows the plan. Only for students who don't have the month yet: after
// that a change is made on their own month.
export default function IndividualChanges({ plan, startsOn, tasks, beforeSave, onSaved }) {
  const open = plan.students.filter((p) => !p.month);
  const [studentId, setStudentId] = useState("");
  const [changes, setChanges] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ ok: "", error: "" });

  const student = open.find((p) => p.id === studentId);

  function choose(id) {
    setStudentId(id);
    setChanges(open.find((p) => p.id === id)?.overrides ?? {});
    setEditing(null);
    setMessage({ ok: "", error: "" });
  }

  const saved = JSON.stringify(student?.overrides ?? {}) === JSON.stringify(changes);

  function patch(taskId, values) {
    setMessage({ ok: "", error: "" });
    setChanges((all) => ({ ...all, [taskId]: { ...all[taskId], ...values } }));
  }

  function clear(taskId) {
    setMessage({ ok: "", error: "" });
    setChanges(({ [taskId]: _gone, ...rest }) => rest);
  }

  async function save() {
    setSaving(true);
    setMessage({ ok: "", error: "" });
    try {
      // A task added a moment ago has to be saved before it can have anything set for it.
      await beforeSave?.();
      const { plan: updated } = await send(`/teacher/plans/${plan.id}/students/${studentId}`, "PUT", { overrides: changes });
      setChanges(updated.students.find((p) => p.id === studentId)?.overrides ?? {});
      onSaved(updated);
      setMessage({ ok: `Saved for ${student.name || "this student"}.`, error: "" });
    } catch (err) {
      setMessage({ ok: "", error: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (!open.length) return <p className="rw-st-muted">Add someone who doesn&apos;t have this month yet to set anything just for them.</p>;

  return (
    <div className={s.fieldStack}>
      <label className="rw-st-field">
        Student
        <select value={studentId} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose a student</option>
          {open.map((p) => (
            <option key={p.id} value={p.id}>
              {`${p.name || "Unnamed student"}${Object.keys(p.overrides).length ? ` (${Object.keys(p.overrides).length} changed)` : ""}`}
            </option>
          ))}
        </select>
      </label>

      {student && (
        <>
          {tasks.length === 0 && <p className="rw-st-muted">Add some tasks first.</p>}
          <div>
            {tasks.map((t) => {
              const change = changes[t.id];
              const words = overrideWords(change);
              const value = (key) => (change?.[key] !== undefined ? change[key] : t[key]);
              const skipped = Boolean(change?.skip);
              const name = t.section || "Untitled task";
              return (
                <div key={t.id} className={s.ownTask}>
                  <div className={s.ownHead}>
                    <div>
                      <div className={s.ownName}>{name}</div>
                      <div className={s.changeLine}>
                        {taskPlace(t)}
                        {words.length > 0 && <span className={s.different}>{` · ${words.join(", ")}`}</span>}
                      </div>
                    </div>
                    <div className={s.actions}>
                      <button type="button" className="rw-st-btn" aria-expanded={editing === t.id} aria-label={`Change ${name} for ${student.name || "this student"}`} onClick={() => setEditing(editing === t.id ? null : t.id)}>
                        {editing === t.id ? "Close" : "Change"}
                      </button>
                      {change && (
                        <button type="button" className="rw-st-btn" data-tone="quiet" aria-label={`Set ${name} back to the plan`} onClick={() => clear(t.id)}>
                          Back to plan
                        </button>
                      )}
                    </div>
                  </div>
                  {editing === t.id && (
                    <div className={s.ownFields}>
                      <label className={`rw-st-check ${s.ownWide}`}>
                        <input type="checkbox" checked={skipped} onChange={(e) => (e.target.checked ? setChanges((all) => ({ ...all, [t.id]: { skip: true } })) : clear(t.id))} />
                        Leave this task out
                      </label>
                      {!skipped && (
                        <>
                          <label className="rw-st-field">
                            Recording
                            <select value={value("media")} onChange={(e) => patch(t.id, { media: e.target.value })}>
                              <option value="audio">Audio</option>
                              <option value="video">Video</option>
                            </select>
                          </label>
                          <label className="rw-st-field">
                            Support mode
                            <select value={value("support") ?? ""} onChange={(e) => patch(t.id, { support: e.target.value || null })}>
                              <option value="">Any</option>
                              {Object.entries(HELP).map(([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="rw-st-field">
                            Target speed (%)
                            <input type="number" min={50} max={100} step={5} value={value("targetSpeed") ?? ""} placeholder="Any" onChange={(e) => patch(t.id, { targetSpeed: e.target.value === "" ? null : Number(e.target.value) })} />
                          </label>
                          <label className="rw-st-field">
                            Due
                            <input
                              type="date"
                              min={startsOn}
                              max={addDays(startsOn, MAX_DUE_DAY)}
                              value={dueOnOf({ dueDay: value("dueDay") }, startsOn) ?? ""}
                              onChange={(e) => patch(t.id, { dueDay: dueDayFrom(e.target.value, startsOn) })}
                            />
                          </label>
                          {value("media") === "video" && (
                            <label className={`rw-st-check ${s.ownWide}`}>
                              <input type="checkbox" checked={Boolean(value("audioAllowed"))} onChange={(e) => patch(t.id, { audioAllowed: e.target.checked })} />
                              Accept audio instead of video
                            </label>
                          )}
                          <label className={`rw-st-field ${s.ownWide}`}>
                            Instructions
                            <textarea value={value("instruction") ?? ""} maxLength={500} onChange={(e) => patch(t.id, { instruction: e.target.value })} />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className={s.actions}>
            <button type="button" className="rw-st-btn" data-tone="primary" disabled={saving || saved} onClick={save}>
              {saving ? "Saving…" : `Save for ${student.name || "this student"}`}
            </button>
            {message.ok && (
              <span className="rw-st-ok" role="status">
                {message.ok}
              </span>
            )}
          </div>
          {message.error && (
            <p className="rw-st-error" role="alert">
              {message.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
