"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import RockWorksIcon from "@/components/RockWorksIcon";
import { useAuth } from "@/contexts/AuthContext";
import { resendVerification, verifyEmailToken } from "@/lib/auth/authApi";
import { destinationFor } from "@/lib/auth/enrolment";

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
        <p style={{ margin: "0 0 22px", fontSize: 15.5, lineHeight: 1.55, color: "#5f6f79" }}>
          {outcome.body}
        </p>
        {status === "success" || status === "already" ? (
          <p style={{ margin: 0, fontSize: 14, color: "#8a7d6a" }}>Taking you to the next step…</p>
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
      <p style={{ margin: "0 0 8px", fontSize: 15.5, lineHeight: 1.55, color: "#5f6f79" }}>
        We sent a confirmation link to{" "}
        <strong style={{ color: "#0a2338" }}>{user?.email || "your email address"}</strong>. Click it
        to finish signing up.
      </p>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#a3927f" }}>
        The link is good for 24 hours.
      </p>

      {resendState === "sent" ? (
        <p role="status" style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#0e8a97" }}>
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
        <p role="alert" style={{ margin: "14px 0 0", fontSize: 13.5, color: "#cf3f20" }}>
          {resendError}
        </p>
      )}
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={40} color="#ffcf8f" />
          </div>
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            One quick thing
          </div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(34px,4.6vw,50px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Confirm your email
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px 80px" }}>
        <Suspense fallback={null}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fffdf9",
  border: "1px solid #ece0d5",
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
  color: "#0a2338",
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
  background: "linear-gradient(135deg,#ef5130,#cf3f20)",
  boxShadow: "0 12px 26px -12px #ef5130",
};
