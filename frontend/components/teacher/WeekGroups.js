"use client";

import { WEEKS } from "@/lib/months";
import s from "./Month.module.css";

// A month laid out by week: the small checkpoints, then the assessment they lead to. Used for a draft
// and for a month that's been set. renderTask draws one task, title a week's name (text or a box to
// change it), and foot anything that goes after a week's tasks.
export default function WeekGroups({ tasks, title, renderTask, foot }) {
  return WEEKS.map((week) => {
    const here = tasks.filter((t) => t.week === week);
    const checkpoints = here.filter((t) => t.kind === "checkpoint");
    const assessments = here.filter((t) => t.kind === "assessment");
    return (
      <section key={week} className={s.week} aria-labelledby={`month-week-${week}`}>
        <div className={s.weekHead}>
          <h2 id={`month-week-${week}`} className={s.weekNumber}>
            Week {week}
          </h2>
          {title(week)}
        </div>
        {here.length === 0 && <p className="rw-st-muted">Nothing set for this week.</p>}
        {checkpoints.length > 0 && (
          <div className={s.group}>
            <h3 className={s.groupName}>Milestones</h3>
            <ul className={s.tasks}>{checkpoints.map((t) => renderTask(t))}</ul>
          </div>
        )}
        {assessments.length > 0 && (
          <div className={s.group}>
            <h3 className={s.groupName}>Weekly assessment</h3>
            <ul className={s.tasks}>{assessments.map((t) => renderTask(t))}</ul>
          </div>
        )}
        {foot?.(week)}
      </section>
    );
  });
}
