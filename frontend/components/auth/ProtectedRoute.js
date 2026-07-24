"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Gates any page/layout behind sign-in (and optionally a role allow-list).
// Renders nothing but a loading state until the auth check resolves, so
// protected content never flashes before the redirect happens.
export default function ProtectedRoute({ children, allow, fallbackHref = "/member" }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleAllowed = !allow || allow.includes(role);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!roleAllowed) {
      router.replace(fallbackHref);
    }
  }, [isLoading, isAuthenticated, roleAllowed, pathname, router, fallbackHref]);

  if (isLoading || !isAuthenticated || !roleAllowed) {
    return (
      <div style={{ maxWidth: 600, margin: "120px auto", textAlign: "center", color: "#6a6560" }}>
        Checking your session…
      </div>
    );
  }

  return children;
}
