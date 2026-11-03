"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/admin/overview`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <p style={{ color: "var(--rw-meta)" }}>Loading…</p>;

  const cards = [
    { label: "Students", value: stats.students },
    { label: "New Trial Requests", value: stats.newTrials },
    { label: "Messages", value: stats.messages },
    { label: "Lessons Published", value: stats.lessons },
  ];

  return (
    <div>
      <h1 style={{ fontWeight: 600, fontSize: 24, color: "var(--rw-ink)", marginBottom: 20 }}>Overview</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 32 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--rw-ink)" }}>{c.value}</div>
            <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontWeight: 600, fontSize: 17, color: "var(--rw-ink)", marginBottom: 12 }}>Students by instrument</h2>
      {stats.breakdown.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No students yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stats.breakdown.map((b) => (
            <div key={b.name}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "var(--rw-prose)", fontWeight: 600 }}>{b.name}</span>
                <span style={{ color: "var(--rw-meta)" }}>{b.count}</span>
              </div>
              <div style={{ height: 8, background: "var(--rw-border)", borderRadius: 999 }}>
                <div style={{ height: "100%", width: `${b.pct}%`, background: "var(--rw-teal)", borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
