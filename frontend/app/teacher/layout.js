"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ROLES } from "@/lib/auth/roles";

// The API decides what a teacher can see (only their linked students). This only
// keeps everyone else off pages that would show nothing.
export default function TeacherLayout({ children }) {
  return (
    <ProtectedRoute allow={[ROLES.TEACHER]}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px 100px" }}>{children}</div>
    </ProtectedRoute>
  );
}
