import RockWorksIcon from "@/components/RockWorksIcon";
import { PageHero } from "@/components/ui";

// Shared shell for the terms, privacy and refund pages, so the three stay
// consistent and only their prose differs.
export default function LegalPage({ title, lastUpdated, intro, children }) {
  return (
    <div>
      {/* This was a fourth hand-rolled page header — the old world's teal
          gradient hardcoded into it, its own copy of the wave, its own title
          setting — which is why the three legal pages stayed on the previous
          design after the redesign moved every shared header to lacquer. It
          takes PageHero now, like every other route, so there is one page
          header on the site and not two-and-a-half. */}
      <PageHero
        compact
        eyebrow="Legal"
        title={title}
        mark={<RockWorksIcon size={36} color="var(--rw-gold)" />}
      >
        {lastUpdated && <p className="rw-legal-updated">Last updated {lastUpdated}</p>}
      </PageHero>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 100px" }}>
        <ReviewBanner />
        {intro && <p style={{ ...paragraphStyle, fontSize: 16.5, color: "var(--rw-prose)" }}>{intro}</p>}
        {children}
      </div>
    </div>
  );
}

// These pages are a draft written from what the software actually does. They
// have not been reviewed by a lawyer and still contain blanks only the school
// can fill. The banner stays until both are true — see the note in
// frontend/lib/content.js about linking them from the footer.
function ReviewBanner() {
  return (
    <div
      role="note"
      style={{
        padding: "16px 18px",
        borderRadius: "var(--rw-radius-md)",
        background: "var(--rw-orange-tint)",
        border: "1px solid color-mix(in srgb, var(--rw-orange) 34%, transparent)",
        marginBottom: 28,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, color: "var(--rw-orange-deep)", marginBottom: 6 }}>
        Draft — not yet in force
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--rw-prose)" }}>
        This document is a working draft awaiting review, and the sections marked below
        are incomplete. It does not yet form an agreement between you and the school.
        Please <a href="/contact" style={{ color: "var(--rw-orange-deep)" }}>get in touch</a> with any
        question about how your membership or your information is handled.
      </p>
    </div>
  );
}

// A blank only the school can fill in. Rendered loud on purpose: a legal page
// that quietly ships with an invented address is worse than one that has none.
export function Todo({ children }) {
  return (
    <mark
      style={{
        display: "inline",
        padding: "2px 7px",
        borderRadius: "var(--rw-radius-sm)",
        background: "color-mix(in srgb, var(--rw-gold) 45%, var(--rw-cream))",
        border: "1px solid var(--rw-gold)",
        color: "var(--rw-ink)",
        fontWeight: 700,
        fontSize: "0.92em",
      }}
    >
      [ TO BE COMPLETED — {children} ]
    </mark>
  );
}

export function H2({ children }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-zilla-slab), serif",
        fontWeight: 600,
        fontSize: 23,
        color: "var(--rw-ink)",
        margin: "36px 0 10px",
      }}
    >
      {children}
    </h2>
  );
}

export function P({ children }) {
  return <p style={paragraphStyle}>{children}</p>;
}

export function UL({ children }) {
  return (
    <ul style={{ ...paragraphStyle, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
      {children}
    </ul>
  );
}

const paragraphStyle = {
  margin: "0 0 14px",
  fontSize: 15.5,
  lineHeight: 1.7,
  color: "#4a5a64",
};
