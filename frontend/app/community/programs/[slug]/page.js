import Link from "next/link";
import { notFound } from "next/navigation";
import { programs } from "@/lib/content";

export function generateStaticParams() {
  return programs.map((p) => ({ slug: p.slug }));
}

export default async function ProgramDetail({ params }) {
  const { slug } = await params;
  const program = programs.find((p) => p.slug === slug);
  if (!program) notFound();

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 100px" }}>
      <Link href="/community/programs" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        &larr; All programs
      </Link>

      <div
        style={{
          aspectRatio: "16/6",
          borderRadius: 16,
          overflow: "hidden",
          background: "linear-gradient(135deg,var(--rw-ink-deep),#0b3a4c)",
          margin: "18px 0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,245,236,0.6)",
          fontSize: 14,
        }}
      >
        {program.title}
      </div>

      <div className="rw-featured-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 36, alignItems: "start" }}>
        <div>
          <h1 style={{ fontWeight: 600, fontSize: 28, margin: "0 0 8px", color: "var(--rw-ink)" }}>{program.title}</h1>
          <h2 style={{ fontWeight: 600, fontSize: 20, margin: "20px 0 8px", color: "var(--rw-ink)" }}>How it works</h2>
          <p style={{ margin: "0 0 22px", fontSize: 16, lineHeight: 1.68, color: "var(--rw-body-cool)" }}>{program.method}</p>
          <div style={{ borderTop: "1px solid var(--rw-rule)" }}>
            {program.structureItems.map((it) => (
              <div key={it} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 0", borderBottom: "1px solid #efe4d5" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(14,138,151,0.14)",
                    color: "var(--rw-teal)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    marginTop: 1,
                  }}
                >
                  &#10003;
                </span>
                <span style={{ fontSize: 15.5, color: "var(--rw-prose)", lineHeight: 1.5 }}>{it}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "20px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--rw-body-cool)" }}>
            <strong style={{ color: "var(--rw-ink)" }}>Expected progress.</strong> {program.progress}
          </p>
        </div>

        <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 4 }}>
                Who it&apos;s for
              </div>
              <div style={{ fontSize: 14.5, color: "var(--rw-prose)", lineHeight: 1.5 }}>{program.forWho}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 4 }}>
                Instruments
              </div>
              <div style={{ fontSize: 14.5, color: "var(--rw-prose)", lineHeight: 1.5 }}>{program.instruments}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 4 }}>
                Format
              </div>
              <div style={{ fontSize: 14.5, color: "var(--rw-prose)", lineHeight: 1.5 }}>{program.format}</div>
            </div>
          </div>
          <Link
            href="/contact"
            style={{ display: "block", textAlign: "center", padding: 13, borderRadius: 8, background: "var(--rw-orange)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
          >
            {program.ctaLabel} &rarr;
          </Link>
          <Link
            href="/program/format"
            style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 13.5, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}
          >
            See format &amp; pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
