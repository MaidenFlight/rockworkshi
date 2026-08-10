"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";

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
      <PageHero title={<>Frequently Asked Questions</>} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 100px" }}>
        {faqs === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {faqs && faqs.length === 0 && <p style={{ color: "var(--rw-meta)" }}>FAQs coming soon.</p>}
        {faqs?.map((f) => (
          <div key={f.id} style={{ borderBottom: "1px solid var(--rw-border)" }}>
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
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--rw-ink)" }}>{f.question}</span>
              <span style={{ fontSize: 18, color: "var(--rw-meta)" }}>{openId === f.id ? "−" : "+"}</span>
            </button>
            {openId === f.id && (
              <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--rw-body)", lineHeight: 1.6 }}>{f.answer}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
