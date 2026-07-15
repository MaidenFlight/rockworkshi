import Link from "next/link";

export default function ComingSoon({ eyebrow, title }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
      <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "90px 24px 140px", textAlign: "center" }}>
        {eyebrow && (
          <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffd89a", marginBottom: 14 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontWeight: 500, fontSize: "clamp(34px,4.6vw,52px)", margin: "0 0 18px", color: "#fff", letterSpacing: "-0.015em" }}>
          {title}
        </h1>
        <p style={{ margin: "0 auto", maxWidth: 460, fontSize: 16, lineHeight: 1.6, color: "rgba(255,245,236,0.78)" }}>
          This page is still being built out. In the meantime, head back home or reach out — we&apos;d love to
          hear from you.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            marginTop: 28,
            padding: "13px 26px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14.5,
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
