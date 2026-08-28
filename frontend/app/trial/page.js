"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";

export default function BookATrial() {
  const [form, setForm] = useState({
    studentName: "",
    age: "",
    guardian: "",
    email: "",
    phone: "",
    instrument: "Guitar",
    experience: "None",
    goals: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not reach the API.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHero eyebrow="First lesson's on us" title={<>Book a Trial</>} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "36px 24px 100px" }}>
        <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)", padding: 32, boxShadow: "0 26px 54px -34px rgba(90,40,70,0.4)" }}>
          {submitted ? (
            <p style={{ margin: 0, color: "var(--rw-ink)" }}>
              Thanks, {form.studentName}! We&apos;ll be in touch soon to schedule your trial lesson.
            </p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={labelStyle}>
                Student name
                <input value={form.studentName} onChange={(e) => set("studentName", e.target.value)} style={inputStyle} required />
              </label>
              <label style={labelStyle}>
                Age
                <input value={form.age} onChange={(e) => set("age", e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Parent / guardian (if under 18)
                <input value={form.guardian} onChange={(e) => set("guardian", e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Email
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} style={inputStyle} required />
              </label>
              <label style={labelStyle}>
                Phone
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Instrument
                <select value={form.instrument} onChange={(e) => set("instrument", e.target.value)} style={inputStyle}>
                  {["Guitar", "Piano", "Bass", "Drums", "Voice", "Ukulele"].map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Experience
                <select value={form.experience} onChange={(e) => set("experience", e.target.value)} style={inputStyle}>
                  {["None", "Some", "Years of experience"].map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                What songs or goals brought you here?
                <textarea value={form.goals} onChange={(e) => set("goals", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </label>

              {error && <p style={{ color: "var(--rw-orange-deep)", fontSize: 13.5, margin: 0 }}>{error}</p>}

              <button type="submit" disabled={submitting} className="rw-cta" style={ctaBtn}>
                {submitting ? "Submitting…" : "Request Trial Lesson"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--rw-prose)" };
const inputStyle = { padding: "10px 12px", borderRadius: "var(--rw-radius-sm)", border: "1px solid var(--rw-line)", fontSize: 14, fontFamily: "inherit" };
const ctaBtn = {
  marginTop: 6,
  padding: "13px 20px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,var(--rw-orange),var(--rw-orange-deep))",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
