"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/member/Icon";
import { API_URL } from "@/lib/api";

// Teacher accounts and the students each one may set work for.
// Separate from Admin > Teachers, which edits the public bios.
export default function AdminTeaching() {
  const [teachers, setTeachers] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [adding, setAdding] = useState({}); // teacherId -> studentId chosen in that teacher's picker

  function load() {
    return request("/admin/teaching")
      .then((data) => {
        setTeachers(data.teachers);
        setPeople(data.people);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function act(path, options) {
    setError("");
    try {
      await request(path, options);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const setRole = (id, role) => act(`/admin/students/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
  const link = (teacherId, studentId) =>
    act("/admin/teaching/links", { method: "POST", body: JSON.stringify({ teacherId, studentId }) });
  const unlink = (teacherId, studentId) => act(`/admin/teaching/links/${teacherId}/${studentId}`, { method: "DELETE" });

  const label = (p) => `${p.name || "No name"} · ${p.email}`;
  const nonTeachers = people.filter((p) => p.role !== "teacher");

  return (
    <div>
      <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 24, color: "var(--rw-ink)", margin: "0 0 6px" }}>Teaching</h1>
      <p style={{ color: "var(--rw-meta)", fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.5 }}>
        Teachers can set practice work for, and review, only the students linked to them here.
      </p>

      {error && <p style={{ color: "var(--rw-orange-deep)", fontSize: 13.5 }}>{error}</p>}

      <div style={{ ...card, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--rw-ink)" }}>Make someone a teacher</span>
        <select value={newTeacherId} onChange={(e) => setNewTeacherId(e.target.value)} style={select}>
          <option value="">Choose an account…</option>
          {nonTeachers.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setRole(newTeacherId, "teacher").then(() => setNewTeacherId(""))}
          disabled={!newTeacherId}
          style={smallBtn}
        >
          Make teacher
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : teachers.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No teacher accounts yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {teachers.map((t) => {
            const linked = new Set(t.students.map((s) => s.id));
            const candidates = people.filter((p) => p.id !== t.id && !linked.has(p.id));
            return (
              <div key={t.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--rw-ink)" }}>{t.name || t.email}</div>
                    <div style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
                      {t.email}
                      {t.instrument ? ` · ${t.instrument}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Stop ${t.name || t.email} teaching? They lose access to their students.`)) {
                        setRole(t.id, "student");
                      }
                    }}
                    style={{ ...smallBtn, color: "var(--rw-meta)" }}
                  >
                    Remove teacher role
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
                  {t.students.length === 0 && (
                    <span style={{ fontSize: 13, color: "var(--rw-meta)" }}>No students linked yet.</span>
                  )}
                  {t.students.map((s) => (
                    <span key={s.id} style={chip}>
                      {s.name || s.email}
                      {s.instrument ? ` · ${s.instrument}` : ""}
                      <button
                        onClick={() => unlink(t.id, s.id)}
                        aria-label={`Unlink ${s.name || s.email}`}
                        style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--rw-meta)", padding: "0 0 0 6px" }}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={adding[t.id] || ""}
                    onChange={(e) => setAdding((a) => ({ ...a, [t.id]: e.target.value }))}
                    style={select}
                  >
                    <option value="">Add a student…</option>
                    {candidates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {label(p)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => link(t.id, adding[t.id]).then(() => setAdding((a) => ({ ...a, [t.id]: "" })))}
                    disabled={!adding[t.id]}
                    style={smallBtn}
                  >
                    Link student
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const card = {
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
  background: "var(--rw-surface)",
  padding: "14px 16px",
};

const chip = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 6px 4px 10px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-border)",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--rw-ink)",
};

const select = {
  flex: "1 1 260px",
  padding: "8px 10px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  fontSize: 13.5,
  background: "#fff",
};

const smallBtn = {
  padding: "7px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
