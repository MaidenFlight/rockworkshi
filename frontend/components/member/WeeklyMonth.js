"use client";

import { useEffect, useState } from "react";
import { WEEKS, currentMonth, dayLabel, groupMonths, isDone, stillToPractise, todayHere, weekOf } from "@/lib/months";
import { takeDetails, takeKey } from "@/lib/takeStore";
import Icon from "./Icon";
import { Task } from "./MonthlyChecklist";
import list from "./MonthlyChecklist.module.css";
import s from "./WeeklyMonth.module.css";

// A month of work on one song, by week: each week's small practice checkpoints, then the assessment they
// lead to. It opens on this week, says what still needs practice and what the teacher wants worked on
// next, and earlier months fold away. priorities is the API's { monthId: { list, section } }. `currentId`
// is the task on the practice panel above, marked Today. Draws nothing without a month.
export default function WeeklyMonth({ assignments, priorities, currentId }) {
  const months = groupMonths(assignments ?? []);
  const today = todayHere();
  const month = currentMonth(months, today);
  const kept = useKeptTakes(month);
  if (!month) return null;

  const week = weekOf(month.startsOn, today);
  const done = month.tasks.filter(isDone).length;
  const still = stillToPractise(month, week);
  const asked = priorities?.[month.id];
  const teacher = month.teacher?.name?.split(" ")[0];

  return (
    <section aria-labelledby="month-weeks">
      <div className={list.head}>
        <h2 id="month-weeks" className="rw-dash-h2">
          {month.song?.title ?? "This month's song"}
        </h2>
        <span className={list.count}>
          {done} of {month.tasks.length} done
        </span>
      </div>
      <div className={list.bar} aria-hidden="true">
        <span style={{ width: `${(done / month.tasks.length) * 100}%` }} />
      </div>

      {asked?.list.length > 0 && (
        <div className={s.priorities}>
          <h3 className={s.prioritiesTitle}>{teacher ? `${teacher}'s` : "Your teacher's"} priorities</h3>
          <ul>
            {asked.list.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {still.length > 0 && (
        <p className={s.still}>
          <strong>Still to practise:</strong> {still.map((t) => t.section || "Untitled").join(", ")}
        </p>
      )}

      {WEEKS.map((n) => (
        <Week key={n} number={n} month={month} now={n === week} currentId={currentId} kept={kept} open={n === week} />
      ))}

      {months
        .filter((m) => m !== month)
        .map((m) => (
          <details key={m.id} className={list.month}>
            <summary>
              {m.song?.title ?? "Earlier song"}, from {dayLabel(m.startsOn)} · {m.tasks.filter(isDone).length} of {m.tasks.length} done
            </summary>
            {WEEKS.map((n) => (
              <Week key={n} number={n} month={m} kept={new Set()} />
            ))}
          </details>
        ))}
    </section>
  );
}

// Which of the month's tasks have a take waiting in this browser, by id.
function useKeptTakes(month) {
  const [kept, setKept] = useState(() => new Set());
  const ids = month?.tasks.map((t) => t.id).join(",") ?? "";
  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    Promise.all(month.tasks.filter((t) => t.song).map(async (t) => [t.id, await takeDetails(takeKey(t.song.id, t.id))])).then((found) => {
      if (!cancelled) setKept(new Set(found.filter(([, details]) => details).map(([id]) => id)));
    });
    return () => {
      cancelled = true;
    };
    // The ids say everything about which tasks these are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return kept;
}

// One week of the month. renderTask replaces the row, for a teacher's preview of what the student will get.
export function Week({ number, month, now = false, currentId = null, kept, open = false, renderTask }) {
  const tasks = month.tasks.filter((t) => t.week === number);
  if (!tasks.length) return null;
  const checkpoints = tasks.filter((t) => t.kind === "checkpoint");
  const assessments = tasks.filter((t) => t.kind === "assessment");
  const due = tasks.map((t) => t.dueOn).filter(Boolean).sort().at(-1);
  const row = renderTask ?? ((t) => <Task key={t.id} task={t} current={t.id === currentId} kept={kept.has(t.id)} />);

  return (
    <details className={s.week} open={open}>
      <summary>
        <span className={s.chevron} aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
        <h3 className={s.weekNumber}>Week {number}</h3>
        <span className={s.weekName}>{month.weekTitles?.[number - 1]}</span>
        {now && <span className={s.now}>This week</span>}
        <span className={s.weekMeta}>
          {tasks.filter(isDone).length} of {tasks.length} done{due ? ` · due ${dayLabel(due)}` : ""}
        </span>
      </summary>
      <div className={s.weekBody}>
        {checkpoints.length > 0 && (
          <div>
            <h4 className={s.kind}>Practice checkpoints</h4>
            <ol className={list.list}>{checkpoints.map(row)}</ol>
          </div>
        )}
        {assessments.length > 0 && (
          <div>
            <h4 className={s.kind}>Weekly assessment</h4>
            <ol className={list.list}>{assessments.map(row)}</ol>
          </div>
        )}
      </div>
    </details>
  );
}
