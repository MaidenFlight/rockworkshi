"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import RockWorksIcon from "@/components/RockWorksIcon";
import { useAuth } from "@/contexts/AuthContext";
import { resendVerification, verifyEmailToken } from "@/lib/auth/authApi";
import { destinationFor } from "@/lib/auth/enrolment";
import { PageHero } from "@/components/ui";

// Copy for each outcome the API can redirect back with.
const OUTCOMES = {
  success: {
    emoji: "🌺",
    title: "Email confirmed",
    body: "Thanks! Your address is verified — let's finish setting up your account.",
  },
  already: {
    emoji: "👍",
    title: "Already confirmed",
    body: "This address was verified earlier. You're good to go.",
  },
  expired: {
    emoji: "⏳",
    title: "That link expired",
    body: "Verification links last 24 hours. Sign in and request a fresh one.",
  },
  invalid: {
    emoji: "🤔",
    title: "That link didn't work",
    body: "It may have already been used, or been cut short by your email app. Request a new one below.",
  },
};

function VerifyEmailContent() {
  const { user, isLoading, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState(null);
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent
  const [resendError, setResendError] = useState("");

  const outcome = status ? OUTCOMES[status] || OUTCOMES.invalid : null;

  // Arrived from the emailed link: redeem the token, then re-read the session so
  // the route guard sees the address as confirmed rather than bouncing us back.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmailToken(token)
      .then(async (result) => {
        if (cancelled) return;
        setStatus(result);
        if (result === "success" || result === "already") await refresh();
      })
      .catch(() => {
        if (!cancelled) setStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Once verified, move on to whatever is still outstanding.
  useEffect(() => {
    if (!isLoading && user?.emailVerified) {
      router.replace(destinationFor(user));
    }
  }, [isLoading, user, router]);

  async function handleResend() {
    setResendError("");
    setResendState("sending");
    try {
      await resendVerification();
      setResendState("sent");
    } catch (err) {
      setResendError(err.message || "Could not send the email.");
      setResendState("idle");
    }
  }

  // Redeeming the token from the link — don't flash "check your inbox" at
  // someone who just clicked it.
  if (token && !status) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>📬</div>
        <h2 style={titleStyle}>Confirming your email…</h2>
      </div>
    );
  }

  // A result from the emailed link, shown whether or not they're signed in here.
  if (outcome) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>{outcome.emoji}</div>
        <h2 style={titleStyle}>{outcome.title}</h2>
        <p style={{ margin: "0 0 22px", fontSize: 15.5, lineHeight: 1.55, color: "var(--rw-body-cool)" }}>
          {outcome.body}
        </p>
        {status === "success" || status === "already" ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--rw-meta)" }}>Taking you to the next step…</p>
        ) : (
          <Link href="/signin" style={ctaLinkStyle}>
            Sign in
          </Link>
        )}
      </div>
    );
  }

  // Otherwise this is the "we've sent you an email" holding step.
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>📬</div>
      <h2 style={titleStyle}>Check your inbox</h2>
      <p style={{ margin: "0 0 8px", fontSize: 15.5, lineHeight: 1.55, color: "var(--rw-body-cool)" }}>
        We sent a confirmation link to{" "}
        <strong style={{ color: "var(--rw-ink)" }}>{user?.email || "your email address"}</strong>. Click it
        to finish signing up.
      </p>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#a3927f" }}>
        The link is good for 24 hours.
      </p>

      {resendState === "sent" ? (
        <p role="status" style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--rw-teal)" }}>
          Sent — check your inbox again.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={resendState === "sending"}
          style={{
            ...ctaLinkStyle,
            border: "none",
            cursor: resendState === "sending" ? "default" : "pointer",
            opacity: resendState === "sending" ? 0.7 : 1,
            fontFamily: "inherit",
          }}
        >
          {resendState === "sending" ? "Sending…" : "Resend the email"}
        </button>
      )}

      {resendError && (
        <p role="alert" style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
          {resendError}
        </p>
      )}
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <div>
      <PageHero mark={<RockWorksIcon size={40} color="var(--rw-gold)" />} eyebrow="One quick thing" title={<>Confirm your email</>} compact />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px 80px" }}>
        <Suspense fallback={null}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: 24,
  padding: "44px 32px",
  textAlign: "center",
  boxShadow: "0 24px 50px -30px rgba(90,40,70,0.4)",
};

const titleStyle = {
  fontFamily: "var(--font-zilla-slab), serif",
  fontWeight: 600,
  fontSize: 26,
  margin: "0 0 10px",
  color: "var(--rw-ink)",
};

const ctaLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "13px 28px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 15,
  color: "#fff",
  textDecoration: "none",
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  boxShadow: "0 12px 26px -12px var(--rw-orange)",
};
