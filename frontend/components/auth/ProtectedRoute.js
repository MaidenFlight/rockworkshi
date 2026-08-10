"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { nextEnrolmentStep } from "@/lib/auth/enrolment";

// Gates any page/layout behind sign-in (and optionally a role allow-list).
// Renders nothing but a loading state until the auth check resolves, so
// protected content never flashes before the redirect happens.
//
// Signed-in users who haven't finished enrolling are also pushed to whatever
// step they still owe. The setup pages themselves pass requireEnrolment={false},
// otherwise they'd redirect to themselves forever.
export default function ProtectedRoute({
  children,
  allow,
  fallbackHref = "/member",
  requireEnrolment = true,
}) {
  const { user, isAuthenticated, isLoading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleAllowed = !allow || allow.includes(role);
  const pendingStep = requireEnrolment ? nextEnrolmentStep(user) : null;
  // Guard against redirecting to the page we're already on.
  const mustFinishSetup = Boolean(pendingStep) && pendingStep !== pathname;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!roleAllowed) {
      router.replace(fallbackHref);
      return;
    }
    if (mustFinishSetup) {
      router.replace(pendingStep);
    }
  }, [
    isLoading,
    isAuthenticated,
    roleAllowed,
    mustFinishSetup,
    pendingStep,
    pathname,
    router,
    fallbackHref,
  ]);

  if (isLoading || !isAuthenticated || !roleAllowed || mustFinishSetup) {
    return (
      <div style={{ maxWidth: 600, margin: "120px auto", textAlign: "center", color: "var(--rw-body)" }}>
        Checking your session…
      </div>
    );
  }

  return children;
}
