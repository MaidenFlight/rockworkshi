"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", reason: "General question", message: "" });
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
      const res = await fetch(`${API_URL}/contact`, {
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
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Contact Us
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "36px 24px 100px" }}>
        <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 16, padding: 32, boxShadow: "0 26px 54px -34px rgba(90,40,70,0.4)" }}>
          {submitted ? (
            <p style={{ margin: 0, color: "#0a2338" }}>Thanks — we&apos;ll get back to you soon.</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={labelStyle}>
                Name
                <input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} required />
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
                Reason
                <select value={form.reason} onChange={(e) => set("reason", e.target.value)} style={inputStyle}>
                  {["General question", "Billing", "Scheduling", "Other"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Message
                <textarea value={form.message} onChange={(e) => set("message", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} required />
              </label>

              {error && <p style={{ color: "#cf3f20", fontSize: 13.5, margin: 0 }}>{error}</p>}

              <button type="submit" disabled={submitting} className="rw-cta" style={ctaBtn}>
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#33454f" };
const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d8cab8", fontSize: 14, fontFamily: "inherit" };
const ctaBtn = {
  marginTop: 6,
  padding: "13px 20px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,#ef5130,#cf3f20)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
