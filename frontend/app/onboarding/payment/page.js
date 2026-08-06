"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RockWorksIcon from "@/components/RockWorksIcon";
import { useAuth } from "@/contexts/AuthContext";
import { fetchBillingSummary, payDemo } from "@/lib/billingApi";
import { dashboardFor } from "@/lib/auth/enrolment";

function PaymentContent() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [payError, setPayError] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  // Questions first — if they somehow land here without them, the guard on the
  // way out will send them back.
  useEffect(() => {
    let cancelled = false;
    fetchBillingSummary()
      .then((data) => {
        if (cancelled) return;
        setSummary(data.summary);
        setIsDemo(data.demo);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Already paid (e.g. back button) — nothing to do here.
  useEffect(() => {
    if (user?.paymentComplete && !done) router.replace(dashboardFor(user));
  }, [user, done, router]);

  async function handlePay() {
    setPayError("");
    setPaying(true);
    try {
      await payDemo();
      // Re-read the session so the route guard sees the account as paid before
      // we navigate, otherwise it would bounce us straight back here.
      const nextUser = await refresh();
      setDone(true);
      setTimeout(() => router.push(dashboardFor(nextUser)), 700);
    } catch (err) {
      setPayError(err.message || "Something went wrong.");
      setPaying(false);
    }
  }

  if (done) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🌺</div>
        <h2 style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 600, fontSize: 26, margin: "0 0 10px", color: "#0a2338" }}>
          You&apos;re enrolled!
        </h2>
        <p style={{ margin: 0, fontSize: 15.5, color: "#5f6f79" }}>Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...cardStyle, textAlign: "left", padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 16 }}>
          Order summary
        </div>

        {loadError && (
          <p role="alert" style={{ margin: 0, fontSize: 14, color: "#cf3f20" }}>
            {loadError}
          </p>
        )}

        {!summary && !loadError && <p style={{ margin: 0, color: "#8a7d6a" }}>Loading your plan…</p>}

        {summary && (
          <>
            {summary.lines.map((line) => (
              <div
                key={line.label}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "10px 0" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: "#0a2338" }}>{line.label}</div>
                  {line.detail && <div style={{ fontSize: 13, color: "#8a7d6a" }}>{line.detail}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: "#33454f", whiteSpace: "nowrap" }}>
                  {line.amount}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginTop: 8, paddingTop: 14, borderTop: "1px solid #ece0d5" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0a2338" }}>Due today</div>
              <div style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 600, fontSize: 28, color: "#ef5130", whiteSpace: "nowrap" }}>
                {summary.total}
              </div>
            </div>
            {/* The fine print comes from the plan, not from here — a term is a
                commitment and must not claim you can cancel any time. */}
            <div style={{ fontSize: 12.5, color: "#8a7d6a", marginTop: 4 }}>
              Billed every {summary.cadence}. {summary.note}
            </div>

            {isDemo && (
              <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 10, background: "#fdece6", border: "1px solid #f3c7ba" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#cf3f20", marginBottom: 4 }}>
                  Demo checkout
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#8a4b3a" }}>
                  No card details are collected and nothing is charged. This step stands in for
                  real payment while the site is in development.
                </p>
              </div>
            )}

            {payError && (
              <p role="alert" style={{ margin: "16px 2px 0", fontSize: 13.5, color: "#cf3f20" }}>
                {payError}
              </p>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={paying}
              className="rw-cta"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                marginTop: 22,
                padding: "15px 24px",
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 15.5,
                color: "#fff",
                border: "none",
                cursor: paying ? "default" : "pointer",
                opacity: paying ? 0.7 : 1,
                background: "linear-gradient(135deg,#ef5130,#cf3f20)",
                boxShadow: "0 12px 26px -12px #ef5130",
              }}
            >
              {paying ? "Completing…" : isDemo ? "Complete sign-up (demo)" : `Pay ${summary.total}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPayment() {
  // requireEnrolment={false}: this page *is* one of the enrolment steps.
  return (
    <ProtectedRoute requireEnrolment={false}>
      <div>
        <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
          <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <RockWorksIcon size={40} color="#ffcf8f" />
            </div>
            <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
              Last step
            </div>
            <h1 style={{ fontWeight: 500, fontSize: "clamp(34px,4.6vw,50px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
              Confirm your enrolment
            </h1>
          </div>
          <div style={{ lineHeight: 0 }}>
            <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
              <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
            </svg>
          </div>
        </section>

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px 80px" }}>
          <PaymentContent />
        </div>
      </div>
    </ProtectedRoute>
  );
}

const cardStyle = {
  background: "#fffdf9",
  border: "1px solid #ece0d5",
  borderRadius: 24,
  padding: "48px 36px",
  textAlign: "center",
  boxShadow: "0 24px 50px -30px rgba(90,40,70,0.4)",
};
