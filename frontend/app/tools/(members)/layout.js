"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

// The chord library, piano and rhythm trainer come with membership. The tuner and metronome sit
// outside this group and are open to everyone. A route group, so the URLs don't change.
export default function MemberToolsLayout({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
