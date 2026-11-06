"use client";

import { Suspense, useState } from "react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/lib/api";
import { instruments } from "@/lib/content";
import { usePagedList, usePageParam } from "@/lib/paging";

export default function AdminStudentsPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p style={{ color: "var(--rw-meta)" }}>Loading…</p>}>
      <AdminStudents />
    </Suspense>
  );
}

function AdminStudents() {
  const { user } = useAuth();
  const [page, setPage] = usePageParam();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [openId, setOpenId] = useState(null);
  const [removeError, setRemoveError] = useState("");
  const { items, pagination, loading, error, reload: load } = usePagedList("/admin/students", "students", {
    page,
    params: { search: applied },
  });
  const students = items ?? [];

  function runSearch() {
    setApplied(search);
    setPage(1);
  }

  async function setStatus(id, status) {
    await fetch(`${API_URL}/admin/students/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(student) {
    const who = student.name || student.email;
    const warning = student.role === "teacher"
      ? `Permanently delete ${who}'s teacher account? Their students keep their work and feedback. This can't be undone.`
      : `Permanently delete ${who}'s account, practice work and recordings? This can't be undone.`;
    if (!window.confirm(warning)) return;
    setRemoveError("");
    try {
      const res = await fetch(`${API_URL}/admin/students/${student.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setOpenId(null);
      load();
    } catch (err) {
      setRemoveError(`${who} wasn't removed: ${err.message}`);
    }
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
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search by name or email"
          style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--rw-line)", fontSize: 13.5 }}
        />
        <button onClick={runSearch} style={smallBtn}>
          Search
        </button>
      </div>

      {removeError && (
        <p role="alert" style={{ color: "var(--rw-orange-deep)", fontSize: 13.5 }}>
          {removeError}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "var(--rw-orange-deep)", fontSize: 13.5 }}>
          {error}{" "}
          <button onClick={load} style={smallBtn}>
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : students.length === 0 ? (
        !error && <p style={{ color: "var(--rw-meta)" }}>No students found.</p>
      ) : (
        <>
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
                  <InstrumentControl student={s} onSaved={load} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStatus(s.id, s.status === "active" ? "paused" : "active")} style={smallBtn}>
                      {s.status === "active" ? "Pause" : "Reactivate"}
                    </button>
                    {s.id !== user?.id && (
                      <button onClick={() => remove(s)} style={{ ...smallBtn, color: "var(--rw-orange-deep)" }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <Pagination pagination={pagination} onChange={setPage} label="Student pages" />
        </>
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

// The instrument decides which part of every song a student gets, and after signup only staff change it.
// Saving clears their saved mixer settings, which belonged to the old instrument.
function InstrumentControl({ student, onSaved }) {
  const current = instruments.find((i) => i.name.toLowerCase() === (student.instrument || "").trim().toLowerCase())?.name || "";
  const [value, setValue] = useState(current);
  const [state, setState] = useState({ saving: false, message: "", error: false });
  const id = `instrument-${student.id}`;

  async function save() {
    setState({ saving: true, message: "", error: false });
    try {
      const res = await fetch(`${API_URL}/admin/students/${student.id}/instrument`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: value || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setState({ saving: false, message: value ? `Now studying ${value}.` : "Instrument cleared.", error: false });
      onSaved();
    } catch (err) {
      setState({ saving: false, message: err.message, error: true });
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <label htmlFor={id} style={{ fontWeight: 700 }}>
        Instrument
      </label>
      <select id={id} value={value} onChange={(e) => setValue(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--rw-line)", fontSize: 13.5 }}>
        <option value="">Not set</option>
        {instruments.map((i) => (
          <option key={i.name} value={i.name}>
            {i.name}
          </option>
        ))}
      </select>
      <button onClick={save} disabled={state.saving || value === current} style={smallBtn}>
        {state.saving ? "Saving…" : "Save instrument"}
      </button>
      {!current && student.instrument && <span style={{ color: "var(--rw-meta)" }}>On file: “{student.instrument}”, not one of the six.</span>}
      {state.message && (
        <span role={state.error ? "alert" : "status"} style={{ color: state.error ? "var(--rw-orange-deep)" : "var(--rw-teal)", fontWeight: 700 }}>
          {state.message}
        </span>
      )}
    </div>
  );
}

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
