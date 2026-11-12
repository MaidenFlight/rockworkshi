"use client";

import { useState } from "react";
import s from "@/components/teacher/Plans.module.css";

// Choosing who a plan is for: anyone the teacher teaches, or everyone in one of their classes. Someone in
// a class who isn't linked to the teacher can't be chosen, and says why: enrolment and links are the
// school office's. Someone who studies a different instrument isn't added with their class, but can be
// ticked. given says who already has the month, and can't be taken off it.
export default function Audience({ roster, selected, classId, instrument, given = [], notes = {}, onChange, busy = false }) {
  const [filter, setFilter] = useState("");
  const chosenClass = roster.classes.find((c) => c.id === classId);
  const unavailable = chosenClass?.members.filter((m) => !m.linked) ?? [];
  const words = filter.trim().toLowerCase();
  const shown = roster.students.filter((p) => !words || (p.name || "").toLowerCase().includes(words));

  function chooseClass(id) {
    const cls = roster.classes.find((c) => c.id === id);
    const adding = cls ? cls.members.filter((m) => m.linked && m.instrument === instrument).map((m) => m.id) : [];
    onChange({ classId: id || null, studentIds: [...new Set([...selected, ...adding])] });
  }

  function toggle(id, on) {
    onChange({ classId, studentIds: on ? [...selected, id] : selected.filter((x) => x !== id) });
  }

  if (!roster.students.length && !roster.classes.length) {
    return <p className="rw-st-muted">No students are linked to you yet. The school office links students to teachers in Admin.</p>;
  }

  return (
    <div className={s.fieldStack}>
      {roster.classes.length > 0 && (
        <label className="rw-st-field">
          Add a class
          <select value={classId ?? ""} disabled={busy} onChange={(e) => chooseClass(e.target.value)}>
            <option value="">No class</option>
            {roster.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {roster.students.length > 8 && (
        <label className="rw-st-field">
          Find a student
          <input className={s.filter} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name" />
        </label>
      )}
      {shown.length === 0 && <p className="rw-st-muted">{roster.students.length ? "Nobody by that name." : "No students are linked to you yet."}</p>}
      <ul className={s.people}>
        {shown.map((p) => {
          const has = given.includes(p.id);
          return (
            <li key={p.id}>
              <label className={s.personRow}>
                <input type="checkbox" checked={has || selected.includes(p.id)} disabled={has || busy} onChange={(e) => toggle(p.id, e.target.checked)} />
                <span>
                  {p.name || "Unnamed student"}
                  <span className={s.personMeta}>{` · ${p.instrument || "no instrument"}${has ? " · has this month" : ""}`}</span>
                </span>
              </label>
              {(notes[p.id] || []).map((note) => (
                <p key={note} className={s.personNote}>
                  {note}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
      {unavailable.length > 0 && (
        <div>
          <p className={s.sectionName}>In this class, but not linked to you</p>
          <p className="rw-st-muted">
            {`${unavailable.map((m) => m.name || "Unnamed student").join(", ")} can't be given this until the school office links them to you in Admin.`}
          </p>
        </div>
      )}
    </div>
  );
}
