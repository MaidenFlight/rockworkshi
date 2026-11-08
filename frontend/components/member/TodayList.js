"use client";

import { useState } from "react";
import { formatClock } from "@/lib/practice";
import { hasLoop } from "@/lib/teaching";

// The instruments with strings to tune first. Mirrors the tuner's own (components/tuner/Tuner.js).
export const TUNED = ["Guitar", "Bass", "Ukulele"];

// Today's steps for the teacher's open work, built only from what the assignment holds: tuning up
// (a string instrument), the section to loop, the lesson to watch, and the take to send. The guided
// practice session (PracticeSession.js) walks through the same steps and ticks them. Ticks stay in this
// browser for the day; nothing is reported to anyone.
export function stepsFor(assignment) {
  if (!assignment) return [];
  const steps = [];
  if (assignment.song && TUNED.includes(assignment.instrument)) steps.push({ id: "tune", text: "Tune up" });
  if (assignment.lesson) steps.push({ id: "lesson", text: `Watch the lesson: ${assignment.lesson.title}` });
  if (assignment.song && hasLoop(assignment)) {
    const part = assignment.section || `${formatClock(assignment.sectionStart)} to ${formatClock(assignment.sectionEnd)}`;
    steps.push({ id: "loop", text: `Loop ${part} until it feels easy` });
  }
  if (assignment.song) steps.push({ id: "send", text: assignment.week ? (assignment.kind === "checkpoint" ? "Record a take and save it" : "Record a take and submit it to your teacher") : "Record a take and send it to your teacher" });
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

// Ticks one of today's steps from elsewhere: the guided practice session, as each step is done.
export function tickToday(assignmentId, stepId) {
  const ticked = readTicks(assignmentId);
  if (ticked.includes(stepId)) return;
  try {
    window.localStorage.setItem(keyFor(assignmentId), JSON.stringify([...ticked, stepId]));
  } catch {
    // Only a convenience: the dashboard just won't show it ticked.
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
