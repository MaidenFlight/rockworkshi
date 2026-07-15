"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function OnStage() {
  const [posts, setPosts] = useState(undefined);

  useEffect(() => {
    fetch(`${API_URL}/onstage`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]));
  }, []);

  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            On Stage
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "36px 24px 100px" }}>
        {posts === undefined && <p style={{ color: "#8a7d6a" }}>Loading…</p>}
        {posts && posts.length === 0 && <p style={{ color: "#8a7d6a" }}>Performance updates coming soon.</p>}
        {posts?.map((p) => (
          <div key={p.id} style={{ borderBottom: "1px solid #ece0d5", padding: "18px 4px" }}>
            <div style={{ fontSize: 12.5, color: "#0e8a97", fontWeight: 700 }}>{p.date}</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#0a2338", margin: "4px 0 6px" }}>{p.title}</div>
            <p style={{ margin: 0, fontSize: 14, color: "#6a6560", lineHeight: 1.55 }}>{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
