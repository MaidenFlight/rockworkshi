export default function EditorialHero({ eyebrow, title, intro }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,var(--rw-ink-deep) 0%,#0b2f43 52%,#0b5563 100%)" }}>
      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
        {eyebrow && (
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: "0 0 16px", color: "#fff", letterSpacing: "-0.015em" }}>
          {title}
        </h1>
        {intro && (
          <p style={{ margin: "0 auto", maxWidth: 560, fontSize: 16.5, lineHeight: 1.6, color: "rgba(255,245,236,0.82)" }}>{intro}</p>
        )}
      </div>
      <div style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
        </svg>
      </div>
    </section>
  );
}
