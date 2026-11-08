"use client";

import { useEffect, useState } from "react";
import { icsHref } from "@/lib/ics";
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
    <section className="rw-st-card" aria-labelledby="upcoming-classes">
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
            ) : (
              <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {e.meetingUrl && (
                  <a href={e.meetingUrl} target="_blank" rel="noreferrer" className="rw-st-btn">
                    Join the meeting
                  </a>
                )}
                <a
                  href={icsHref(e, { kindLabel: kindLabel(e.kind) })}
                  download={`rock-works-${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`}
                  className="rw-st-btn"
                  aria-label={`Add ${e.title}, ${when(e.startsAt)}, to your calendar`}
                >
                  Add to calendar
                </a>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
