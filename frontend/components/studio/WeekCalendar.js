"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, api, clock, kindLabel, localDate, viewerZone, weekOf } from "@/lib/studio";

const DAY = { weekday: "short" };

// A week of everything on someone's calendar: what they teach, what they're enrolled in, and their
// children's classes. Times are shown in the viewer's own time zone, which is named above the
// grid. On a phone the week becomes a list of days.
export default function WeekCalendar({ linkFor = null, empty = "Nothing scheduled this week." }) {
  const zone = viewerZone();
  const today = localDate(new Date(), zone);
  const [week, setWeek] = useState(() => weekOf(today));
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    // A day either side, so a class late on Sunday in another zone isn't lost.
    const from = new Date(`${addDays(week, -1)}T00:00:00Z`).toISOString();
    const to = new Date(`${addDays(week, 8)}T00:00:00Z`).toISOString();
    api(`/calendar?from=${from}&to=${to}`)
      .then((d) => live && (setEvents(d.events), setError("")))
      .catch((err) => live && (setError(err.message), setEvents([])));
    return () => {
      live = false;
    };
  }, [week]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const onDay = (day) => (events || []).filter((e) => localDate(e.startsAt, zone) === day);
  const label = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
  const count = (events || []).filter((e) => days.includes(localDate(e.startsAt, zone)) && e.status !== "cancelled").length;

  const Event = ({ e }) => {
    const body = (
      <>
        <strong>{e.title}</strong>
        <span>
          {clock(e.startsAt, zone)}–{clock(e.endsAt, zone)}
        </span>
        <span>
          {e.status === "cancelled" ? "Cancelled" : e.as === "teaching" ? kindLabel(e.kind) : e.enrolment === "waitlisted" ? "On the waitlist" : e.as === "child" ? `${e.child?.name?.split(" ")[0] ?? "Your child"} · ${kindLabel(e.kind)}` : kindLabel(e.kind)}
          {e.moved && e.status !== "cancelled" ? " · moved" : ""}
        </span>
      </>
    );
    const href = linkFor?.(e);
    return href ? (
      <Link href={href} className="rw-cal-event" data-as={e.as} data-status={e.status} data-event={e.id}>
        {body}
      </Link>
    ) : (
      <div className="rw-cal-event" data-as={e.as} data-status={e.status} data-event={e.id}>
        {body}
        {e.meetingUrl && e.status !== "cancelled" && (
          <a href={e.meetingUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "var(--rw-orange-deep)" }}>
            Join the meeting
          </a>
        )}
      </div>
    );
  };

  return (
    <section className="rw-cal" aria-label="Calendar">
      <div className="rw-cal-bar">
        <div>
          <div className="rw-cal-range">
            {label(days[0])} – {label(days[6])}
          </div>
          <p className="rw-st-muted">
            {events === null ? "Loading…" : `${count} session${count === 1 ? "" : "s"} this week`} · times in {zone.replace(/_/g, " ")}
          </p>
        </div>
        <div className="rw-st-actions">
          <button type="button" className="rw-st-btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">
            ←
          </button>
          <button type="button" className="rw-st-btn" onClick={() => setWeek(weekOf(today))} disabled={week === weekOf(today)}>
            This week
          </button>
          <button type="button" className="rw-st-btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">
            →
          </button>
        </div>
      </div>
      {error && <p className="rw-st-error">{error}</p>}

      <div className="rw-cal-week">
        {days.map((day) => (
          <div key={day} className="rw-cal-day" data-today={day === today ? "true" : undefined}>
            <div className="rw-cal-date">
              {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...DAY, timeZone: "UTC" })} <b>{Number(day.slice(8))}</b>
            </div>
            {onDay(day).map((e) => (
              <Event key={`${e.id}-${e.as}-${e.child?.id ?? ""}`} e={e} />
            ))}
          </div>
        ))}
      </div>

      <div className="rw-cal-agenda">
        {count === 0 && events !== null ? (
          <p className="rw-st-muted">{empty}</p>
        ) : (
          days
            .filter((day) => onDay(day).length)
            .map((day) => (
              <div key={day} style={{ display: "grid", gap: 6 }}>
                <div className="rw-cal-date">
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...DAY, timeZone: "UTC" })} <b>{Number(day.slice(8))}</b>
                </div>
                {onDay(day).map((e) => (
                  <Event key={`${e.id}-${e.as}-${e.child?.id ?? ""}`} e={e} />
                ))}
              </div>
            ))
        )}
      </div>
    </section>
  );
}
