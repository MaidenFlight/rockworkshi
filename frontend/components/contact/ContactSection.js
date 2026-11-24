"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Container } from "@/components/ui";
import { EMAIL_PATTERN, Field, SendAlert, formStyles as f, postForm } from "@/components/ui/Form";
import RockWorksIcon from "@/components/RockWorksIcon";
import T from "@/components/T";
import { useAuth } from "@/contexts/AuthContext";
import { REASONS, accountDetails, messagePrompt, withAccount } from "@/lib/contact";
import c from "./contact.module.css";

const EMPTY = { name: "", email: "", phone: "", reason: REASONS[0], message: "" };

const isEmail = (value) => EMAIL_PATTERN.test(value);

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Add your name so we know who we’re answering.";
  const email = form.email.trim();
  if (!email) errors.email = "Add an email — it’s where the reply goes.";
  else if (!isEmail(email)) errors.email = "That email looks unfinished — it needs an @ and a domain, like name@gmail.com.";
  if (!form.message.trim()) errors.message = "Write a line or two about what you need.";
  return errors;
}

// The school's wave, the one cubic every dark band ends on, set end to end so it runs as a line.
const PERIOD = 280;
const SWING = 94;

function waveLine(y, shift) {
  const one = `c${PERIOD / 4},${SWING} ${(PERIOD * 3) / 4},${-SWING} ${PERIOD},0`;
  return `M${shift - PERIOD},${y}${one.repeat(8)}`;
}

// Each line is its own strip, so the stylesheet decides how far apart they sit.
const LINES = [
  { tone: "gold", d: waveLine(32, 0) },
  { tone: "crimson", d: waveLine(32, -40) },
  { tone: "teal", d: waveLine(32, -80) },
];

function Waves() {
  return (
    <div className={c.waves} aria-hidden="true">
      {LINES.map((line) => (
        <svg key={line.tone} className={c.wave} data-tone={line.tone} viewBox="0 0 1600 64" preserveAspectRatio="xMinYMid slice" focusable="false">
          <path d={line.d} />
        </svg>
      ))}
    </div>
  );
}

const ICONS = {
  "General question": <path d="M2.75 3.25h10.5v7.5H8.2l-2.95 2.5v-2.5h-2.5z" />,
  Billing: <path d="M2 4.25h12v7.5H2zM2 7.25h12" />,
  Scheduling: <path d="M2.75 4h10.5v9.25H2.75zM2.75 7.25h10.5M5.5 2.25V5M10.5 2.25V5" />,
  Other: <path d="M3 7h2v2H3zM7 7h2v2H7zM11 7h2v2h-2z" fill="currentColor" stroke="none" />,
};

