"use client";

import s from "@/components/teacher/Plans.module.css";
import { STATUS_LABELS } from "@/lib/teaching";
import { count, fieldName, fieldValue, taskPlace } from "@/lib/plans";

const longText = (field) => field === "instruction";

function ChangeLine({ change }) {
  const { field, from, to } = change;
  if (longText(field)) {
    return (
      <div className={s.changeLine}>
        <strong>{fieldName(field)}</strong> change to: {to || "None"}
      </div>
    );
  }
  return (
    <div className={s.changeLine}>
      <strong>{fieldName(field)}</strong>: {fieldValue(field, from)} → {fieldValue(field, to)}
    </div>
  );
}

function KeptLine({ item, who }) {
  return <div className={s.changeLine}>{`${who}'s own ${fieldName(item.field).toLowerCase()} stays: ${fieldValue(item.field, item.value)}`}</div>;
}

// What a change does to a list of tasks: for one student's month, or for a plan taking a template's update.
// who is the name for whose own settings are kept.
export function TaskChanges({ changes = [], adds = [], removes = [], keeps = [], who }) {
  return (
    <ul className={s.changeList}>
      {changes.map((c) => (
        <li key={c.taskId}>
          <div className={s.changeName}>{`${taskPlace(c)}: ${c.label}`}</div>
          {c.fields.map((f) => (
            <ChangeLine key={f.field} change={f} />
          ))}
          {c.individual.map((k) => (
            <KeptLine key={k.field} item={k} who={who} />
          ))}
          {c.attempts > 0 && c.fields.length > 0 && <div className={s.changeLine}>{`${count(c.attempts, "take")} already sent ${c.attempts === 1 ? "stays" : "stay"} as ${c.attempts === 1 ? "it was" : "they were"}.`}</div>}
          {c.status && c.statusAfter !== c.status && <div className={s.changeLine}>{`Status moves from ${STATUS_LABELS[c.status]} to ${STATUS_LABELS[c.statusAfter]}.`}</div>}
        </li>
      ))}
      {adds.map((a) => (
        <li key={a.taskId}>
          <div className={s.changeName}>{`New: ${taskPlace(a)}: ${a.label}`}</div>
        </li>
      ))}
      {removes.map((r) => (
        <li key={r.taskId}>
          <div className={s.changeName}>{`Removed: ${taskPlace(r)}: ${r.label}`}</div>
        </li>
      ))}
      {keeps.map((k) => (
        <li key={k.taskId}>
          <div className={s.changeName}>{`Stays: ${taskPlace(k)}: ${k.label}`}</div>
          <div className={s.changeLine}>{k.attempts ? `${who} has sent ${count(k.attempts, "take")} for it, so it isn't removed.` : `${who} has changed it, so it isn't removed.`}</div>
        </li>
      ))}
    </ul>
  );
}

export function MonthFieldLines({ fields = [], kept = [], who }) {
  return (
    <>
      {fields.map((f) => (
        <ChangeLine key={f.field} change={f} />
      ))}
      {kept.map((k) => (
        <KeptLine key={k.field} item={k} who={who} />
      ))}
    </>
  );
}
