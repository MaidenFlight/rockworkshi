"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RockWorksIcon from "@/components/RockWorksIcon";
import { resetPassword } from "@/lib/auth/authApi";
import { PageHero } from "@/components/ui";

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
        <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "var(--rw-body-cool)" }}>
          It may have been cut short by your email app. Request a fresh one and try again.
        </p>
        <Link href="/forgot-password" style={{ color: "var(--rw-orange-deep)", fontWeight: 700, textDecoration: "none" }}>
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
        <p style={{ margin: 0, fontSize: 15, color: "var(--rw-body-cool)" }}>Taking you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55, color: "var(--rw-body-cool)" }}>
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
        <p role="alert" style={{ margin: "12px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
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
      <PageHero
        mark={<RockWorksIcon size={40} color="var(--rw-gold)" />}
        eyebrow="Account help"
        title="Set a new password"
        compact
      />

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
  borderRadius: "var(--rw-radius-field)",
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
