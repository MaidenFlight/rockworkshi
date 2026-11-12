"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { api, pushState, send, turnOffPush, turnOnPush } from "@/lib/meetings";

export default function NotificationsPage() {
  return (
    <ProtectedRoute requireEnrolment={false}>
      <Notifications />
    </ProtectedRoute>
  );
}

function ago(iso) {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Pacific/Honolulu" });
}

function Notifications() {
  const [items, setItems] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [browser, setBrowser] = useState("off");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/notifications")
      .then((d) => setItems(d.notifications))
      .catch((err) => (setError(err.message), setItems([])));
    api("/notifications/preferences").then(setPrefs).catch((err) => setError(err.message));
    pushState().then(setBrowser).catch(() => setBrowser("unsupported"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function change(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      load();
    }
  }

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <main className="rw-st" style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px 100px" }}>
      <div>
        <h1 className="rw-st-title">Notifications</h1>
        <p className="rw-st-lead">
          News about your <Link href="/meetings">meetings</Link>: when one is scheduled, moved, cancelled or starting, and
          reminders a day and 15 minutes before.
        </p>
      </div>
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}

      <section className="rw-st-card" aria-labelledby="how">
        <h2 id="how" className="rw-st-h2">
          How you&apos;re told
        </h2>
        <p className="rw-st-muted">Everything always shows here. Email and browser notifications are separate choices.</p>
        {prefs && (
          <div className="rw-st-checks">
            <label className="rw-st-check">
              <input type="checkbox" checked={prefs.email} disabled={busy} onChange={(e) => change(() => send("/notifications/preferences", "PUT", { email: e.target.checked }))} />
              Email
            </label>
            <label className="rw-st-check">
              <input
                type="checkbox"
                checked={prefs.push && browser === "on"}
                disabled={busy || !prefs.pushKey || browser === "unsupported" || browser === "blocked"}
                onChange={(e) =>
                  change(async () => {
                    if (e.target.checked) {
                      await turnOnPush(prefs.pushKey);
                      await send("/notifications/preferences", "PUT", { push: true });
                    } else {
                      await turnOffPush();
                    }
                  })
                }
              />
              Browser notifications on this device
            </label>
          </div>
        )}
        {prefs && !prefs.pushKey && <p className="rw-st-muted">Browser notifications aren&apos;t switched on for the site yet.</p>}
        {browser === "unsupported" && <p className="rw-st-muted">This browser can&apos;t show notifications from websites. On an iPhone, add the site to your Home Screen first.</p>}
        {browser === "blocked" && <p className="rw-st-muted">This browser is blocking notifications from the site. Allow them in its site settings, then come back.</p>}
      </section>

      <section aria-labelledby="inbox">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 id="inbox" className="rw-st-h2">
            Inbox {unread > 0 && <span className="rw-st-chip" data-tone="warn">{unread} new</span>}
          </h2>
          {unread > 0 && (
            <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => change(() => send("/notifications/read-all", "POST"))}>
              Mark all read
            </button>
          )}
        </div>
        {items === null ? (
          <p className="rw-st-muted">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rw-st-empty">
            <strong>Nothing yet</strong>
            When a meeting is scheduled for you, it shows here.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {items.map((n) => (
              <li key={n.id} className="rw-st-card" style={{ opacity: n.read ? 0.75 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{n.title}</strong>
                  <span className="rw-st-muted" style={{ whiteSpace: "nowrap" }}>
                    {ago(n.createdAt)}
                  </span>
                </div>
                <p style={{ margin: "6px 0", whiteSpace: "pre-line" }}>{n.body}</p>
                <div className="rw-st-actions">
                  {n.url && (
                    <Link className="rw-st-btn" data-size="small" href={n.url} onClick={() => !n.read && send(`/notifications/${n.id}/read`, "POST")}>
                      Open
                    </Link>
                  )}
                  {!n.read && (
                    <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => change(() => send(`/notifications/${n.id}/read`, "POST"))}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
