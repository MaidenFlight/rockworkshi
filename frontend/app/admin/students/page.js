"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_URL}/admin/students?search=${encodeURIComponent(search)}`, { credentials: "include" });
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id, status) {
    await fetch(`${API_URL}/admin/students/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id) {
    await fetch(`${API_URL}/admin/students/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontWeight: 600, fontSize: 24, color: "var(--rw-ink)", margin: 0 }}>Students</h1>
        <a href={`${API_URL}/admin/students/export.csv`} target="_blank" rel="noreferrer" style={ctaBtn}>
          Export CSV
        </a>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name or email"
          style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--rw-line)", fontSize: 13.5 }}
        />
        <button onClick={load} style={smallBtn}>
          Search
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : students.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No students found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {students.map((s) => (
            <div key={s.id} style={{ border: "1px solid var(--rw-border)", borderRadius: 10, background: "var(--rw-surface)" }}>
              <button
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--rw-ink)" }}>{s.name || s.email}</div>
                  <div style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
                    {s.email} &middot; {s.instrument || "No instrument set"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: s.status === "active" ? "#e3f3ea" : "#f3e6da",
                    color: s.status === "active" ? "#1f7a4d" : "#a06a2a",
                  }}
                >
                  {s.status}
                </span>
              </button>
              {openId === s.id && (
                <div style={{ padding: "0 16px 16px", fontSize: 13.5, color: "var(--rw-prose)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div>Phone: {s.phone || "—"}</div>
                    <div>Age: {s.age || "—"}</div>
                    <div>Experience: {s.experience || "—"}</div>
                    <div>Level: {s.level || "—"}</div>
                    <div>Plan: {s.plan || "—"}</div>
                    <div>Joined: {new Date(s.createdAt).toLocaleDateString()}</div>
                    {s.isMinor && (
                      <>
                        <div>Sponsor: {s.sponsorName || "—"}</div>
                        <div>Sponsor email: {s.sponsorEmail || "—"}</div>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStatus(s.id, s.status === "active" ? "paused" : "active")} style={smallBtn}>
                      {s.status === "active" ? "Pause" : "Reactivate"}
                    </button>
                    <button onClick={() => remove(s.id)} style={{ ...smallBtn, color: "var(--rw-orange-deep)" }}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ctaBtn = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
  textDecoration: "none",
};

const smallBtn = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
