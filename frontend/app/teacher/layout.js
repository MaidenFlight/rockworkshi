"use client";

import Link from "next/link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SectionTabs from "@/components/studio/SectionTabs";
import { useAuth } from "@/contexts/AuthContext";

const TABS = [
  { href: "/teacher", label: "Assignments", exact: true, also: ["/teacher/assignments", "/teacher/new"] },
  { href: "/teacher/calendar", label: "Calendar" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/students", label: "Students" },
];

// The API decides what a teacher can see (only their linked students). This only keeps everyone else
// off pages that would show nothing. Someone who also runs the school keeps a way across to Admin.
export default function TeacherLayout({ children }) {
  return (
    <ProtectedRoute holding="teacher">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 100px" }}>
        <StudioHead />
        <SectionTabs tabs={TABS} label="Teacher Studio" />
        {children}
      </div>
    </ProtectedRoute>
  );
}

function StudioHead() {
  const { user } = useAuth();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
      <div className="rw-st-kicker" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--rw-teal)" }}>
        Teacher Studio
      </div>
      {user?.isAdmin && (
        <Link href="/admin" className="rw-st-btn" style={{ minHeight: 44 }}>
          Go to Admin
        </Link>
      )}
    </div>
  );
}
