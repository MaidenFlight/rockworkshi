"use client";

import { useState } from "react";
import Link from "next/link";
import RockWorksIcon from "@/components/RockWorksIcon";
import { requestPasswordReset } from "@/lib/auth/authApi";

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
      <section style={heroStyle}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={40} color="#ffcf8f" />
          </div>
          <div style={eyebrowStyle}>Account help</div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(34px,4.6vw,50px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Reset your password
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "40px 24px 90px" }}>
        <div style={cardStyle}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>📬</div>
              <h2 style={titleStyle}>Check your inbox</h2>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "#5f6f79" }}>
                If an account exists for <strong style={{ color: "#0a2338" }}>{email.trim()}</strong>, we&apos;ve
                sent a link to set a new password. It&apos;s good for 1 hour.
              </p>
              <Link href="/signin" style={{ color: "#cf3f20", fontWeight: 700, textDecoration: "none" }}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "#5f6f79" }}>
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
                <p role="alert" style={{ margin: "10px 2px 0", fontSize: 13.5, color: "#cf3f20" }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>

              <p style={{ margin: "18px 2px 0", fontSize: 13.5, color: "#7a6d78", textAlign: "center" }}>
                Remembered it?{" "}
                <Link href="/signin" style={{ color: "#cf3f20", fontWeight: 700, textDecoration: "none" }}>
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

const heroStyle = {
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)",
};

const eyebrowStyle = {
  display: "inline-block",
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#ffd89a",
  marginBottom: 14,
};

const cardStyle = {
  background: "#fffdf9",
  border: "1px solid #ece0d5",
  borderRadius: 16,
  padding: 32,
  boxShadow: "0 26px 54px -34px rgba(90,40,70,0.4)",
};

const titleStyle = {
  fontFamily: "var(--font-zilla-slab), serif",
  fontWeight: 600,
  fontSize: 24,
  margin: "0 0 10px",
  color: "#0a2338",
};

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
