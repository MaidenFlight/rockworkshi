"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { api, STATUS } from "@/lib/meetings";

export default function MeetingsPage() {
  return (
    <ProtectedRoute requireEnrolment={false}>
      <Meetings />
    </ProtectedRoute>
  );
}

function Meetings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/meetings").then(setData).catch((err) => (setError(err.message), setData({ meetings: [] }))), []);

  // Checks again every half minute, so Join appears when the meeting starts without a reload.
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <main className="rw-st" style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px 100px" }}>
      <div>
        <h1 className="rw-st-title">Meetings</h1>
        <p className="rw-st-lead">
          Live sing-alongs you&apos;re invited to. Join opens when the meeting starts. Times are Hawaii time.{" "}
          <Link href="/notifications">Choose how you&apos;re reminded</Link>.
        </p>
      </div>
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      {data?.admin && (
        <p className="rw-st-muted">
          You&apos;re an admin: schedule and run meetings from <Link href="/admin/meetings">Admin → Meetings</Link>.
        </p>
      )}
      {data === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : data.meetings.length === 0 ? (
        <div className="rw-st-empty">
          <strong>No meetings coming up</strong>
          When you&apos;re invited to one, it shows here and you&apos;ll get a notification.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {data.meetings.map((m) => (
            <li key={m.id} className="rw-st-card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ minWidth: 0 }}>
                <strong>{m.title}</strong>{" "}
                <span className="rw-st-chip" data-tone={STATUS[m.status]?.tone}>
                  {STATUS[m.status]?.label}
                </span>
                <div>{m.when}</div>
                {m.forKids.length > 0 && <div className="rw-st-muted">For {m.forKids.join(" and ")}</div>}
                {m.description && <p className="rw-st-muted" style={{ margin: "6px 0 0" }}>{m.description}</p>}
              </div>
              {m.invited &&
                (m.canJoin ? (
                  <Link className="rw-st-btn" data-tone="primary" href={`/meetings/${m.id}`}>
                    Join
                  </Link>
                ) : (
                  <span className="rw-st-muted">Join opens when it starts</span>
                ))}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
