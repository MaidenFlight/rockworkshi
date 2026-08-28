import RockWorksIcon from "@/components/RockWorksIcon";

// Shared shell for the terms, privacy and refund pages, so the three stay
// consistent and only their prose differs.
export default function LegalPage({ title, lastUpdated, intro, children }) {
  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,var(--rw-ink-deep) 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "56px 24px 70px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RockWorksIcon size={36} color="var(--rw-gold)" />
          </div>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(32px,4.4vw,48px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            {title}
          </h1>
          {lastUpdated && (
            <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "#9fc4d2" }}>
              Last updated {lastUpdated}
            </p>
          )}
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
      </section>

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
        border: "1px solid #f3c7ba",
        marginBottom: 28,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, color: "var(--rw-orange-deep)", marginBottom: 6 }}>
        Draft — not yet in force
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#8a4b3a" }}>
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
        borderRadius: 5,
        background: "#ffe9a8",
        border: "1px solid #e0bf62",
        color: "#6b4a05",
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
