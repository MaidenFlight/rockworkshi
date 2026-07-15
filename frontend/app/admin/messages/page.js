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
      <h1 style={{ fontWeight: 600, fontSize: 24, color: "#0a2338", marginBottom: 20 }}>Messages</h1>
      {loading ? (
        <p style={{ color: "#8a7d6a" }}>Loading…</p>
      ) : messages.length === 0 ? (
        <p style={{ color: "#8a7d6a" }}>No messages yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ padding: "14px 16px", border: "1px solid #ece0d5", borderRadius: 10, background: "#fffdf9" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "#0a2338" }}>{m.name}</span>
                <span style={{ fontSize: 12, color: "#8a7d6a" }}>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#8a7d6a", marginBottom: 8 }}>
                {m.email} {m.reason ? `· ${m.reason}` : ""}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#33454f", lineHeight: 1.5 }}>{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
