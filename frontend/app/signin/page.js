"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RockWorksIcon from "@/components/RockWorksIcon";
import { nextEnrolmentStep, dashboardFor } from "@/lib/auth/enrolment";

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isEmailValid(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      setSuccess(true);
      const next = searchParams.get("next");
      // An unfinished enrolment outranks ?next — the guard would bounce them
      // there anyway, and going straight there avoids a visible double redirect.
      const dest =
        nextEnrolmentStep(user) ||
        (next && next.startsWith("/") ? next : dashboardFor(user));
      setTimeout(() => router.push(dest), 500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={40} color="#ffcf8f" />
          </div>
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            Welcome back
          </div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Sign in
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "36px 24px 90px" }}>
        <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 16, padding: 32, boxShadow: "0 26px 54px -34px rgba(90,40,70,0.4)" }}>
          {success ? (
            <p role="status" style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#0e8a97", textAlign: "center" }}>
              Signed in! Taking you to your dashboard…
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <label style={fieldLabelStyle}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label style={{ ...fieldLabelStyle, marginTop: 14 }}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error && (
                <p role="alert" style={{ margin: "10px 2px 0", fontSize: 13.5, color: "#cf3f20" }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
                {submitting ? "Signing in…" : "Sign in"}
              </button>

              <p style={{ margin: "16px 2px 0", fontSize: 13.5, textAlign: "center" }}>
                <Link href="/forgot-password" style={{ color: "#0e8a97", fontWeight: 700, textDecoration: "none" }}>
                  Forgot your password?
                </Link>
              </p>

              <p style={{ margin: "18px 2px 0", fontSize: 13.5, color: "#7a6d78" }}>
                No account yet?{" "}
                <Link href="/signup" style={{ color: "#cf3f20", fontWeight: 700, textDecoration: "none" }}>
                  Sign up here.
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13.5,
  fontWeight: 700,
  color: "#33454f",
};

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d8cab8",
  fontSize: 15,
  fontFamily: "inherit",
  color: "#0a2338",
};

const ctaButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  marginTop: 20,
  padding: "14px 22px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 15.5,
  color: "#fff",
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(135deg,#ef5130,#cf3f20)",
  boxShadow: "0 12px 26px -12px #ef5130",
};
