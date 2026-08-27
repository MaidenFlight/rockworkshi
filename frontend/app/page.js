import Link from "next/link";
import { instruments, audiences, testimonials } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import InstrumentIcon from "@/components/InstrumentIcon";
import { Section, Container, SectionHead, Eyebrow, Button } from "@/components/ui";

// The hero and the stats band keep their own styles rather than going through
// the primitives. Both are one-offs built on custom gradients, and a primitive
// that exists to serve a single caller is just indirection.

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(168deg,var(--rw-ink-deep) 0%,#0a2f43 34%,#0d5561 60%,#127a86 74%,#c94b2c 92%,#e86a37 100%)",
          color: "#fff5ec",
        }}
      >
        <div
          className="rw-hero-grid"
          style={{
            position: "relative",
            maxWidth: 1240,
            margin: "0 auto",
            padding: "76px 24px 132px",
            display: "grid",
            gridTemplateColumns: "0.92fr 1.08fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div style={{ animation: "rise .7s ease both" }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#82d4dd",
                display: "flex",
                alignItems: "center",
                gap: 13,
              }}
            >
              <span style={{ width: 28, height: 1.5, background: "#82d4dd", display: "inline-block" }} />
              Honolulu &middot; Est. 1982
            </div>
            <h1
              style={{
                fontWeight: 700,
                fontSize: "clamp(46px,5.7vw,84px)",
                lineHeight: 0.99,
                letterSpacing: "-0.015em",
                margin: "24px 0 0",
                color: "#fff",
              }}
            >
              Real songs.
              <br />
              Real bands.
              <br />
              <em style={{ fontStyle: "italic", fontWeight: 600, color: "#ffcf8f" }}>From day one.</em>
            </h1>
            <p style={{ fontSize: 18.5, lineHeight: 1.62, maxWidth: 466, margin: "26px 0 34px", color: "rgba(255,245,236,0.86)" }}>
              A ten-year, song-based curriculum where every student learns to play, perform, and eventually
              write their own music — one real song at a time.
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
              <Button href="/signup">Start Lessons</Button>
              <Button href="/program/curriculum" variant="quiet" onDark>
                See the curriculum &rarr;
              </Button>
            </div>
          </div>
          <div
            style={{
              position: "relative",
              alignSelf: "stretch",
              minHeight: 340,
              marginTop: 26,
              animation: "rise .9s ease both",
              borderRadius: 3,
              overflow: "hidden",
              boxShadow: "0 30px 60px -34px rgba(0,0,0,0.55)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/band.svg" alt="A band on the Rock Works stage" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div
              style={{
                position: "absolute",
                left: -14,
                bottom: -16,
                background: "var(--rw-ink-deep)",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "11px 18px",
                borderLeft: "3px solid var(--rw-orange)",
              }}
            >
              On the Rock Works stage &middot; Honolulu
            </div>
          </div>
        </div>
        <div style={{ position: "relative", lineHeight: 0 }}>
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ width: "100%", height: 64, display: "block" }}>
            <path d="M0,48 C240,96 480,10 720,40 C960,70 1200,20 1440,52 L1440,90 L0,90 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
      </section>

      {/* VALUE PROPS — sits tight under the hero wave, so it keeps its own
          asymmetric padding rather than the standard section rhythm. */}
      <Container style={{ padding: "44px 24px 8px" }}>
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {[
            {
              n: "01",
              title: "One song a month",
              body: "Every song is taught in five levels — sing-a-long, chords, scales & fills, melody, and improv.",
            },
            {
              n: "02",
              title: "Solo or in a band",
              body: "Learn one-on-one, or sign up with friends and siblings to form your own Rock Band.",
            },
            {
              n: "03",
              title: "A ten-year path",
              body: "We can tell you exactly where you'll be in 6 months, 1, 2, 3, 5, and 10 years.",
            },
          ].map((v, i) => (
            <div
              key={v.n}
              className={i < 2 ? "rw-editorial-col" : ""}
              style={{
                padding: i === 0 ? "8px 40px 8px 0" : i === 1 ? "8px 40px" : "8px 0 8px 40px",
                borderRight: i < 2 ? "1px solid var(--rw-rule)" : "none",
              }}
            >
              <div style={{ fontStyle: "italic", fontSize: 26, color: "var(--rw-orange)", lineHeight: 1 }}>{v.n}</div>
              <h3 style={{ fontWeight: 560, fontSize: 22, margin: "16px 0 9px", color: "var(--rw-ink)", letterSpacing: "-0.01em" }}>
                {v.title}
              </h3>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.62, color: "var(--rw-body)" }}>{v.body}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* INSTRUMENTS */}
      <Section>
        <SectionHead title="Choose your instrument" eyebrow="Pick your sound" />
        <div
          className="rw-cols-6"
          style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", border: "1px solid var(--rw-rule)", borderRadius: 14, overflow: "hidden" }}
        >
          {instruments.map((inst, i) => (
            <Link
              key={inst.name}
              href="/program/format"
              className="rw-instr"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 11,
                padding: "30px 12px",
                background: "var(--rw-surface)",
                borderRight: i < instruments.length - 1 ? "1px solid #eee2d3" : "none",
                textDecoration: "none",
              }}
            >
              <span style={{ color: "var(--rw-ink)", display: "flex" }}>
                <InstrumentIcon name={inst.name} />
              </span>
              <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--rw-ink)" }}>{inst.name}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* STATS BAND */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,var(--rw-ink),#0e3a4a 55%,var(--rw-orange-deep))" }}>
        <div
          style={{
            position: "relative",
            maxWidth: 1000,
            margin: "0 auto",
            padding: "64px 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 40,
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 64,
                lineHeight: 1,
                background: "linear-gradient(135deg,#ffd77a,#ff9d5c)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              96%
            </div>
            <p style={{ margin: "14px auto 0", maxWidth: 280, color: "rgba(255,245,236,0.82)", fontSize: 15.5, lineHeight: 1.55 }}>
              of families say their keiki look forward to lessons every single week.
            </p>
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 64,
                lineHeight: 1,
                background: "linear-gradient(135deg,#ffd77a,#ff9d5c)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              9 in 10
            </div>
            <p style={{ margin: "14px auto 0", maxWidth: 280, color: "rgba(255,245,236,0.82)", fontSize: 15.5, lineHeight: 1.55 }}>
              students are still playing music five years after they start.
            </p>
          </div>
          <p style={{ gridColumn: "1/-1", margin: 0, fontSize: 12, letterSpacing: "0.05em", color: "rgba(255,245,236,0.5)" }}>
            Rock Works Family Survey, 2026
          </p>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <Section>
        <SectionHead title="One school, three ways in" eyebrow="Who it's for" flush />
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {audiences.map((a, i) => (
            <div
              key={a.title}
              style={{
                padding: "28px 34px 8px",
                borderRight: i < audiences.length - 1 ? "1px solid var(--rw-rule)" : "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h3 style={{ fontWeight: 600, fontSize: 23, margin: "0 0 10px", color: "var(--rw-ink)" }}>{a.title}</h3>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.62, color: "var(--rw-body)", flex: 1 }}>{a.desc}</p>
              <Link href={a.href} style={{ fontWeight: 700, fontSize: 14, color: "var(--rw-orange-deep)", textDecoration: "none" }}>
                {a.cta} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section band="sand">
        <Eyebrow>From our &lsquo;ohana</Eyebrow>
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 44 }}>
          {testimonials.map((t) => (
            <div key={t.name} style={{ borderTop: "2px solid var(--rw-orange)", paddingTop: 18 }}>
              <p style={{ margin: "0 0 16px", fontSize: 18, lineHeight: 1.5, color: "var(--rw-prose)", fontWeight: 500 }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--rw-meta)" }}>
                {t.name}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,var(--rw-ink-deep),#0b3a4c 70%,#0e5561)", color: "#fff" }}>
        <div style={{ position: "absolute", right: "-6%", top: "50%", transform: "translateY(-50%)", opacity: 0.08, pointerEvents: "none" }}>
          <RockWorksIcon size={420} color="#fff" />
        </div>
        <Container width="text" style={{ position: "relative", padding: "80px 24px", textAlign: "center" }}>
          <h2 style={{ fontWeight: 700, fontSize: "clamp(32px,4.2vw,52px)", margin: "0 0 16px", color: "#fff", letterSpacing: "-0.015em", lineHeight: 1.02 }}>
            Ready to play your first song?
          </h2>
          <p style={{ margin: "0 auto 30px", maxWidth: 520, fontSize: 17.5, lineHeight: 1.55, color: "rgba(255,245,236,0.82)" }}>
            Sign up today and pick up your instrument — we&apos;ll build the rest around a song you love.
          </p>
          <Button href="/signup">Sign Up Now</Button>
        </Container>
      </section>
    </div>
  );
}
