"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { destinationFor } from "@/lib/auth/enrolment";
import { INSTRUMENT_NAMES, EXPERIENCE_OPTIONS, LEVEL_OPTIONS, PLANS, STEP_LABELS } from "@/lib/auth/signupOptions";

const LAST_STEP = STEP_LABELS.length;
// Never kept in the draft: anything a shared or borrowed browser shouldn't hold on to.
const SECRET_FIELDS = ["password", "confirmPassword"];

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

function validateStep(step, form, mode) {
  const errs = {};
  if (step === 1) {
    if (!form.studentName.trim()) errs.studentName = "Enter the student's name.";
    if (mode === "signup") {
      if (!form.studentEmail.trim()) errs.studentEmail = "Enter an email address.";
      else if (!isEmailValid(form.studentEmail)) errs.studentEmail = "That email address doesn't look complete.";
      if (!form.password || form.password.length < 8) errs.password = "Use at least 8 characters.";
      else if (form.password !== form.confirmPassword) errs.confirmPassword = "The passwords don't match.";
    }
    if (form.isMinor) {
      if (!form.sponsorName.trim()) errs.sponsorName = "Enter the adult sponsor's name.";
      if (!form.sponsorEmail.trim()) errs.sponsorEmail = "Enter the sponsor's email address.";
      else if (!isEmailValid(form.sponsorEmail)) errs.sponsorEmail = "That email address doesn't look complete.";
    }
  }
  return errs;
}

// The answers so far, kept for this tab only so a refresh or a look at another page doesn't
// lose them. Passwords are never written. Storage can be missing, so every access is guarded.
const draftKey = (mode) => `rw-signup-draft:${mode}`;
function readDraft(mode) {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(draftKey(mode)) || "null");
  } catch {
    return null;
  }
}
function writeDraft(mode, step, form) {
  try {
    const safe = Object.fromEntries(Object.entries(form).filter(([k]) => !SECRET_FIELDS.includes(k)));
    window.sessionStorage.setItem(draftKey(mode), JSON.stringify({ step, form: safe }));
  } catch {
    // Only a convenience.
  }
}
function clearDraft(mode) {
  try {
    window.sessionStorage.removeItem(draftKey(mode));
  } catch {
    // Nothing to clear.
  }
}

