"use client";

import { useEffect, useState } from "react";
import { api, send } from "@/lib/studio";

const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const demos = (n) => `${n} demo${n === 1 ? "" : "s"}`;

// The student demo's passcode (backend lib/demo.js). Whoever has it can open the Demo tab and look around
// as a sample student, so the school gives it only to the people it chooses. It's stored as a hash, so
// nobody can read it back here: setting a new one is how it changes.
export default function AdminDemoPage() {
  const [status, setStatus] = useState(null); // { open, updatedAt, live }
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/admin/demo")
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  async function run(action, done) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await action();
      setStatus(result);
      setMessage(done(result));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    run(
      () => send("/admin/demo", "PUT", { passcode }),
      () => {
        setPasscode("");
        return "Saved. The Demo tab now opens with this passcode.";
      }
    );
  }

  function close() {
    if (!window.confirm("Close the student demo? The passcode stops working and every demo running now ends.")) return;
    run(
      () => send("/admin/demo", "DELETE"),
      (result) => `Closed.${result.ended ? ` ${demos(result.ended)} ended.` : ""}`
    );
  }

  return (
    <div className="rw-st">
      <div>
        <h1 className="rw-st-title">Student demo</h1>
        <p className="rw-st-lead">
          With the passcode, someone can open the Demo tab, choose an instrument and look around the member area as a sample student
          who plays it. Nothing they do is booked, charged, emailed or sent to a teacher, and each demo is deleted when they leave or
          after two hours. Give the passcode only to people you choose.
        </p>
      </div>

      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}

      {status === null ? (
        !error && <p className="rw-st-muted">Loading…</p>
      ) : (
        <>
          <section className="rw-st-card" aria-labelledby="demo-state">
            <h2 id="demo-state">
              {status.open ? "Open" : "Closed"}{" "}
              <span className="rw-st-chip" data-tone={status.open ? "good" : "off"}>
                {status.open ? "Passcode set" : "No passcode"}
              </span>
            </h2>
            <p style={{ margin: "0 0 4px" }}>
              {status.open
                ? `The passcode was last set ${when(status.updatedAt)}.`
                : "No passcode is set, so the Demo tab says the demo is closed."}
            </p>
            <p className="rw-st-muted" style={{ margin: 0 }}>
              {status.live ? `${demos(status.live)} running now.` : "No demos running now."}
            </p>
            {status.open && (
              <div className="rw-st-actions" style={{ marginTop: 14 }}>
                <button type="button" className="rw-st-btn" onClick={close} disabled={busy}>
                  Close the demo
                </button>
              </div>
            )}
          </section>

          <form className="rw-st-card" onSubmit={save} aria-labelledby="demo-passcode" style={{ display: "grid", gap: 12 }}>
            <h2 id="demo-passcode" style={{ margin: 0 }}>
              {status.open ? "Change the passcode" : "Set a passcode to open the demo"}
            </h2>
            <label className="rw-st-field">
              New passcode
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="demo-passcode-hint"
              />
            </label>
            <p id="demo-passcode-hint" className="rw-st-muted" style={{ margin: 0 }}>
              At least 8 letters or numbers. Capitals and spaces don&apos;t matter, so &ldquo;Aloha Friday&rdquo; and
              &ldquo;alohafriday&rdquo; are the same passcode. Note it down before you save: it can&apos;t be shown again, even here.
              Changing it doesn&apos;t end demos already open; closing the demo does.
            </p>
            <div className="rw-st-actions">
              <button type="submit" className="rw-st-btn" data-tone="primary" disabled={busy || passcode.replace(/s+/g, "").length < 8}>
                {busy ? "Saving…" : status.open ? "Change passcode" : "Set passcode and open"}
              </button>
            </div>
          </form>
        </>
      )}

      {message && (
        <p className="rw-st-ok" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
