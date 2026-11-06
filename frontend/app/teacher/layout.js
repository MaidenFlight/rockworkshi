"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SectionTabs from "@/components/studio/SectionTabs";
import { ROLES } from "@/lib/auth/roles";

const TABS = [
  { href: "/teacher", label: "Assignments", exact: true, also: ["/teacher/assignments", "/teacher/new"] },
  { href: "/teacher/calendar", label: "Calendar" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/students", label: "Students" },
];

// The API decides what a teacher can see (only their linked students). This only
// keeps everyone else off pages that would show nothing.
export default function TeacherLayout({ children }) {
  return (
    <ProtectedRoute allow={[ROLES.TEACHER]}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 100px" }}>
        <div className="rw-st-kicker" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 8 }}>
          Teacher Studio
        </div>
        <SectionTabs tabs={TABS} label="Teacher Studio" />
        {children}
      </div>
    </ProtectedRoute>
  );
}
