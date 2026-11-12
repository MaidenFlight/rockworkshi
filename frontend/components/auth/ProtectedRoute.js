"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { nextEnrolmentStep } from "@/lib/auth/enrolment";
import { holds } from "@/lib/auth/roles";
import RockWorksIcon from "@/components/RockWorksIcon";

// Gates any page/layout behind sign-in, and optionally a role: allow lists main roles; holding names a
// role someone only has to have among others, so a teacher who is also the admin gets in.
export default function ProtectedRoute({
  children,
  allow,
  holding,
  fallbackHref = "/member",
  requireEnrolment = true,
}) {
  const { user, isAuthenticated, isLoading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleAllowed = holding ? holds(user, holding) : !allow || allow.includes(role);
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
      <div className="rw-gate" role="status" aria-live="polite">
        <RockWorksIcon size={34} color="var(--rw-orange)" />
        <p className="rw-gate-text">Checking your session…</p>
      </div>
    );
  }

  return children;
}
