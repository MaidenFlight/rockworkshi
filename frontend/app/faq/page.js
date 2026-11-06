"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";
import T from "@/components/T";

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
      <PageHero title={<T k="faq.hero.title">Frequently Asked Questions</T>} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 100px" }}>
        {faqs === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {faqs && faqs.length === 0 && <p style={{ color: "var(--rw-meta)" }}><T k="faq.empty">FAQs coming soon.</T></p>}
        {faqs?.map((f) => {
          const open = openId === f.id;
          return (
            <div key={f.id} style={{ borderBottom: "1px solid var(--rw-border)" }}>
              <button
                type="button"
                className="rw-faq-q"
                onClick={() => setOpenId(open ? null : f.id)}
                aria-expanded={open}
                aria-controls={`faq-${f.id}`}
              >
                <span>{f.question}</span>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" aria-hidden="true">
                  <path d={open ? "M5 12h14" : "M5 12h14M12 5v14"} />
                </svg>
              </button>
              {open && (
                <p id={`faq-${f.id}`} style={{ margin: "0 0 18px", fontSize: "var(--rw-text-base)", color: "var(--rw-body)", lineHeight: 1.6, maxWidth: "65ch" }}>
                  {f.answer}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
