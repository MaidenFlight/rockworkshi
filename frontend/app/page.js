import Link from "next/link";
import { instruments, audiences, testimonials } from "@/lib/content";

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(168deg,#06192d 0%,#0a2f43 34%,#0d5561 60%,#127a86 74%,#c94b2c 92%,#e86a37 100%)",
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
              <Link
                href="/signup"
                className="rw-cta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "15px 32px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 16,
                  background: "#ef5130",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Start Lessons
              </Link>
              <Link
                href="/program/curriculum"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                  textDecoration: "none",
                  borderBottom: "1.5px solid rgba(255,255,255,0.38)",
                  paddingBottom: 3,
                }}
              >
                See the curriculum &rarr;
              </Link>
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
              background: "linear-gradient(160deg,#0e5561,#06192d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "rgba(255,245,236,0.5)",
            }}
          >
            On the Rock Works stage &middot; Honolulu
          </div>
        </div>
        <div style={{ position: "relative", lineHeight: 0 }}>
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ width: "100%", height: 64, display: "block" }}>
            <path d="M0,48 C240,96 480,10 720,40 C960,70 1200,20 1440,52 L1440,90 L0,90 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "44px 24px 8px" }}>
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
                borderRight: i < 2 ? "1px solid #e6d8c6" : "none",
              }}
            >
              <div style={{ fontStyle: "italic", fontSize: 26, color: "#ef5130", lineHeight: 1 }}>{v.n}</div>
              <h3 style={{ fontWeight: 560, fontSize: 22, margin: "16px 0 9px", color: "#0a2338", letterSpacing: "-0.01em" }}>
                {v.title}
              </h3>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.62, color: "#6a6560" }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTRUMENTS */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 26,
            borderBottom: "1px solid #e6d8c6",
            paddingBottom: 18,
          }}
        >
          <h2 style={{ fontWeight: 600, fontSize: "clamp(28px,3.4vw,40px)", margin: 0, color: "#0a2338", letterSpacing: "-0.01em" }}>
            Choose your instrument
          </h2>
          <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#0e8a97", paddingBottom: 6, whiteSpace: "nowrap" }}>
            Pick your sound
          </div>
        </div>
        <div
          className="rw-cols-6"
          style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", border: "1px solid #e6d8c6", borderRadius: 14, overflow: "hidden" }}
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
                background: "#fffdf9",
                borderRight: i < instruments.length - 1 ? "1px solid #eee2d3" : "none",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 34 }}>{inst.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 14.5, color: "#0a2338" }}>{inst.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* STATS BAND */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0a2338,#0e3a4a 55%,#cf3f20)" }}>
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
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 8,
            borderBottom: "1px solid #e6d8c6",
            paddingBottom: 18,
          }}
        >
          <h2 style={{ fontWeight: 600, fontSize: "clamp(28px,3.4vw,40px)", margin: 0, color: "#0a2338", letterSpacing: "-0.01em" }}>
            One school, three ways in
          </h2>
          <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#0e8a97", paddingBottom: 6, whiteSpace: "nowrap" }}>
            Who it&apos;s for
          </div>
        </div>
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {audiences.map((a, i) => (
            <div
              key={a.title}
              style={{
                padding: "28px 34px 8px",
                borderRight: i < audiences.length - 1 ? "1px solid #e6d8c6" : "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h3 style={{ fontWeight: 600, fontSize: 23, margin: "0 0 10px", color: "#0a2338" }}>{a.title}</h3>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.62, color: "#6a6560", flex: 1 }}>{a.desc}</p>
              <Link href={a.href} style={{ fontWeight: 700, fontSize: 14, color: "#cf3f20", textDecoration: "none" }}>
                {a.cta} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ background: "#f6ecdd", borderTop: "1px solid #ece0d5", borderBottom: "1px solid #ece0d5" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "66px 24px" }}>
          <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 30 }}>
            From our &lsquo;ohana
          </div>
          <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 44 }}>
            {testimonials.map((t) => (
              <div key={t.name} style={{ borderTop: "2px solid #ef5130", paddingTop: 18 }}>
                <p style={{ margin: "0 0 16px", fontSize: 18, lineHeight: 1.5, color: "#22323d", fontWeight: 500 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "#8a7d6a" }}>
                  {t.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#06192d,#0b3a4c 70%,#0e5561)", color: "#fff" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h2 style={{ fontWeight: 700, fontSize: "clamp(32px,4.2vw,52px)", margin: "0 0 16px", color: "#fff", letterSpacing: "-0.015em", lineHeight: 1.02 }}>
            Ready to play your first song?
          </h2>
          <p style={{ margin: "0 auto 30px", maxWidth: 520, fontSize: 17.5, lineHeight: 1.55, color: "rgba(255,245,236,0.82)" }}>
            Sign up today and pick up your instrument — we&apos;ll build the rest around a song you love.
          </p>
          <Link
            href="/signup"
            className="rw-cta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "15px 32px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
              background: "#ef5130",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Sign Up Now
          </Link>
        </div>
      </section>
    </div>
  );
}
