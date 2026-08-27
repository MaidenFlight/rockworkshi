"use client";

import Link from "next/link";
import RockWorksIcon from "@/components/RockWorksIcon";
import SignupWizard from "@/components/auth/SignupWizard";
import { PageHero } from "@/components/ui";

export default function SignUp() {
  return (
    <div>
      <PageHero mark={<RockWorksIcon size={40} color="var(--rw-gold)" />} eyebrow="Join Rock Works" title={<>Sign up</>} compact />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <SignupWizard mode="signup" />

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
