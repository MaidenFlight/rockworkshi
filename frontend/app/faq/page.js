"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function FAQ() {
  const [faqs, setFaqs] = useState(undefined);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/faqs`)
      .then((res) => res.json())
      .then((data) => setFaqs(data.faqs || []))
      .catch(() => setFaqs([]));
  }, []);

  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Frequently Asked Questions
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 100px" }}>
        {faqs === undefined && <p style={{ color: "#8a7d6a" }}>Loading…</p>}
        {faqs && faqs.length === 0 && <p style={{ color: "#8a7d6a" }}>FAQs coming soon.</p>}
        {faqs?.map((f) => (
          <div key={f.id} style={{ borderBottom: "1px solid #ece0d5" }}>
            <button
              onClick={() => setOpenId(openId === f.id ? null : f.id)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 4px",
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: "#0a2338" }}>{f.question}</span>
              <span style={{ fontSize: 18, color: "#8a7d6a" }}>{openId === f.id ? "−" : "+"}</span>
            </button>
            {openId === f.id && (
              <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "#6a6560", lineHeight: 1.6 }}>{f.answer}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
