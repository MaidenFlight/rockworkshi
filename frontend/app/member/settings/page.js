"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { changePassword } from "@/lib/auth/authApi";

export default function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [instrument, setInstrument] = useState(user?.instrument || "");
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
      await updateProfile({ name, instrument, phone });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Could not save your changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 30, color: "#0a2338", marginBottom: 4 }}>Account Settings</h1>
      <p style={{ color: "#6a6560", marginBottom: 32 }}>Update the details on your Rock Works account.</p>

      <form onSubmit={handleSubmit} style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, padding: 28 }}>
        <label style={fieldLabelStyle}>
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
        </label>
        <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
          Instrument
          <input value={instrument} onChange={(e) => setInstrument(e.target.value)} style={inputStyle} placeholder="Guitar, piano, drums…" />
        </label>
        <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="(808) 555-0100" />
        </label>
        <label style={{ ...fieldLabelStyle, marginTop: 16 }}>
          Email
          <input value={user?.email || ""} disabled style={{ ...inputStyle, color: "#a3927f", background: "#f5efe4" }} />
        </label>

        {error && (
          <p role="alert" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "#cf3f20" }}>
            {error}
          </p>
        )}
        {success && (
          <p role="status" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "#0e8a97", fontWeight: 700 }}>
            Saved.
          </p>
        )}

        <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
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
      style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, padding: 28, marginTop: 24 }}
    >
      <h2 style={{ fontWeight: 600, fontSize: 20, color: "#0a2338", margin: "0 0 4px" }}>Change password</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#8a7d6a" }}>
        You&apos;ll stay signed in here. Any other devices will be signed out.
      </p>

      <label style={fieldLabelStyle}>
        Current password
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          style={inputStyle}
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
          autoComplete="new-password"
        />
      </label>

      {error && (
        <p role="alert" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "#cf3f20" }}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" style={{ margin: "14px 2px 0", fontSize: 13.5, color: "#0e8a97", fontWeight: 700 }}>
          Password changed. We&apos;ve emailed you to confirm.
        </p>
      )}

      <button type="submit" disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
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
  marginTop: 22,
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
