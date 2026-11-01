"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pill, slotStatus, termRequest } from "@/lib/terms";

// Term groups: a shared three-month term, one song unlocking per month on the group's dates.
export default function AdminTerms() {
  const router = useRouter();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    termRequest("/admin/terms")
      .then((data) => setGroups(data.groups))
      .catch((err) => {
        setError(err.message);
        setGroups([]);
      });
  }, []);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { group } = await termRequest("/admin/terms", { method: "POST", body: JSON.stringify(form) });
      router.push(`/admin/terms/${group.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontWeight: 600, fontSize: 24, color: "var(--rw-ink)", margin: "0 0 6px" }}>Terms</h1>
      <p style={{ color: "var(--rw-meta)", fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.55 }}>
        Each term group shares a three-month schedule. A month&apos;s song reaches its students once its unlock date
        has passed <em>and</em> you&apos;ve published it. Dates and times are Honolulu time. Paying for the Term plan
        doesn&apos;t put anyone in a group; you add students here.
      </p>

      <form onSubmit={create} style={{ ...card, display: "grid", gap: 10, marginBottom: 24 }}>
        <strong style={{ color: "var(--rw-ink)", fontSize: 14 }}>New term</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Winter 2027 – Guitar beginners"
            aria-label="Term name"
            required
            maxLength={80}
            style={{ ...input, flex: "2 1 240px" }}
          />
          <label style={dateLabel}>
            Starts
            <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={input} />
          </label>
          <label style={dateLabel}>
            Ends
            <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={input} />
          </label>
          <button type="submit" disabled={saving} style={primary}>
            {saving ? "Creating…" : "Create term"}
          </button>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--rw-meta)" }}>
          The three months start in draft, unlocking at midnight on the start date and one and two months later. You can
          change each one.
        </span>
      </form>

      {error && <p role="alert" style={{ color: "var(--rw-orange-deep)", fontSize: 13.5 }}>{error}</p>}

      {groups === null ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : groups.length === 0 ? (
        <p style={{ color: "var(--rw-meta)" }}>No terms yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {groups.map((g) => (
            <Link key={g.id} href={`/admin/terms/${g.id}`} style={{ ...card, textDecoration: "none", display: "block" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--rw-ink)" }}>{g.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginBottom: 8 }}>
                {g.startDate} to {g.endDate} · {g.memberCount} {g.memberCount === 1 ? "student" : "students"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {g.slots.map((s) => (
                  <span key={s.month} style={pill(slotStatus(s).tone)}>
                    Month {s.month}: {s.song ? s.song.title : "no song"} · {slotStatus(s).label}
                    {s.warnings.some((w) => w.blocking) ? " ⚠" : ""}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const card = { border: "1px solid var(--rw-border)", borderRadius: 10, background: "var(--rw-surface)", padding: "14px 16px" };
const input = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--rw-line)", fontSize: 13.5, fontFamily: "inherit", background: "#fff" };
const dateLabel = { display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--rw-ink)" };
const primary = {
  alignSelf: "end",
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
