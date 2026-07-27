"use client";

import Link from "next/link";
import RockWorksIcon from "@/components/RockWorksIcon";
import SignupWizard from "@/components/auth/SignupWizard";

export default function SignUp() {
  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={40} color="#ffcf8f" />
          </div>
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            Join Rock Works
          </div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Sign up
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <SignupWizard mode="signup" />

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "#7a6d78" }}>
            Already have an account?{" "}
            <Link href="/signin" style={{ color: "#cf3f20", fontWeight: 700, textDecoration: "none" }}>
              Sign in here.
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
