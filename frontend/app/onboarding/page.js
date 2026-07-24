"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RockWorksIcon from "@/components/RockWorksIcon";
import SignupWizard from "@/components/auth/SignupWizard";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/auth/roles";

function OnboardingContent() {
  const { user, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.profileComplete) {
      router.replace(role === ROLES.ADMINISTRATOR ? "/admin" : "/member");
    }
  }, [user, role, router]);

  if (user?.profileComplete) return null;

  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={40} color="#ffcf8f" />
          </div>
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            Almost there
          </div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(34px,4.6vw,50px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Finish setting up your account
          </h1>
          <p style={{ margin: "14px 0 0", fontSize: 15.5, color: "rgba(255,245,236,0.82)" }}>
            You signed in with Google — just a few quick questions so we can build your curriculum.
          </p>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <SignupWizard mode="onboarding" />
      </div>
    </div>
  );
}

export default function Onboarding() {
  return (
    <ProtectedRoute>
      <OnboardingContent />
    </ProtectedRoute>
  );
}
