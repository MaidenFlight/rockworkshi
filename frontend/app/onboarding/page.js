"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RockWorksIcon from "@/components/RockWorksIcon";
import SignupWizard from "@/components/auth/SignupWizard";
import { useAuth } from "@/contexts/AuthContext";
import { destinationFor } from "@/lib/auth/enrolment";
import { PageHero } from "@/components/ui";

function OnboardingContent() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Questions already answered — move on to whatever is still outstanding
    // (checkout, normally) rather than assuming the dashboard.
    if (user?.profileComplete) {
      router.replace(destinationFor(user));
    }
  }, [user, router]);

  if (user?.profileComplete) return null;

  return (
    <div>
      <PageHero
        mark={<RockWorksIcon size={40} color="var(--rw-gold)" />}
        eyebrow="Almost there"
        title="Finish setting up your account"
        lead="Just a few quick questions so we can build your curriculum."
        compact
      />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <SignupWizard mode="onboarding" />
      </div>
    </div>
  );
}

export default function Onboarding() {
  return (
    // requireEnrolment={false}: this page *is* one of the enrolment steps.
    <ProtectedRoute requireEnrolment={false}>
      <OnboardingContent />
    </ProtectedRoute>
  );
}
