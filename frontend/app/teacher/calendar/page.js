"use client";

import Link from "next/link";
import WeekCalendar from "@/components/studio/WeekCalendar";

export default function TeacherCalendarPage() {
  return (
    <div className="rw-st">
      <div className="rw-st-head">
        <div>
          <h1 className="rw-st-title">Calendar</h1>
          <p className="rw-st-lead">Every lesson, class and rehearsal you teach. Open one to take attendance or change a single session.</p>
        </div>
        <Link href="/teacher/classes/new" className="rw-st-btn" data-tone="primary">
          New class
        </Link>
      </div>
      <WeekCalendar linkFor={(e) => (e.as === "teaching" ? `/teacher/classes/${e.classId}#session-${e.id}` : null)} empty="Nothing scheduled this week. Create a class to fill your calendar." />
    </div>
  );
}
