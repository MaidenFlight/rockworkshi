"use client";

import { useEffect, useState } from "react";
import { api, kindLabel, when } from "@/lib/studio";

const DAYS_AHEAD = 21;

// The student's next few classes, with the meeting link once they have a place. Shows nothing for
// a student who isn't in any class, so the dashboard doesn't fill with an empty box.
export default function UpcomingClasses() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    const from = new Date();
    const to = new Date(from.getTime() + DAYS_AHEAD * 86400000);
    api(`/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((d) => setEvents(d.events.filter((e) => e.as === "learning" && e.status === "scheduled").slice(0, 4)))
      .catch(() => setEvents([]));
  }, []);

  if (!events?.length) return null;
  return (
    <section className="rw-st-card" aria-labelledby="upcoming-classes" style={{ marginBottom: 24 }}>
      <h2 id="upcoming-classes">Your next classes</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {events.map((e) => (
          <li key={e.id} data-upcoming-class={e.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px" }}>
            <strong style={{ color: "var(--rw-ink)" }}>{e.title}</strong>
            <span>{when(e.startsAt)}</span>
            <span className="rw-st-muted">
              {kindLabel(e.kind)}
              {e.teacher?.name ? ` with ${e.teacher.name}` : ""}
            </span>
            {e.enrolment === "waitlisted" ? (
              <span className="rw-st-chip" data-tone="warn">
                On the waitlist
              </span>
            ) : e.meetingUrl ? (
              <a href={e.meetingUrl} target="_blank" rel="noreferrer" className="rw-st-btn" data-size="small">
                Join the meeting
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
