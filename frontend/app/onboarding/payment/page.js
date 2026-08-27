"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RockWorksIcon from "@/components/RockWorksIcon";
import { useAuth } from "@/contexts/AuthContext";
import {
  confirmStripeCheckout,
  fetchBillingSummary,
  payDemo,
  startStripeCheckout,
} from "@/lib/billingApi";
import { dashboardFor } from "@/lib/auth/enrolment";
import { PageHero } from "@/components/ui";

function PaymentContent() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by Stripe's success_url. Its presence means we've just come back from
  // checkout; the id itself proves nothing until the server re-reads it.
  const sessionId = searchParams.get("session_id");
  const wasCancelled = searchParams.get("checkout") === "cancelled";

  const [summary, setSummary] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [isStripe, setIsStripe] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [payError, setPayError] = useState("");
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(Boolean(sessionId));
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
        setIsStripe(data.stripe);
        setIsTestMode(data.testMode);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(async () => {
    // Re-read the session so the route guard sees the account as paid before we
    // navigate, otherwise it would bounce us straight back here.
    const nextUser = await refresh();
    setDone(true);
    setTimeout(() => router.push(dashboardFor(nextUser)), 700);
  }, [refresh, router]);

  // Back from Stripe. The webhook is what really decides who has paid, and it
  // may not have landed yet, so ask the server to check this session now rather
  // than leaving a student who has been charged looking at a Pay button.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      // Card payments settle immediately, so one retry is plenty — it covers
      // the server hearing about it a moment after the browser redirects.
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        try {
          const result = await confirmStripeCheckout(sessionId);
          if (cancelled) return;
          if (result.paid) {
            await finish();
            return;
          }
        } catch (err) {
          if (cancelled) return;
          setPayError(err.message || "Could not confirm your payment.");
          setConfirming(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!cancelled) {
        setConfirming(false);
        setPayError(
          "Your payment is still being confirmed. Refresh this page in a moment — " +
            "if you were charged, your access will open automatically."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, finish]);

  // Already paid (e.g. back button) — nothing to do here.
  useEffect(() => {
    if (user?.paymentComplete && !done) router.replace(dashboardFor(user));
  }, [user, done, router]);

  async function handlePay() {
    setPayError("");
    setPaying(true);
    try {
      if (isStripe) {
        const { url, alreadyPaid } = await startStripeCheckout();
        if (alreadyPaid) {
          await finish();
          return;
        }
        // Leaves the site for Stripe's hosted page — card details are typed
        // there, never here. assign() rather than replace() so the browser's
        // Back button still works if they change their mind.
        window.location.assign(url);
        return;
      }

      await payDemo();
      await finish();
    } catch (err) {
      setPayError(err.message || "Something went wrong.");
      setPaying(false);
    }
  }

  // With neither a processor nor the demo there is nothing the button can do,
  // which is exactly the state a production deploy is in before Stripe keys
  // are set.
  const canPay = isStripe || isDemo;

  if (confirming) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🎸</div>
        <h2 style={headingStyle}>Confirming your payment…</h2>
        <p style={{ margin: 0, fontSize: 15.5, color: "var(--rw-body-cool)" }}>
          One moment — don&apos;t close this page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🌺</div>
        <h2 style={headingStyle}>You&apos;re enrolled!</h2>
        <p style={{ margin: 0, fontSize: 15.5, color: "var(--rw-body-cool)" }}>Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...cardStyle, textAlign: "left", padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 16 }}>
          Order summary
        </div>

        {loadError && (
          <p role="alert" style={{ margin: 0, fontSize: 14, color: "var(--rw-orange-deep)" }}>
            {loadError}
          </p>
        )}

        {!summary && !loadError && <p style={{ margin: 0, color: "var(--rw-meta)" }}>Loading your plan…</p>}

        {summary && (
          <>
            {summary.lines.map((line) => (
              <div
                key={line.label}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "10px 0" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--rw-ink)" }}>{line.label}</div>
                  {line.detail && <div style={{ fontSize: 13, color: "var(--rw-meta)" }}>{line.detail}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--rw-prose)", whiteSpace: "nowrap" }}>
                  {line.amount}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginTop: 8, paddingTop: 14, borderTop: "1px solid var(--rw-border)" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--rw-ink)" }}>Due today</div>
              <div style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 600, fontSize: 28, color: "var(--rw-orange)", whiteSpace: "nowrap" }}>
                {summary.total}
              </div>
            </div>
            {/* The fine print comes from the plan, not from here — a term is a
                commitment and must not claim you can cancel any time. */}
            <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginTop: 4 }}>
              Billed every {summary.cadence}. {summary.note}
            </div>

            {wasCancelled && !payError && (
              <div style={{ ...noticeStyle, background: "#fff6e6", borderColor: "#f0d9a8" }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#8a6a3a" }}>
                  Checkout was cancelled and you haven&apos;t been charged. You can try again
                  whenever you&apos;re ready.
                </p>
              </div>
            )}

            {/* Stripe is reached first when it's configured, so the demo notice
                only belongs here when it's genuinely what the button will do. */}
            {isStripe && isTestMode && (
              <div style={noticeStyle}>
                <div style={noticeTitleStyle}>Test mode</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#8a4b3a" }}>
                  Stripe is in test mode, so no real money moves. Use card 4242 4242 4242 4242
                  with any future expiry and any CVC.
                </p>
              </div>
            )}

            {!isStripe && isDemo && (
              <div style={noticeStyle}>
                <div style={noticeTitleStyle}>Demo checkout</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#8a4b3a" }}>
                  No card details are collected and nothing is charged. This step stands in for
                  real payment while the site is in development.
                </p>
              </div>
            )}

            {!isStripe && !isDemo && (
              <div style={noticeStyle}>
                <div style={noticeTitleStyle}>Payments aren&apos;t open yet</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#8a4b3a" }}>
                  Card payments are still being set up. Your account is saved — get in touch and
                  we&apos;ll finish your enrolment by hand.
                </p>
              </div>
            )}

            {payError && (
              <p role="alert" style={{ margin: "16px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
                {payError}
              </p>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={paying || !canPay}
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
                cursor: paying || !canPay ? "default" : "pointer",
                opacity: paying || !canPay ? 0.7 : 1,
                background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
                boxShadow: "0 12px 26px -12px var(--rw-orange)",
              }}
            >
              {payButtonLabel(paying, canPay, isStripe, summary.total)}
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
        <PageHero mark={<RockWorksIcon size={40} color="var(--rw-gold)" />} eyebrow="Last step" title={<>Confirm your enrolment</>} compact />

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px 80px" }}>
          {/* PaymentContent reads the query string Stripe redirects back with. */}
          <Suspense fallback={null}>
            <PaymentContent />
          </Suspense>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function payButtonLabel(paying, canPay, isStripe, total) {
  if (paying) return isStripe ? "Taking you to Stripe…" : "Completing…";
  if (!canPay) return "Payments unavailable";
  if (isStripe) return `Pay ${total}`;
  return "Complete sign-up (demo)";
}

const headingStyle = {
  fontFamily: "var(--font-zilla-slab), serif",
  fontWeight: 600,
  fontSize: 26,
  margin: "0 0 10px",
  color: "var(--rw-ink)",
};

const noticeStyle = {
  marginTop: 20,
  padding: "14px 16px",
  borderRadius: 10,
  background: "var(--rw-orange-tint)",
  border: "1px solid #f3c7ba",
};

const noticeTitleStyle = {
  fontWeight: 800,
  fontSize: 13,
  color: "var(--rw-orange-deep)",
  marginBottom: 4,
};

const cardStyle = {
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: 24,
  padding: "48px 36px",
  textAlign: "center",
  boxShadow: "0 24px 50px -30px rgba(90,40,70,0.4)",
};
