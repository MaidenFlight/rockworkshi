"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";

export default function Teachers() {
  const [teachers, setTeachers] = useState(undefined);

  useEffect(() => {
    fetch(`${API_URL}/teachers`)
      .then((res) => res.json())
      .then((data) => setTeachers(data.teachers || []))
      .catch(() => setTeachers([]));
  }, []);

  return (
    <div>
      <PageHero eyebrow="Meet the school" title={<>Teachers</>} />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 100px" }}>
        {teachers === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {teachers && teachers.length === 0 && <p style={{ color: "var(--rw-meta)" }}>Teacher profiles coming soon.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="rw-cols-3">
          {teachers?.map((t) => (
            <div key={t.id} className="rw-card" style={{ border: "1px solid var(--rw-border)", borderRadius: 14, padding: 22, background: "var(--rw-surface)" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,var(--rw-teal),var(--rw-ink))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 20,
                  marginBottom: 14,
                }}
              >
                {t.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--rw-ink)" }}>{t.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--rw-teal)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 10px" }}>
                {t.instruments}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--rw-body)", lineHeight: 1.55 }}>{t.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