function ReasonIcon({ reason }) {
  return (
    <svg className={c.tileIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      {ICONS[reason]}
    </svg>
  );
}

// The contact page: an introduction on lacquer beside the form on label stock. It sets itself out
// by the room it is given, so a narrow column stacks it without the page having to say so.
export default function ContactSection() {
  const { user, isLoading } = useAuth();
  const [form, setForm] = useState(EMPTY);
  // Name and email come from the account until the visitor types in that field.
  const [typed, setTyped] = useState({ name: false, email: false });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);
  const [hold, setHold] = useState(0);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const messageRef = useRef(null);
  const refs = { name: nameRef, email: emailRef, message: messageRef };
  const sheetRef = useRef(null);
  const doneRef = useRef(null);
  const sending = useRef(false);
  const writingAgain = useRef(false);

  // Not before the server has answered: the copy of the account kept in this browser may be out of date.
  const account = accountDetails(isLoading ? null : user, isEmail);
  const values = withAccount(form, typed, account);

  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (typed[k] === false) setTyped((prev) => ({ ...prev, [k]: true }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function recheck(k) {
    if (!errors[k]) return;
    setErrors((e) => ({ ...e, [k]: validate(values)[k] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // A ref as well as the state, so a second press in the same moment can't send twice.
    if (sending.current) return;
    const errs = validate(values);
    setErrors(errs);
    const first = ["name", "email", "message"].find((k) => errs[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    sending.current = true;
    setResult(null);
    setSubmitting(true);
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    const res = await postForm("/contact", trimmed);
    sending.current = false;
    setSubmitting(false);
    if (res.ok) {
      setHold(sheetRef.current?.offsetHeight || 0);
      setSent(trimmed);
    } else {
      setResult(res);
    }
  }

  function writeAgain() {
    writingAgain.current = true;
    setForm((prev) => ({ ...prev, message: "" }));
    setSent(null);
  }

  useEffect(() => {
    if (sent) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      doneRef.current?.focus({ preventScroll: true });
      doneRef.current?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    } else if (writingAgain.current) {
      writingAgain.current = false;
      messageRef.current?.focus();
    }
  }, [sent]);

  return (
    <section className={c.section} aria-labelledby="contact-title">
      <Container className={c.bleed}>
        <div className={c.frame}>
          <div className={c.panel}>
            <div className={c.intro}>
              <div className={c.pitch}>
                <p className={c.eyebrow}>
                  <T k="contact.intro.eyebrow">We&apos;re here to help</T>
                </p>
                <h1 id="contact-title" className={c.headline}>
                  <T k="contact.intro.title">Let&apos;s talk music.</T>
                </h1>
                <p className={c.lead}>
                  <T k="contact.intro.lead">Questions about lessons, scheduling, your membership, or anything else? Send us a message.</T>
                </p>
              </div>

              <Waves />

              <p className={c.maker}>
                <RockWorksIcon size={22} color="var(--rw-gold)" />
                <span>Rock Works School of Music</span>
              </p>
            </div>

            <div ref={sheetRef} className={c.sheet} style={sent && hold ? { "--rw-contact-hold": `${hold}px` } : undefined}>
              {sent ? (
                <div className={`${f.done} ${c.done}`}>
                  <h2 ref={doneRef} tabIndex={-1} className={f.doneTitle}>
                    <T k="contact.done.title">Message sent.</T>
                  </h2>
                  <p className={f.doneBody}>
                    <T k="contact.thanks">Thanks — we&apos;ll get back to you soon.</T> The reply will go to <b>{sent.email}</b>.
                  </p>
                  <Button type="button" variant="secondary" size="sm" className={c.again} onClick={writeAgain}>
                    <T k="contact.done.again">Send another message</T>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined} aria-labelledby="contact-form-title">
                  <h2 id="contact-form-title" className={c.title}>
                    <T k="contact.form.title">Send a message</T>
                  </h2>
                  <p className={c.sub}>
                    <T k="contact.form.sub">Tell us how we can help.</T>
                  </p>

                  <div className={c.fields}>
                    <div className={c.cell}>
                      <Field id="contact-name" label={<T k="contact.field.name">Name</T>} error={errors.name}>
                        {(p) => (
                          <input
                            {...p}
                            ref={nameRef}
                            className={`${f.input} ${c.control}`}
                            value={values.name}
                            onChange={(e) => set("name", e.target.value)}
                            onBlur={() => recheck("name")}
                            placeholder="Your name"
                            autoComplete="name"
                            maxLength={120}
                          />
                        )}
                      </Field>
                    </div>
                    <div className={c.cell}>
                      <Field id="contact-email" label={<T k="contact.field.email">Email address</T>} error={errors.email}>
                        {(p) => (
                          <input
                            {...p}
                            ref={emailRef}
                            type="email"
                            className={`${f.input} ${c.control}`}
                            value={values.email}
                            onChange={(e) => set("email", e.target.value)}
                            onBlur={() => recheck("email")}
                            placeholder="you@example.com"
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            maxLength={254}
                          />
                        )}
                      </Field>
                    </div>
                    <div className={c.cell}>
                      <Field id="contact-phone" label={<T k="contact.field.phone">Phone</T>} optional>
                        {(p) => (
                          <input
                            {...p}
                            type="tel"
                            className={`${f.input} ${c.control}`}
                            value={values.phone}
                            onChange={(e) => set("phone", e.target.value)}
                            placeholder="808 555 0142"
                            autoComplete="tel"
                            maxLength={40}
                          />
                        )}
                      </Field>
                    </div>

                    <div className={`${c.cell} ${c.wide} ${c.reason}`}>
                      <p id="contact-reason" className={`${f.label} ${c.legend}`}>
                        <T k="contact.field.reason">What&apos;s this about?</T>
                      </p>
                      <div className={c.tiles} role="radiogroup" aria-labelledby="contact-reason">
                        {REASONS.map((reason) => (
                          <label key={reason} className={c.tile}>
                            <input
                              type="radio"
                              name="reason"
                              value={reason}
                              checked={values.reason === reason}
                              onChange={() => set("reason", reason)}
                              className={c.tileInput}
                            />
                            <span className={c.tileFace}>
                              <ReasonIcon reason={reason} />
                              <span className={c.tileText}>{reason}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={`${c.cell} ${c.wide}`}>
                      <Field id="contact-message" label={<T k="contact.field.message">Your message</T>} error={errors.message}>
                        {(p) => (
                          <textarea
                            {...p}
                            ref={messageRef}
                            className={`${f.input} ${f.textarea} ${c.control} ${c.message}`}
                            value={values.message}
                            onChange={(e) => set("message", e.target.value)}
                            onBlur={() => recheck("message")}
                            placeholder={messagePrompt(values.reason)}
                            rows={4}
                            maxLength={5000}
                          />
                        )}
                      </Field>
                    </div>
                  </div>

                  <SendAlert result={result} />

                  <div className={c.actions}>
                    <Button type="submit" aria-disabled={submitting || undefined} className={c.send}>
                      {submitting ? (
                        <>
                          <span className={c.spinner} aria-hidden="true" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <T k="contact.submit">Send message</T>
                          <svg className={c.arrow} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" focusable="false">
                            <path d="M2.5 8h10.5M8.75 3.75 13 8l-4.25 4.25" />
                          </svg>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
