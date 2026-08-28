import Link from "next/link";
import { footerLinks, footerSocial } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import SocialIcon from "@/components/SocialIcon";

export default function Footer() {
  return (
    <footer style={{ background: "linear-gradient(168deg,var(--rw-ink),var(--rw-ink-deep))", color: "rgba(255,245,236,0.72)", marginTop: "auto" }}>
      <div style={{ height: 4, background: "linear-gradient(90deg,var(--rw-teal),var(--rw-gold),var(--rw-flare),var(--rw-sea-glass))" }} />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "34px 24px",
          display: "flex",
          justifyContent: "space-between",
          gap: 40,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RockWorksIcon size={28} color="var(--rw-gold)" />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 600, fontSize: 18, color: "#fff" }}>Rock Works</span>
              <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--rw-sea-glass)", marginTop: 3 }}>
                School of Music
              </span>
            </div>
          </div>
          <p style={{ margin: "14px 0 16px", fontSize: 13.5, lineHeight: 1.55 }}>
            A ten-year, song-based music curriculum for individuals and rock bands. Music is life.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {footerSocial.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="rw-social"
                style={{
                  /* 34x34 was a decade out of date as a touch target; the
                     floor is 44. The mark inside is unchanged — the ring
                     around it grew. */
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 17,
                  color: "rgba(255,245,236,0.82)",
                  textDecoration: "none",
                }}
              >
                <SocialIcon name={s.label} />
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#fff", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Explore
            </div>
            {footerLinks.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                style={{ display: "block", fontSize: 14, color: "rgba(255,245,236,0.72)", textDecoration: "none", padding: "7px 0" }}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: "#fff", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Visit
            </div>
            <p style={{ margin: "0 0 5px", fontSize: 14 }}>Honolulu, Hawaii</p>
            <p style={{ margin: "0 0 5px", fontSize: 14 }}>Est. 1982</p>
            {/* The one mailbox that exists on the domain. A generic alias like
                aloha@ would read better here and would survive a change of
                inbox, but it has to be created as a forward at Northwest first
                — until then it would bounce. */}
            <a
              href="mailto:denny.landika@rockworksschoolofmusichawaii.com"
              style={{
                display: "block",
                fontSize: 14,
                color: "rgba(255,245,236,0.72)",
                textDecoration: "none",
                // Long enough to overrun a phone-width column on its own.
                overflowWrap: "anywhere",
              }}
            >
              denny.landika@rockworksschoolofmusichawaii.com
            </a>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "14px 24px", textAlign: "center", fontSize: 12.5, color: "rgba(255,245,236,0.5)" }}>
        © {new Date().getFullYear()} Rock Works School of Music
      </div>
    </footer>
  );
}
