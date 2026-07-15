"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

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
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            Meet the school
          </div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Teachers
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 100px" }}>
        {teachers === undefined && <p style={{ color: "#8a7d6a" }}>Loading…</p>}
        {teachers && teachers.length === 0 && <p style={{ color: "#8a7d6a" }}>Teacher profiles coming soon.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="rw-cols-3">
          {teachers?.map((t) => (
            <div key={t.id} className="rw-card" style={{ border: "1px solid #ece0d5", borderRadius: 14, padding: 22, background: "#fffdf9" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#0e8a97,#0a2338)",
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
              <div style={{ fontWeight: 700, fontSize: 17, color: "#0a2338" }}>{t.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0e8a97", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 10px" }}>
                {t.instruments}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#6a6560", lineHeight: 1.55 }}>{t.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
