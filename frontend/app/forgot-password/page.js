"use client";

import { useState } from "react";
import Link from "next/link";
import RockWorksIcon from "@/components/RockWorksIcon";
import { requestPasswordReset } from "@/lib/auth/authApi";
import { PageHero } from "@/components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      // Deliberately the same message whether or not that address is
      // registered — the server answers the same way for the same reason.
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHero
        mark={<RockWorksIcon size={40} color="#ffcf8f" />}
        eyebrow="Account help"
        title="Reset your password"
        compact
      />

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "40px 24px 90px" }}>
        <div style={cardStyle}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>📬</div>
              <h2 style={titleStyle}>Check your inbox</h2>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "var(--rw-body-cool)" }}>
                If an account exists for <strong style={{ color: "var(--rw-ink)" }}>{email.trim()}</strong>, we&apos;ve
                sent a link to set a new password. It&apos;s good for 1 hour.
              </p>
              <Link href="/signin" style={{ color: "var(--rw-orange-deep)", fontWeight: 700, textDecoration: "none" }}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "var(--rw-body-cool)" }}>
                Enter your email address and we&apos;ll send you a link to set a new password.
              </p>
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

              {error && (
                <p role="alert" style={{ margin: "10px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>

              <p style={{ margin: "18px 2px 0", fontSize: 13.5, color: "#7a6d78", textAlign: "center" }}>
                Remembered it?{" "}
                <Link href="/signin" style={{ color: "var(--rw-orange-deep)", fontWeight: 700, textDecoration: "none" }}>
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: 16,
  padding: 32,
  boxShadow: "0 26px 54px -34px rgba(90,40,70,0.4)",
};

const titleStyle = {
  fontFamily: "var(--font-zilla-slab), serif",
  fontWeight: 600,
  fontSize: 24,
  margin: "0 0 10px",
  color: "var(--rw-ink)",
};

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13.5,
  fontWeight: 700,
  color: "var(--rw-prose)",
};

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--rw-line)",
  fontSize: 15,
  fontFamily: "inherit",
  color: "var(--rw-ink)",
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
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  boxShadow: "0 12px 26px -12px var(--rw-orange)",
};
