"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RockWorksIcon from "@/components/RockWorksIcon";
import { resetPassword } from "@/lib/auth/authApi";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      // Resetting signs out every existing session, so send them to sign in
      // with the new password rather than assuming they're already through.
      setTimeout(() => router.push("/signin"), 1600);
    } catch (err) {
      setError(err.message || "Could not reset your password.");
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🤔</div>
        <h2 style={titleStyle}>That link didn&apos;t work</h2>
        <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "#5f6f79" }}>
          It may have been cut short by your email app. Request a fresh one and try again.
        </p>
        <Link href="/forgot-password" style={{ color: "#cf3f20", fontWeight: 700, textDecoration: "none" }}>
          Send a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🌺</div>
        <h2 style={titleStyle}>Password updated</h2>
        <p style={{ margin: 0, fontSize: 15, color: "#5f6f79" }}>Taking you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "#5f6f79" }}>
        Choose a new password for your account.
      </p>
      <label style={fieldLabelStyle}>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
      </label>
      <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
        Confirm new password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          autoComplete="new-password"
          required
        />
      </label>

      {error && (
        <p role="alert" style={{ margin: "12px 2px 0", fontSize: 13.5, color: "#cf3f20" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
        {submitting ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPassword() {
  return (
    <div>
      <section style={heroStyle}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={40} color="#ffcf8f" />
          </div>
          <div style={eyebrowStyle}>Account help</div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(34px,4.6vw,50px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Set a new password
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
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
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
