"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function MemberLayout({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
