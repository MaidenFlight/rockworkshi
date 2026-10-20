"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Container, PageHero } from "@/components/ui";
import { Choices, EMAIL_PATTERN, Field, SendAlert, formStyles as f, postForm } from "@/components/ui/Form";
import InstrumentIcon from "@/components/InstrumentIcon";
import { INSTRUMENT_NAMES } from "@/lib/auth/signupOptions";
import T from "@/components/T";

const EXPERIENCE = [
  { value: "None", label: "Brand new" },
  { value: "Some", label: "A little" },
  { value: "Years of experience", label: "Years of it" },
];

const EMPTY = {
  studentName: "",
  age: "",
  guardian: "",
  email: "",
  phone: "",
  instrument: INSTRUMENT_NAMES[0],
  experience: EXPERIENCE[0].value,
  goals: "",
};

function validate(form) {
  const errors = {};
  if (!form.studentName.trim()) errors.studentName = "Add the student’s name — it’s who the lesson is for.";
  const email = form.email.trim();
  if (!email) errors.email = "Add an email so the school can reach you to set a time.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "That email looks unfinished — it needs an @ and a domain, like name@gmail.com.";
  return errors;
}

export default function BookATrial() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);
  const refs = { studentName: useRef(null), email: useRef(null) };
  const doneRef = useRef(null);

  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function recheck(k) {
    if (!errors[k]) return;
    setErrors((e) => ({ ...e, [k]: validate(form)[k] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const errs = validate(form);
    setErrors(errs);
    const first = ["studentName", "email"].find((k) => errs[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setResult(null);
    setSubmitting(true);
    const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    const res = await postForm("/trial", trimmed);
    setSubmitting(false);
    if (res.ok) setSent(trimmed);
    else setResult(res);
  }

  useEffect(() => {
    if (!sent) return;
    doneRef.current?.focus();
    doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [sent]);

  return (
    <div>
      <PageHero
        eyebrow={<T k="trial.hero.eyebrow">First lesson&apos;s on us</T>}
        title={<T k="trial.hero.title">Book a Trial</T>}
        lead={<T k="trial.hero.lead">One free lesson on the instrument you pick. Tell us who&apos;s playing and how to reach you, and the school will get in touch to find a time.</T>}
      />

      <Container width="form" style={{ padding: "36px 24px 100px" }}>
        <div className={f.panel}>
          {sent ? (
            <Done sent={sent} headingRef={doneRef} />
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
              <p className={f.intro}>
                <T k="trial.form.intro">Only a name and an email are needed. The rest helps the teacher plan your first lesson.</T>
              </p>

              <fieldset className={f.group}>
                <legend className={f.legend}><T k="trial.group.who">Who&apos;s playing</T></legend>
                <Field id="trial-name" label={<T k="trial.field.name">Student name</T>} error={errors.studentName}>
                  {(p) => (
                    <input
                      {...p}
                      ref={refs.studentName}
                      className={f.input}
                      value={form.studentName}
                      onChange={(e) => set("studentName", e.target.value)}
                      onBlur={() => recheck("studentName")}
                      autoComplete="name"
                      maxLength={120}
                    />
                  )}
                </Field>
                <div className={f.row}>
                  <Field id="trial-age" label={<T k="trial.field.age">Age</T>} optional>
                    {(p) => (
                      <input
                        {...p}
                        className={`${f.input} ${f.short}`}
                        value={form.age}
                        onChange={(e) => set("age", e.target.value)}
                        inputMode="numeric"
                        maxLength={20}
                      />
                    )}
                  </Field>
                  <Field
                    id="trial-guardian"
                    label={<T k="trial.field.guardian">Parent or guardian</T>}
                    optional
                    hint={<T k="trial.hint.guardian">If the student is under 18.</T>}
                  >
                    {(p) => (
                      <input
                        {...p}
                        className={f.input}
                        value={form.guardian}
                        onChange={(e) => set("guardian", e.target.value)}
                        maxLength={120}
                      />
                    )}
                  </Field>
                </div>
              </fieldset>

              <fieldset className={f.group}>
                <legend className={f.legend}><T k="trial.group.reach">How to reach you</T></legend>
                <Field id="trial-email" label={<T k="trial.field.email">Email</T>} error={errors.email}>
                  {(p) => (
                    <input
                      {...p}
                      ref={refs.email}
                      type="email"
                      className={f.input}
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={() => recheck("email")}
                      autoComplete="email"
                      spellCheck={false}
                      maxLength={254}
                    />
                  )}
                </Field>
                <Field id="trial-phone" label={<T k="trial.field.phone">Phone</T>} optional>
                  {(p) => (
                    <input
                      {...p}
                      type="tel"
                      className={f.input}
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      autoComplete="tel"
                      maxLength={40}
                    />
                  )}
                </Field>
              </fieldset>

              <fieldset className={f.group}>
                <legend className={f.legend}><T k="trial.group.play">What you want to play</T></legend>
                <div className={f.field}>
                  <p id="trial-instrument" className={f.label}><T k="trial.field.instrument">Instrument</T></p>
                  <Choices
                    name="instrument"
                    legendId="trial-instrument"
                    value={form.instrument}
                    options={INSTRUMENT_NAMES}
                    onChange={(v) => set("instrument", v)}
                    icon={(name) => <InstrumentIcon name={name} size={26} />}
                  />
                </div>
                <div className={f.field}>
                  <p id="trial-experience" className={f.label}><T k="trial.field.experience">Played before?</T></p>
                  <Choices
                    name="experience"
                    legendId="trial-experience"
                    value={form.experience}
                    options={EXPERIENCE}
                    onChange={(v) => set("experience", v)}
                  />
                </div>
                <Field
                  id="trial-goals"
                  label={<T k="trial.field.goals">A song you want to play</T>}
                  optional
                  hint={<T k="trial.hint.goals">Or a band, or a reason. Anything that tells the teacher where to start.</T>}
                >
                  {(p) => (
                    <textarea
                      {...p}
                      className={`${f.input} ${f.textarea}`}
                      value={form.goals}
                      onChange={(e) => set("goals", e.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                  )}
                </Field>
              </fieldset>

              <SendAlert result={result} />

              <div className={f.actions}>
                <Button type="submit" aria-disabled={submitting || undefined} className={f.submit}>
                  {submitting ? "Sending…" : <T k="trial.submit">Request my free lesson</T>}
                </Button>
                <p className={f.small}><T k="trial.small">No payment and no account needed.</T></p>
              </div>
            </form>
          )}
        </div>
      </Container>
    </div>
  );
}

function Done({ sent, headingRef }) {
  const first = sent.studentName.split(/\s+/)[0];
  return (
    <div className={f.done}>
      <h2 ref={headingRef} tabIndex={-1} className={f.doneTitle}>
        Got it, {first}.
      </h2>
      <p className={f.doneBody}>
        Your request for a free <b>{sent.instrument.toLowerCase()}</b> lesson is with the school. Someone will email{" "}
        <b>{sent.email}</b>
        {sent.phone ? (
          <>
            {" "}or call <b>{sent.phone}</b>
          </>
        ) : null}{" "}
        to find a time that works.
      </p>
      <p className={f.doneBody}>
        <T k="trial.done.nothing">There&apos;s nothing to pay and nothing else to do until then.</T>
      </p>
      <div className={f.doneNext}>
        <p className={f.doneNextLabel}><T k="trial.done.while">While you wait</T></p>
        <Button href="/song-library" variant="secondary" size="sm">
          <T k="trial.done.songs">Look through the songs</T>
        </Button>
        <Button href="/program/how-it-works" variant="quiet">
          <T k="trial.done.how">How the program works</T>
        </Button>
      </div>
    </div>
  );
}
