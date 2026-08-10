import Link from "next/link";
import EditorialHero from "@/components/EditorialHero";
import { programs } from "@/lib/content";

export default function SpecialPrograms() {
  return (
    <div>
      <EditorialHero eyebrow="Community" title="Special Programs" intro="Beyond weekly lessons — ways to go deeper." />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 100px" }}>
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {programs.map((p) => (
            <Link
              key={p.slug}
              href={`/community/programs/${p.slug}`}
              className="rw-card"
              style={{ display: "block", border: "1px solid var(--rw-border)", borderRadius: 14, padding: 22, background: "var(--rw-surface)", textDecoration: "none" }}
            >
              <h3 style={{ fontWeight: 600, fontSize: 17.5, color: "var(--rw-ink)", margin: "0 0 10px" }}>{p.title}</h3>
              <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.6, color: "var(--rw-body)" }}>{p.desc}</p>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--rw-orange-deep)" }}>Learn more &rarr;</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
