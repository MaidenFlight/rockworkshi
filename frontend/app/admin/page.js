"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      const [students, trials, messages, lessons] = await Promise.all([
        fetch(`${API_URL}/admin/students`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API_URL}/admin/trials`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API_URL}/admin/messages`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API_URL}/admin/lessons`, { credentials: "include" }).then((r) => r.json()),
      ]);

      const instrumentCounts = {};
      for (const s of students.students || []) {
        const key = s.instrument || "Unspecified";
        instrumentCounts[key] = (instrumentCounts[key] || 0) + 1;
      }
      const total = (students.students || []).length || 1;
      const breakdown = Object.entries(instrumentCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));

      setStats({
        students: (students.students || []).length,
        newTrials: (trials.trials || []).filter((t) => t.status === "New").length,
        messages: (messages.messages || []).length,
        lessons: (lessons.lessons || []).length,
        breakdown,
      });
    }
    load();
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
