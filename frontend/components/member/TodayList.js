"use client";

import { useState } from "react";
import { formatClock } from "@/lib/practice";
import { hasLoop } from "@/lib/teaching";

// Today's steps for the teacher's open work, built only from what the assignment holds: the
// section to loop, the lesson to watch, and the take to send. Ticks stay in this browser for
// the day; nothing is reported to anyone.
export function stepsFor(assignment) {
  if (!assignment) return [];
  const steps = [];
  if (assignment.lesson) steps.push({ id: "lesson", text: `Watch the lesson: ${assignment.lesson.title}` });
  if (assignment.song && hasLoop(assignment)) {
    const part = assignment.section || `${formatClock(assignment.sectionStart)} to ${formatClock(assignment.sectionEnd)}`;
    steps.push({ id: "loop", text: `Loop ${part} until it feels easy` });
  }
  if (assignment.song) steps.push({ id: "send", text: "Record a take and send it to your teacher" });
  return steps;
}

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the viewer's zone
const keyFor = (id) => `rw-today:${id}:${today()}`;

function readTicks(id) {
  try {
    return JSON.parse(window.localStorage.getItem(keyFor(id)) || "[]");
  } catch {
    return [];
  }
}

export default function TodayList({ assignment }) {
  const steps = stepsFor(assignment);
  const [ticked, setTicked] = useState(() => readTicks(assignment.id));
  if (steps.length < 2) return null; // one step is just the button above it

  function toggle(stepId) {
    const next = ticked.includes(stepId) ? ticked.filter((t) => t !== stepId) : [...ticked, stepId];
    setTicked(next);
    try {
      window.localStorage.setItem(keyFor(assignment.id), JSON.stringify(next));
    } catch {
      // Only a convenience: the ticks just won't survive a reload.
    }
  }

  const done = steps.filter((s) => ticked.includes(s.id)).length;
  return (
    <fieldset className="rw-today">
      <legend className="rw-today-legend">
        Today <span className="rw-today-count">{done} of {steps.length} done</span>
      </legend>
      {steps.map((s) => (
        <label key={s.id} className="rw-today-step">
          <input type="checkbox" checked={ticked.includes(s.id)} onChange={() => toggle(s.id)} />
          <span>{s.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
