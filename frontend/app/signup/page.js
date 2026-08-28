"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import RockWorksIcon from "@/components/RockWorksIcon";
import SignupWizard from "@/components/auth/SignupWizard";
import { matchInstrument } from "@/lib/auth/signupOptions";
import { PageHero } from "@/components/ui";

// The param is read here rather than inside the wizard because
// app/onboarding/page.js renders that same component, and onboarding has no
// business reading a signup link's query string.
//
// useSearchParams opts this subtree out of prerendering, which Next only
// allows behind a Suspense boundary — hence the split. The fallback is the
// wizard itself with no instrument, so the static HTML is the finished form at
// its finished size: no spinner, no reflow, and the only thing that changes at
// hydration is a line of text that was never in the server's HTML to begin
// with.
function SignupFromLink() {
  const params = useSearchParams();
  return <SignupWizard mode="signup" instrument={matchInstrument(params.get("instrument"))} />;
}

export default function SignUp() {
  return (
    <div>
      <PageHero mark={<RockWorksIcon size={40} color="var(--rw-gold)" />} eyebrow="Join Rock Works" title={<>Sign up</>} compact />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <Suspense fallback={<SignupWizard mode="signup" />}>
          <SignupFromLink />
        </Suspense>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "#7a6d78" }}>
            Already have an account?{" "}
            <Link href="/signin" style={{ color: "var(--rw-orange-deep)", fontWeight: 700, textDecoration: "none" }}>
              Sign in here.
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
