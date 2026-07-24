"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function ToolsLayout({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
