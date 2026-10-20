"use client";

import { API_URL } from "@/lib/api";
import f from "./form.module.css";

export { f as formStyles };

// One labelled control with its hint and its error.
export function Field({ id, label, optional, hint, error, children, className }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={[f.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={f.label}>
        {label}
        {optional && <span className={f.optional}>Optional</span>}
      </label>
      {hint && (
        <p id={hintId} className={f.hint}>
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }) {
  return (
    <p id={id} className={f.error}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 4.2V9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 10.6V12.2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

// A set of radio tiles.
export function Choices({ name, legendId, value, options, onChange, icon, columns }) {
  return (
    <div
      className={f.choices}
      role="radiogroup"
      aria-labelledby={legendId}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
    >
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const text = typeof o === "string" ? o : o.label;
        return (
          <label key={val} className={f.choice}>
            <input
              type="radio"
              name={name}
              value={val}
              checked={value === val}
              onChange={() => onChange(val)}
              className={f.choiceInput}
            />
            <span className={f.choiceFace}>
              {icon && icon(val)}
              <span className={f.choiceText}>{text}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Loose on purpose: something@something.something.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The one address on the domain that has a mailbox behind it. See Footer.js.
export const SCHOOL_EMAIL = "denny.landika@rockworksschoolofmusichawaii.com";

// Posts a public form and turns every way it can fail into something a reader can act on.
export async function postForm(path, body, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    let message = "";
    try {
      message = (await res.json()).error || "";
    } catch {
      // An HTML error page from a proxy; the status says enough.
    }
    if (res.status === 400) return { ok: false, kind: "invalid", message };
    if (res.status === 429) return { ok: false, kind: "busy", message };
    return { ok: false, kind: "server", message };
  } catch {
    return { ok: false, kind: "offline", message: "" };
  } finally {
    clearTimeout(timer);
  }
}

// What a failed send says.
export function SendAlert({ result }) {
  if (!result || result.ok) return null;
  const mail = (
    <a href={`mailto:${SCHOOL_EMAIL}`}>{SCHOOL_EMAIL}</a>
  );
  let title;
  let body;
  if (result.kind === "invalid") {
    title = "Something needs another look.";
    body = result.message || "Check the answers above and send again.";
  } else if (result.kind === "busy") {
    title = "That was a lot of sends at once.";
    body = <>Wait a minute and try again. Your answers are still here.</>;
  } else if (result.kind === "offline") {
    title = "It didn’t send.";
    body = <>We couldn’t connect, so nothing reached the school. Check your connection and press send again. Your answers are still here.</>;
  } else {
    title = "It didn’t send — that’s on our end.";
    body = <>Nothing was saved. Try again in a minute, or email {mail} and we’ll take it from there.</>;
  }
  return (
    <div className={f.alert} role="alert">
      <strong>{title}</strong>
      {body}
    </div>
  );
}
