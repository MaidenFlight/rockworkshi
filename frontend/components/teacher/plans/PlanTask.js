"use client";

import TaskFields from "@/components/teacher/TaskFields";
import m from "@/components/teacher/Month.module.css";
import s from "@/components/teacher/Plans.module.css";
import { dayLabel, requirementWords } from "@/lib/months";
import { dueDayFrom, dueOnOf, placeInGroup, addDays, MAX_DUE_DAY } from "@/lib/plans";

// One task in a month being planned: what it asks for in a line, keys to move it, and its fields in place.
export default function PlanTask({ task, tasks, plan, startsOn, editing, onToggle, onChange, onMove, onRemove, template }) {
  const name = task.section || "Untitled task";
  const dueOn = dueOnOf(task, startsOn);
  const due = template ? (task.dueDay === null || task.dueDay === undefined ? null : `due day ${task.dueDay + 1}`) : dueOn ? `due ${dayLabel(dueOn)}` : null;
  const { first, last } = placeInGroup(tasks, task);

  // A date in the form is kept as days after the start, so a new start moves it too.
  function change(patch) {
    if (!("dueOn" in patch)) return onChange(patch);
    const { dueOn: picked, ...rest } = patch;
    onChange({ ...rest, dueDay: dueDayFrom(picked, startsOn) });
  }

  return (
    <li className={m.task} data-kind={task.kind}>
      <div className={m.taskRow}>
        <div className={s.move}>
          <button type="button" className="rw-st-btn" aria-label={`Move ${name} up`} aria-disabled={first} onClick={() => !first && onMove(-1)}>
            Up
          </button>
          <button type="button" className="rw-st-btn" aria-label={`Move ${name} down`} aria-disabled={last} onClick={() => !last && onMove(1)}>
            Down
          </button>
        </div>
        <div className={m.taskMain}>
          <div className={m.taskName}>{name}</div>
          <div className={m.taskMeta}>
            {[...requirementWords(task), due].filter(Boolean).join(" · ")}
            {!task.instruction && <span className={s.needs}> · needs instructions</span>}
          </div>
        </div>
        <div className={m.taskActions}>
          <button type="button" className="rw-st-btn" aria-expanded={editing} onClick={onToggle}>
            {editing ? "Close" : "Edit"}
          </button>
          <button type="button" className="rw-st-btn" data-tone="quiet" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
      {editing && (
        <TaskFields
          task={{ ...task, dueOn }}
          sections={plan.sections}
          transitions={plan.transitions}
          dueMode={template ? "day" : "date"}
          minDue={startsOn ?? undefined}
          maxDue={startsOn ? addDays(startsOn, MAX_DUE_DAY) : undefined}
          onChange={change}
        />
      )}
    </li>
  );
}
