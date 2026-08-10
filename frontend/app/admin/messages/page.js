"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/admin/messages`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontWeight: 600, fontSize: 24, color: "var(--rw-ink)", marginBottom: 20 }}>Messages</h1>
      {loading ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : messages.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No messages yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ padding: "14px 16px", border: "1px solid var(--rw-border)", borderRadius: 10, background: "var(--rw-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--rw-ink)" }}>{m.name}</span>
                <span style={{ fontSize: 12, color: "var(--rw-meta)" }}>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginBottom: 8 }}>
                {m.email} {m.reason ? `· ${m.reason}` : ""}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--rw-prose)", lineHeight: 1.5 }}>{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
