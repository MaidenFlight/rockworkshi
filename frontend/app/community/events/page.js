"use client";

import { useEffect, useState } from "react";
import EditorialHero from "@/components/EditorialHero";
import { API_URL } from "@/lib/api";

export default function Events() {
  const [posts, setPosts] = useState(undefined);

  useEffect(() => {
    fetch(`${API_URL}/onstage`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]));
  }, []);

  return (
    <div>
      <EditorialHero eyebrow="Community" title="Events" intro="Recitals, showcases, and performances throughout the year." />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px 100px" }}>
        {posts === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {posts && posts.length === 0 && <p style={{ color: "var(--rw-meta)" }}>No events scheduled right now — check back soon.</p>}
        {posts?.map((p) => (
          <div key={p.id} style={{ borderBottom: "1px solid var(--rw-border)", padding: "18px 4px" }}>
            <div style={{ fontSize: 12.5, color: "var(--rw-teal)", fontWeight: 700 }}>{p.date}</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--rw-ink)", margin: "4px 0 6px" }}>{p.title}</div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--rw-body)", lineHeight: 1.55 }}>{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
