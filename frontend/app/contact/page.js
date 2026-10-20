"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Container, PageHero } from "@/components/ui";
import { Choices, EMAIL_PATTERN, Field, SendAlert, formStyles as f, postForm } from "@/components/ui/Form";
import T from "@/components/T";

const REASONS = ["General question", "Billing", "Scheduling", "Other"];

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Add your name so we know who we’re answering.";
  const email = form.email.trim();
  if (!email) errors.email = "Add an email — it’s where the reply goes.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "That email looks unfinished — it needs an @ and a domain, like name@gmail.com.";
  if (!form.message.trim()) errors.message = "Write a line or two about what you need.";
  return errors;
}

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", reason: REASONS[0], message: "" });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);
  const refs = { name: useRef(null), email: useRef(null), message: useRef(null) };
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
    const first = ["name", "email", "message"].find((k) => errs[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setResult(null);
    setSubmitting(true);
    const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    const res = await postForm("/contact", trimmed);
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
      <PageHero title={<T k="contact.hero.title">Contact Us</T>} />

      <Container width="form" style={{ padding: "36px 24px 100px" }}>
        <div className={f.panel}>
          {sent ? (
            <div className={f.done}>
              <h2 ref={doneRef} tabIndex={-1} className={f.doneTitle}>
                <T k="contact.done.title">Message sent.</T>
              </h2>
              <p className={f.doneBody}>
                <T k="contact.thanks">Thanks — we&apos;ll get back to you soon.</T> The reply will go to <b>{sent.email}</b>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
              <Field id="contact-name" label={<T k="contact.field.name">Name</T>} error={errors.name}>
                {(p) => (
                  <input
                    {...p}
                    ref={refs.name}
                    className={f.input}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => recheck("name")}
                    autoComplete="name"
                    maxLength={120}
                  />
                )}
              </Field>
              <Field id="contact-email" label={<T k="contact.field.email">Email</T>} error={errors.email}>
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
              <Field id="contact-phone" label={<T k="contact.field.phone">Phone</T>} optional>
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
              <div className={f.field}>
                <p id="contact-reason" className={f.label}><T k="contact.field.reason">Reason</T></p>
                <Choices name="reason" legendId="contact-reason" value={form.reason} options={REASONS} onChange={(v) => set("reason", v)} columns={2} />
              </div>
              <Field id="contact-message" label={<T k="contact.field.message">Message</T>} error={errors.message}>
                {(p) => (
                  <textarea
                    {...p}
                    ref={refs.message}
                    className={`${f.input} ${f.textarea}`}
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    onBlur={() => recheck("message")}
                    rows={5}
                    maxLength={5000}
                  />
                )}
              </Field>

              <SendAlert result={result} />

              <div className={f.actions}>
                <Button type="submit" aria-disabled={submitting || undefined} className={f.submit}>
                  {submitting ? "Sending…" : <T k="contact.submit">Send message</T>}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Container>
    </div>
  );
}
