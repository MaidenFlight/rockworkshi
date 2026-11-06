"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { changePassword } from "@/lib/auth/authApi";
import { instruments } from "@/lib/content";
import { practiceRequest } from "@/lib/practice";
import {
  cancelSubscription,
  fetchSubscription,
  resumeSubscription,
} from "@/lib/billingApi";

export default function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);
    try {
      await updateProfile({ name, phone });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Could not save your changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 30, color: "var(--rw-ink)", marginBottom: 4 }}>Account Settings</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 32 }}>Update the details on your Rock Works account.</p>

      <form onSubmit={handleSubmit} style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, padding: 28 }}>
        <label style={fieldLabelStyle}>
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
        </label>
        <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="(808) 555-0100" />
        </label>
        <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
          Email
          <input value={user?.email || ""} disabled style={{ ...inputStyle, color: "color-mix(in srgb, var(--rw-meta) 68%, var(--rw-cream))", background: "color-mix(in srgb, var(--rw-cream) 90%, var(--rw-ink))" }} />
        </label>

        {error && (
          <p role="alert" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
            {error}
          </p>
        )}
        {success && (
          <p role="status" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "var(--rw-teal)", fontWeight: 700 }}>
            Saved.
          </p>
        )}

        <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      <InstrumentSection instrument={user?.instrument} />
      <ChangePasswordForm />
      <MembershipSection />
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Lets a member stop their own membership.
function MembershipSection() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Cancelling is hard to undo once the period lapses, so it takes two clicks.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSubscription()
      .then((sub) => {
        if (!cancelled) setSubscription(sub);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      setSubscription(await action());
      setConfirming(false);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || (!subscription && !error)) return null;

  const endDate = formatDate(subscription?.currentPeriodEnd);

  return (
    <section style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, padding: 28, marginTop: 24 }}>
      <h2 style={{ fontWeight: 600, fontSize: 20, color: "var(--rw-ink)", margin: "0 0 4px" }}>Membership</h2>

      {error && (
        <p role="alert" style={{ margin: "8px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
          {error}
        </p>
      )}

      {subscription && (
        <>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--rw-meta)" }}>
            {subscription.plan} — {subscription.amount} every {subscription.cadence}.
          </p>

          {subscription.cancelAtPeriodEnd ? (
            <>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff6e6", border: "1px solid #f0d9a8" }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#8a6a3a" }}>
                  Your membership is set to end{endDate ? ` on ${endDate}` : ""}. You keep full
                  access until then, and you won&apos;t be charged again.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(resumeSubscription)}
                className="rw-cta"
                style={{ ...ctaButtonStyle, opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "Working…" : "Keep my membership"}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "var(--rw-prose)" }}>
                {endDate ? `Renews on ${endDate}.` : "Renews automatically."}
              </p>

              {confirming ? (
                <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 10, background: "var(--rw-orange-tint)", border: "1px solid #f3c7ba" }}>
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, color: "#8a4b3a" }}>
                    Cancel your membership? You&apos;ll keep access
                    {endDate ? ` until ${endDate}` : " until the end of the period you've paid for"},
                    then it will end. Nothing is refunded, and you can re-join any time.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(cancelSubscription)}
                      style={{ ...secondaryButtonStyle, borderColor: "var(--rw-orange-deep)", color: "var(--rw-orange-deep)", opacity: busy ? 0.7 : 1 }}
                    >
                      {busy ? "Cancelling…" : "Yes, cancel it"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                      style={secondaryButtonStyle}
                    >
                      Never mind
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  style={{ ...secondaryButtonStyle, marginTop: 16 }}
                >
                  Cancel membership
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

// The instrument decides which part of every song a member gets, so after signup the school sets it.
// A member can ask for a change here; the request lands in Admin → Messages.
function InstrumentSection({ instrument }) {
  const current = instruments.find((i) => i.name.toLowerCase() === (instrument || "").trim().toLowerCase())?.name || null;
  const choices = instruments.map((i) => i.name).filter((n) => n !== current);
  const [wanted, setWanted] = useState(choices[0]);
  const [note, setNote] = useState("");
  const [state, setState] = useState({ sending: false, sent: false, error: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    setState({ sending: true, sent: false, error: "" });
    try {
      await practiceRequest("/me/instrument-request", { method: "POST", body: JSON.stringify({ instrument: wanted, note }) });
      setState({ sending: false, sent: true, error: "" });
      setNote("");
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message || "Could not send your request." });
    }
  }

  return (
    <section id="instrument" style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, padding: 28, marginTop: 24, scrollMarginTop: 96 }}>
      <h2 style={{ fontWeight: 600, fontSize: 20, color: "var(--rw-ink)", margin: "0 0 4px" }}>Your instrument</h2>
      <p style={{ margin: "0 0 4px", fontSize: 15, color: "var(--rw-ink)", fontWeight: 700 }}>{current || "Not set yet"}</p>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--rw-meta)", lineHeight: 1.5 }}>
        Every song opens with the part, chart and lessons for this instrument. The school sets it, so ask here to change it.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={fieldLabelStyle}>
          {current ? "Change to" : "Set it to"}
          <select value={wanted} onChange={(e) => setWanted(e.target.value)} style={inputStyle}>
            {choices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
          Anything the school should know (optional)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </label>
        {state.error && (
          <p role="alert" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
            {state.error}
          </p>
        )}
        {state.sent && (
          <p role="status" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "var(--rw-teal)", fontWeight: 700 }}>
            Sent. The school will be in touch, and your songs switch over once they change it.
          </p>
        )}
        <button type="submit" disabled={state.sending} className="rw-cta" style={ctaButtonStyle}>
          {state.sending ? "Sending…" : "Ask the school"}
        </button>
      </form>
    </section>
  );
}

function ChangePasswordForm() {
  // A student demo account has no password (backend lib/demo.js), so the form is shown but switched off.
  const demo = Boolean(useAuth().user?.isDemo);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setDone(false);

    if (next.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err.message || "Could not change your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, padding: 28, marginTop: 24 }}
    >
      <h2 style={{ fontWeight: 600, fontSize: 20, color: "var(--rw-ink)", margin: "0 0 4px" }}>Change password</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--rw-meta)" }}>
        {demo ? "The student demo has no password, so changing it is switched off here." : "You'll stay signed in here. Any other devices will be signed out."}
      </p>

      <label style={fieldLabelStyle}>
        Current password
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          style={inputStyle}
          disabled={demo}
          autoComplete="current-password"
        />
      </label>
      <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
        New password
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          style={inputStyle}
          disabled={demo}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </label>
      <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
        Confirm new password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          disabled={demo}
          autoComplete="new-password"
        />
      </label>

      {error && (
        <p role="alert" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "var(--rw-teal)", fontWeight: 700 }}>
          Password changed. We&apos;ve emailed you to confirm.
        </p>
      )}

      <button type="submit" disabled={submitting || demo} className="rw-cta" style={{ ...ctaButtonStyle, ...(demo ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
        {submitting ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

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

const secondaryButtonStyle = {
  padding: "11px 20px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14,
  fontFamily: "inherit",
  color: "var(--rw-prose)",
  background: "transparent",
  border: "1px solid var(--rw-line)",
  cursor: "pointer",
};

const ctaButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  marginTop: 22,
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
