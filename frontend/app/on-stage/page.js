"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";

export default function OnStage() {
  const [posts, setPosts] = useState(undefined);
  const [songOfMonth, setSongOfMonth] = useState(undefined);

  useEffect(() => {
    fetch(`${API_URL}/onstage`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]));
    fetch(`${API_URL}/songs`)
      .then((res) => res.json())
      .then((data) => setSongOfMonth((data.songs || [])[0] || null))
      .catch(() => setSongOfMonth(null));
  }, []);

  const featured = posts?.[0];
  const rest = posts?.slice(1) || [];

  return (
    <div>
      <PageHero title={<>On Stage</>} />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 100px" }}>
        {posts === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {posts && posts.length === 0 && <p style={{ color: "var(--rw-meta)" }}>No performances posted yet — check back soon.</p>}

        {featured && (
          <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 16, overflow: "hidden", marginBottom: 36, boxShadow: "0 24px 50px -34px rgba(6,25,45,0.3)" }}>
            <div style={{ position: "relative", aspectRatio: "16/9", background: "linear-gradient(135deg,var(--rw-ink-deep),#0b3a4c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", left: 16, bottom: 16, background: "rgba(6,25,45,0.72)", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", padding: "7px 14px", borderRadius: 6, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ color: "var(--rw-orange)" }}>&#9654;</span> Featured
              </span>
            </div>
            <div style={{ padding: "24px 28px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-orange)", marginBottom: 8 }}>
                {featured.date}
              </div>
              <h2 style={{ fontWeight: 700, fontSize: "clamp(24px,3vw,34px)", margin: "0 0 12px", color: "var(--rw-ink)", letterSpacing: "-0.015em" }}>
                {featured.title}
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--rw-body-cool)" }}>{featured.description}</p>
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 40 }}>
            {rest.map((p) => (
              <div key={p.id} style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", aspectRatio: "16/10", background: "linear-gradient(135deg,#0b3a4c,#0e5561)" }} />
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 17, margin: "0 0 9px", color: "var(--rw-ink)" }}>{p.title}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, color: "#7a6d78", flex: 1 }}>{p.description}</p>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rw-teal)" }}>{p.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {songOfMonth && (
          <div
            style={{
              background: "linear-gradient(135deg,var(--rw-ink-deep),#0b3a4c)",
              borderRadius: 16,
              padding: 32,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 520 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--rw-gold)", marginBottom: 10 }}>
                Song of the Month
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 26, margin: "0 0 4px" }}>{songOfMonth.title}</h3>
              <div style={{ fontSize: 14, color: "rgba(255,245,236,0.7)", marginBottom: 12 }}>{songOfMonth.artist}</div>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,245,236,0.86)" }}>
                {songOfMonth.notes || "A student favorite this month — a great next song to learn."}
              </p>
            </div>
            <Link href="/song-library" style={{ flexShrink: 0, padding: "13px 26px", borderRadius: 8, background: "var(--rw-orange)", color: "#fff", fontWeight: 700, fontSize: 14.5, textDecoration: "none", whiteSpace: "nowrap" }}>
              View in Song Library &rarr;
            </Link>
          </div>
        )}

        <p style={{ margin: "22px 0 0", fontSize: 12.5, color: "#a3927f", textAlign: "center" }}>
          Student media is published only with family consent.
        </p>
      </div>
    </div>
  );
}
