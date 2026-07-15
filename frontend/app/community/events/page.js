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
        {posts === undefined && <p style={{ color: "#8a7d6a" }}>Loading…</p>}
        {posts && posts.length === 0 && <p style={{ color: "#8a7d6a" }}>No events scheduled right now — check back soon.</p>}
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
