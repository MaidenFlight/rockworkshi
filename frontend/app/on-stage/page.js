"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";
import T from "@/components/T";

export default function OnStage() {
  const [posts, setPosts] = useState(undefined);

  useEffect(() => {
    fetch(`${API_URL}/onstage`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]));
  }, []);

  const featured = posts?.[0];
  const rest = posts?.slice(1) || [];

  return (
    <div>
      <PageHero title={<T k="onstage.hero.title">On Stage</T>} />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 100px" }}>
        {posts === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {posts && posts.length === 0 && <p style={{ color: "var(--rw-meta)" }}><T k="onstage.empty">No performances posted yet — check back soon.</T></p>}

        {featured && (
          <div className="rw-tag" style={{ padding: 0, overflow: "hidden", marginBottom: 36 }}>
            <Media url={featured.mediaUrl} title={featured.title} ratio="16/9" />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-orange-deep)", marginBottom: 8 }}>
                {featured.date}
              </div>
              <h2 className="rw-tag-title" style={{ fontSize: "var(--rw-text-3xl)", margin: "0 0 12px" }}>
                {featured.title}
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--rw-body-cool)" }}>{featured.description}</p>
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 40 }}>
            {rest.map((p) => (
              <div key={p.id} className="rw-tag" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <Media url={p.mediaUrl} title={p.title} ratio="16/10" />
                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 className="rw-tag-title" style={{ fontSize: "var(--rw-text-xl)", margin: "0 0 8px" }}>{p.title}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: "var(--rw-text-sm)", lineHeight: 1.55, color: "var(--rw-body)", flex: 1 }}>{p.description}</p>
                  <div style={{ fontSize: "var(--rw-text-xs)", fontWeight: 700, color: "var(--rw-teal)" }}>{p.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ margin: "22px 0 0", fontSize: 12.5, color: "var(--rw-meta)", textAlign: "center" }}>
          <T k="onstage.consent">Student media is published only with family consent.</T>
        </p>
      </div>
    </div>
  );
}

// A post's photo or video, shown only when staff gave it one. Images render inline; anything else
// (a video page, an album) is a plain link, since the page can't know how to embed it.
function Media({ url, title, ratio }) {
  if (!url) return null;
  if (/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={title} loading="lazy" style={{ display: "block", width: "100%", aspectRatio: ratio, objectFit: "cover", background: "var(--rw-ink)" }} />
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="rw-media-link" style={{ aspectRatio: ratio }}>
      <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true">
        <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
      </svg>
      <span>Watch &ldquo;{title}&rdquo;</span>
    </a>
  );
}
