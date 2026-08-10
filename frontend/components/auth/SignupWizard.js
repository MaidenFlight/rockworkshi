"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { destinationFor } from "@/lib/auth/enrolment";
import { INSTRUMENT_NAMES, EXPERIENCE_OPTIONS, LEVEL_OPTIONS, PLANS, STEP_LABELS } from "@/lib/auth/signupOptions";

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

function validateStep(step, form, mode) {
  const errs = {};
  if (step === 1) {
    if (!form.studentName.trim()) errs.studentName = "Student name is required.";
    if (mode === "signup") {
      if (!form.studentEmail.trim()) errs.studentEmail = "Email is required.";
      else if (!isEmailValid(form.studentEmail)) errs.studentEmail = "Enter a valid email address.";
      if (!form.password || form.password.length < 8) errs.password = "Password must be at least 8 characters.";
      else if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords don't match.";
    }
    if (form.isMinor) {
      if (!form.sponsorName.trim()) errs.sponsorName = "Sponsor name is required.";
      if (!form.sponsorEmail.trim()) errs.sponsorEmail = "Sponsor email is required.";
      else if (!isEmailValid(form.sponsorEmail)) errs.sponsorEmail = "Enter a valid email address.";
    }
  }
  return errs;
}

export default function SignupWizard({ mode }) {
  const { user, signUp, updateProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    studentName: mode === "onboarding" ? user?.name || "" : "",
    studentAge: "",
    studentPhone: "",
    studentEmail: mode === "onboarding" ? user?.email || "" : "",
    password: "",
    confirmPassword: "",
    isMinor: false,
    sponsorName: "",
    sponsorEmail: "",
    instrument: INSTRUMENT_NAMES[0],
    musicExperience: EXPERIENCE_OPTIONS[0],
    instrumentLevel: LEVEL_OPTIONS[0],
    instructionType: "individual",
    coStudentName: "",
    plan: PLANS[0].name,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [nextHref, setNextHref] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function next() {
    const errs = validateStep(step, form, mode);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function submit() {
    setSubmitError("");
    const profile = {
      name: form.studentName.trim(),
      age: form.studentAge,
      phone: form.studentPhone,
      isMinor: form.isMinor,
      sponsorName: form.isMinor ? form.sponsorName : "",
      sponsorEmail: form.isMinor ? form.sponsorEmail : "",
      instrument: form.instrument,
      experience: form.musicExperience,
      level: form.instrumentLevel,
      instructionType: form.instructionType,
      coStudentName: form.coStudentName,
      plan: form.plan,
    };

    setSubmitting(true);
    try {
      let nextUser;
      if (mode === "signup") {
        nextUser = await signUp({ email: form.studentEmail.trim(), password: form.password, ...profile });
      } else {
        nextUser = await updateProfile(profile);
      }
      // Answers are in — checkout is normally what's left.
      const dest = destinationFor(nextUser);
      setNextHref(dest);
      setSuccess(true);
      setTimeout(() => router.push(dest), 600);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🌺</div>
        <h2 style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 600, fontSize: 26, margin: "0 0 10px", color: "var(--rw-ink)" }}>
          {mode === "signup" ? "You're signed up!" : "You're all set!"}
        </h2>
        <p style={{ margin: 0, fontSize: 15.5, color: "var(--rw-body-cool)" }}>
          {nextHref === "/verify-email"
            ? "Check your inbox to confirm your email…"
            : nextHref === "/onboarding/payment"
            ? "Taking you to checkout…"
            : "Taking you to your dashboard…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n <= step;
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ height: 5, borderRadius: 999, background: active ? "var(--rw-orange)" : "var(--rw-border)" }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: active ? "var(--rw-orange-deep)" : "#a3927f" }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 24, padding: 32, boxShadow: "0 24px 50px -34px rgba(90,40,70,0.35)" }}>
        {step === 1 && (
          <div>
            <h3 style={stepTitleStyle}>Student &amp; sponsor info</h3>
            <label style={fieldLabelStyle}>
              Student name <span style={{ color: "var(--rw-orange-deep)" }}>*</span>
              <input value={form.studentName} onChange={(e) => set("studentName", e.target.value)} style={inputStyle} placeholder="Full name" />
              {errors.studentName && <span style={errStyle}>{errors.studentName}</span>}
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={fieldLabelStyle}>
                Age
                <input value={form.studentAge} onChange={(e) => set("studentAge", e.target.value)} style={inputStyle} placeholder="e.g. 11" />
              </label>
              <label style={fieldLabelStyle}>
                Phone
                <input value={form.studentPhone} onChange={(e) => set("studentPhone", e.target.value)} style={inputStyle} placeholder="(808) 555-0000" />
              </label>
            </div>

            {mode === "signup" ? (
              <>
                <label style={fieldLabelStyle}>
                  Email <span style={{ color: "var(--rw-orange-deep)" }}>*</span>
                  <input type="email" value={form.studentEmail} onChange={(e) => set("studentEmail", e.target.value)} style={inputStyle} placeholder="you@email.com" />
                  {errors.studentEmail && <span style={errStyle}>{errors.studentEmail}</span>}
                </label>
                <div style={{ marginTop: 8, padding: "16px 0 4px", borderTop: "1px dashed var(--rw-border)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--rw-meta)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Create your login
                  </div>
                  <label style={fieldLabelStyle}>
                    Password <span style={{ color: "var(--rw-orange-deep)" }}>*</span>
                    <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} style={inputStyle} placeholder="At least 8 characters" />
                    {errors.password && <span style={errStyle}>{errors.password}</span>}
                  </label>
                  <label style={{ ...fieldLabelStyle, marginTop: 14 }}>
                    Confirm password <span style={{ color: "var(--rw-orange-deep)" }}>*</span>
                    <input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} style={inputStyle} placeholder="Re-enter your password" />
                    {errors.confirmPassword && <span style={errStyle}>{errors.confirmPassword}</span>}
                  </label>
                </div>
              </>
            ) : (
              <label style={fieldLabelStyle}>
                Email
                <input value={form.studentEmail} disabled style={{ ...inputStyle, color: "#a3927f", background: "#f5efe4" }} />
              </label>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 15, color: "#22323d", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isMinor} onChange={(e) => set("isMinor", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--rw-orange)" }} />
              Student is a minor (needs an adult sponsor)
            </label>
            {form.isMinor && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--rw-border)" }}>
                <label style={fieldLabelStyle}>
                  Adult sponsor name <span style={{ color: "var(--rw-orange-deep)" }}>*</span>
                  <input value={form.sponsorName} onChange={(e) => set("sponsorName", e.target.value)} style={inputStyle} />
                  {errors.sponsorName && <span style={errStyle}>{errors.sponsorName}</span>}
                </label>
                <label style={{ ...fieldLabelStyle, marginTop: 14 }}>
                  Sponsor email <span style={{ color: "var(--rw-orange-deep)" }}>*</span>
                  <input value={form.sponsorEmail} onChange={(e) => set("sponsorEmail", e.target.value)} style={inputStyle} />
                  {errors.sponsorEmail && <span style={errStyle}>{errors.sponsorEmail}</span>}
                </label>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={stepTitleStyle}>Experience &amp; instrument</h3>
            <label style={fieldLabelStyle}>
              Instrument of choice
              <select value={form.instrument} onChange={(e) => set("instrument", e.target.value)} style={inputStyle}>
                {INSTRUMENT_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Music experience
              <select value={form.musicExperience} onChange={(e) => set("musicExperience", e.target.value)} style={inputStyle}>
                {EXPERIENCE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Instrument experience level
              <select value={form.instrumentLevel} onChange={(e) => set("instrumentLevel", e.target.value)} style={inputStyle}>
                {LEVEL_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={stepTitleStyle}>Instruction choice</h3>
            <div onClick={() => set("instructionType", "individual")} style={choiceCardStyle(form.instructionType === "individual")}>
              <div style={{ fontWeight: 700, fontSize: 16.5, color: "var(--rw-ink)" }}>One-on-one</div>
              <div style={{ fontSize: 14, color: "#7a6d78", marginTop: 3 }}>Individual lessons built around you.</div>
            </div>
            <div onClick={() => set("instructionType", "band")} style={choiceCardStyle(form.instructionType === "band")}>
              <div style={{ fontWeight: 700, fontSize: 16.5, color: "var(--rw-ink)" }}>Rock Band</div>
              <div style={{ fontSize: 14, color: "#7a6d78", marginTop: 3 }}>Two or more signing up together.</div>
            </div>
            <label style={fieldLabelStyle}>
              Signing up with a friend or sibling? Their name
              <input value={form.coStudentName} onChange={(e) => set("coStudentName", e.target.value)} style={inputStyle} placeholder="Optional — unlocks the 2+ rate" />
            </label>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 style={stepTitleStyle}>Plan &amp; review</h3>
            {PLANS.map((p) => (
              <div key={p.key} onClick={() => set("plan", p.name)} style={planCardStyle(form.plan === p.name)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--rw-ink)" }}>{p.name}</div>
                  <div style={{ fontSize: 13.5, color: "#7a6d78", marginTop: 2 }}>{p.sub}</div>
                </div>
                <div style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 600, fontSize: 24, color: "var(--rw-orange)" }}>{p.price}</div>
              </div>
            ))}
            <p style={{ margin: "16px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "#a3927f" }}>
              You&apos;ll see your total on the next step before anything is confirmed.
            </p>
          </div>
        )}

        {submitError && (
          <p role="alert" style={{ margin: "16px 2px 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
            {submitError}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 26 }}>
          {step > 1 ? (
            <button type="button" onClick={back} style={backBtnStyle}>
              &larr; Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button type="button" onClick={next} className="rw-cta" style={ctaButtonStyle}>
              Continue &rarr;
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} className="rw-cta" style={ctaButtonStyle}>
              {submitting ? "Submitting…" : mode === "signup" ? "Submit Sign-Up 🌺" : "Finish setup 🌺"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: 24,
  padding: "48px 36px",
  textAlign: "center",
  boxShadow: "0 24px 50px -30px rgba(90,40,70,0.4)",
};

const stepTitleStyle = {
  fontFamily: "var(--font-zilla-slab), serif",
  fontWeight: 600,
  fontSize: 24,
  margin: "0 0 20px",
  color: "var(--rw-ink)",
};

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13.5,
  fontWeight: 700,
  color: "var(--rw-prose)",
  marginTop: 14,
};

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--rw-line)",
  fontSize: 15,
  fontFamily: "inherit",
  color: "var(--rw-ink)",
};

const errStyle = {
  display: "block",
  marginTop: 4,
  fontSize: 13,
  color: "var(--rw-orange-deep)",
  fontWeight: 500,
};

function choiceCardStyle(active) {
  return {
    padding: "16px 18px",
    borderRadius: 12,
    border: active ? "2px solid var(--rw-orange)" : "1px solid var(--rw-line)",
    background: active ? "var(--rw-orange-tint)" : "#fff",
    cursor: "pointer",
    marginBottom: 12,
  };
}

function planCardStyle(active) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 18px",
    borderRadius: 12,
    border: active ? "2px solid var(--rw-orange)" : "1px solid var(--rw-line)",
    background: active ? "var(--rw-orange-tint)" : "#fff",
    cursor: "pointer",
    marginBottom: 12,
  };
}

const backBtnStyle = {
  padding: "13px 22px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14.5,
  color: "var(--rw-prose)",
  background: "transparent",
  border: "1px solid var(--rw-line)",
  cursor: "pointer",
};

const ctaButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "13px 30px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 15,
  color: "#fff",
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  boxShadow: "0 14px 28px -12px rgba(224,91,74,0.6)",
};
