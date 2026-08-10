"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

const STATUS_COLORS = {
  New: { bg: "var(--rw-orange-tint)", fg: "var(--rw-orange-deep)" },
  Contacted: { bg: "#fdf3d9", fg: "#a06a2a" },
  "Trial Scheduled": { bg: "#e6f0fb", fg: "#1a5aa8" },
  Enrolled: { bg: "#e3f3ea", fg: "#1f7a4d" },
  Closed: { bg: "var(--rw-border)", fg: "var(--rw-body)" },
};

export default function AdminTrials() {
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_URL}/admin/trials`, { credentials: "include" });
    const data = await res.json();
    setTrials(data.trials || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function cycle(id) {
    await fetch(`${API_URL}/admin/trials/${id}/cycle-status`, { method: "POST", credentials: "include" });
    load();
  }

  return (
    <div>
      <h1 style={{ fontWeight: 600, fontSize: 24, color: "var(--rw-ink)", marginBottom: 20 }}>Trial Requests</h1>
      {loading ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : trials.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No trial requests yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {trials.map((t) => {
            const color = STATUS_COLORS[t.status] || STATUS_COLORS.New;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  border: "1px solid var(--rw-border)",
                  borderRadius: 10,
                  background: "var(--rw-surface)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--rw-ink)" }}>{t.studentName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
                    {t.email} &middot; {t.instrument || "No instrument"} &middot; {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => cycle(t.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: color.bg,
                    color: color.fg,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {t.status} &rarr;
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