// `instrument` is the canonical name a homepage tile deep-linked in with, or null.
export default function SignupWizard({ mode, instrument = null }) {
  const { user, signUp, updateProfile } = useAuth();
  const router = useRouter();
  const [draft] = useState(() => readDraft(mode));
  // A draft can come back on step 2 or 3, but signup's step 1 then needs the password again.
  const [step, setStep] = useState(() => (draft?.step && !(mode === "signup" && draft.step > 1) ? draft.step : 1));
  const [form, setForm] = useState(() => ({
    studentName: mode === "onboarding" ? user?.name || "" : "",
    studentAge: "",
    studentPhone: "",
    studentEmail: mode === "onboarding" ? user?.email || "" : "",
    isMinor: false,
    sponsorName: "",
    sponsorEmail: "",
    instrument: instrument || INSTRUMENT_NAMES[0],
    musicExperience: EXPERIENCE_OPTIONS[0],
    instrumentLevel: LEVEL_OPTIONS[0],
    plan: PLANS[0].name,
    ...draft?.form,
    // A deep link's instrument wins over an older draft, and the signed-in email over anything.
    ...(instrument ? { instrument } : {}),
    ...(mode === "onboarding" && user?.email ? { studentEmail: user.email } : {}),
    password: "",
    confirmPassword: "",
  }));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [nextHref, setNextHref] = useState(null);
  const heading = useRef(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!success) writeDraft(mode, step, form);
  }, [mode, step, form, success]);

  // A new step moves focus to its heading, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function goTo(n) {
    moved.current = true;
    setStep(n);
  }

  function next() {
    const errs = validateStep(step, form, mode);
    if (Object.keys(errs).length) {
      setErrors(errs);
      // After the error text renders, put the cursor in the first field to fix.
      requestAnimationFrame(() => document.getElementById(`su-${Object.keys(errs)[0]}`)?.focus());
      return;
    }
    setErrors({});
    goTo(Math.min(step + 1, LAST_STEP));
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
      clearDraft(mode);
      // Answers are in, checkout is normally what's left.
      const dest = destinationFor(nextUser);
      setNextHref(dest);
      setSuccess(true);
      setTimeout(() => router.push(dest), 600);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (step < LAST_STEP) next();
    else if (!submitting) submit();
  }

  if (success) {
    return (
      <div className="rw-su-card" role="status" style={{ textAlign: "center", padding: "48px 32px" }}>
        <h2 className="rw-su-title">{mode === "signup" ? "Your account is made" : "You're all set"}</h2>
        <p style={{ margin: 0, fontSize: "var(--rw-text-base)", color: "var(--rw-body-cool)" }}>
          {nextHref === "/verify-email"
            ? "Next, confirm your email. Taking you there…"
            : nextHref === "/onboarding/payment"
              ? "Taking you to checkout…"
              : "Taking you to your dashboard…"}
        </p>
      </div>
    );
  }

  const field = (key) => ({
    id: `su-${key}`,
    value: form[key],
    onChange: (e) => set(key, e.target.value),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `su-${key}-error` : undefined,
    className: "rw-su-input",
  });
  const error = (key) =>
    errors[key] ? (
      <span id={`su-${key}-error`} className="rw-su-error">
        {errors[key]}
      </span>
    ) : null;

  return (
    <div>
      <ol className="rw-su-steps" aria-label="Sign-up steps">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} data-state={n < step ? "done" : n === step ? "current" : "todo"} aria-current={n === step ? "step" : undefined}>
              <span className="rw-su-step-n">{n < step ? "✓" : n}</span>
              {mode === "onboarding" && n === 1 ? "Student" : label}
            </li>
          );
        })}
      </ol>

      <form className="rw-su-card" onSubmit={onSubmit} noValidate>
        <p className="rw-su-count">
          Step {step} of {LAST_STEP}
        </p>
        {step === 1 && (
          <fieldset className="rw-su-fieldset">
            <legend>
              <h2 ref={heading} tabIndex={-1} className="rw-su-title">
                {mode === "signup" ? "Student and login" : "About the student"}
              </h2>
            </legend>
            {instrument && (
              <p className="rw-su-carried">
                Your instrument is set to <b>{instrument}</b>. You can change it on the next step.
              </p>
            )}
            <label className="rw-su-label" htmlFor="su-studentName">
              <span>
                Student name <Req />
              </span>
              <input {...field("studentName")} autoComplete="name" />
              {error("studentName")}
            </label>
            <div className="rw-su-pair">
              <label className="rw-su-label" htmlFor="su-studentAge">
                <span>Age</span>
                <input {...field("studentAge")} inputMode="numeric" placeholder="e.g. 11" />
              </label>
              <label className="rw-su-label" htmlFor="su-studentPhone">
                <span>Phone</span>
                <input {...field("studentPhone")} type="tel" autoComplete="tel" placeholder="(808) 555-0000" />
              </label>
            </div>

            {mode === "signup" ? (
              <>
                <label className="rw-su-label" htmlFor="su-studentEmail">
                  <span>
                    Email <Req />
                  </span>
                  <input {...field("studentEmail")} type="email" autoComplete="email" placeholder="you@email.com" />
                  {error("studentEmail")}
                </label>
                <div className="rw-su-group">
                  <label className="rw-su-label" htmlFor="su-password">
                    <span>
                      Password <Req />
                    </span>
                    <input {...field("password")} type="password" autoComplete="new-password" placeholder="At least 8 characters" />
                    {error("password")}
                  </label>
                  <label className="rw-su-label" htmlFor="su-confirmPassword">
                    <span>
                      Confirm password <Req />
                    </span>
                    <input {...field("confirmPassword")} type="password" autoComplete="new-password" />
                    {error("confirmPassword")}
                  </label>
                </div>
              </>
            ) : (
              <label className="rw-su-label" htmlFor="su-studentEmail">
                <span>Email</span>
                <input {...field("studentEmail")} disabled />
              </label>
            )}

            <label className="rw-su-check">
              <input type="checkbox" checked={form.isMinor} onChange={(e) => set("isMinor", e.target.checked)} />
              The student is under 18 and has an adult sponsor
            </label>
            {form.isMinor && (
              <div className="rw-su-group">
                <label className="rw-su-label" htmlFor="su-sponsorName">
                  <span>
                    Adult sponsor name <Req />
                  </span>
                  <input {...field("sponsorName")} autoComplete="off" />
                  {error("sponsorName")}
                </label>
                <label className="rw-su-label" htmlFor="su-sponsorEmail">
                  <span>
                    Sponsor email <Req />
                  </span>
                  <input {...field("sponsorEmail")} type="email" autoComplete="off" />
                  {error("sponsorEmail")}
                </label>
              </div>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="rw-su-fieldset">
            <legend>
              <h2 ref={heading} tabIndex={-1} className="rw-su-title">
                Instrument and experience
              </h2>
            </legend>
            <label className="rw-su-label" htmlFor="su-instrument">
              <span>Instrument</span>
              <select {...field("instrument")}>
                {INSTRUMENT_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="rw-su-label" htmlFor="su-musicExperience">
              <span>Music experience</span>
              <select {...field("musicExperience")}>
                {EXPERIENCE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="rw-su-label" htmlFor="su-instrumentLevel">
              <span>Level on this instrument</span>
              <select {...field("instrumentLevel")}>
                {LEVEL_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className="rw-su-fieldset">
            <legend>
              <h2 ref={heading} tabIndex={-1} className="rw-su-title">
                Choose a membership plan
              </h2>
            </legend>
            <div className="rw-su-plans">
              {PLANS.map((p) => (
                <label key={p.key} className="rw-su-plan">
                  <input type="radio" name="plan" value={p.name} checked={form.plan === p.name} onChange={() => set("plan", p.name)} />
                  <span className="rw-su-plan-mark" aria-hidden="true" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="rw-su-plan-name">{p.name}</span>
                    <span className="rw-su-plan-sub">{p.sub}</span>
                  </span>
                  <span className="rw-su-plan-price">{p.price}</span>
                </label>
              ))}
            </div>
            <p className="rw-su-note">
              Membership opens the member area online: the song library, lesson videos and practice tools. It doesn&apos;t book
              lessons or place anyone in a class. Lessons at the school are arranged with us; <Link href="/trial">ask about a trial</Link>.
            </p>
            <p className="rw-su-note">You&apos;ll see the total on the next page before anything is charged.</p>
          </fieldset>
        )}

        {submitError && (
          <p role="alert" className="rw-su-error" style={{ marginTop: 16 }}>
            {submitError}
          </p>
        )}

        <div className="rw-su-actions">
          {step > 1 ? (
            <button type="button" onClick={() => goTo(step - 1)} className="rw-su-back">
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={submitting} className="rw-cta rw-su-next">
            {step < LAST_STEP ? "Continue →" : submitting ? (mode === "signup" ? "Creating your account…" : "Saving…") : mode === "signup" ? "Create my account" : "Finish setup"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Req() {
  return (
    <span className="rw-su-req">
      <span aria-hidden="true">*</span>
      <span className="rw-sr-only">(required)</span>
    </span>
  );
}
