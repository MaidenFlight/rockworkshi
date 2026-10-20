// Homepage for the Classic theme.

import Link from "next/link";
import { instruments, audiences, songLevels } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import InstrumentIcon from "@/components/InstrumentIcon";
import { Section, Container, SectionHead, Eyebrow, Button } from "@/components/ui";
import T from "@/components/T";

export default function HomeClassic() {
  return (
    <div>
      {/* HERO */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(115% 85% at 94% 112%, rgba(232,106,55,0.5) 0%, rgba(232,106,55,0.14) 42%, rgba(232,106,55,0) 66%)," +
            "linear-gradient(168deg,var(--rw-ink-deep) 0%,#0a2f43 36%,#0d5561 66%,#127a86 100%)",
          color: "#fff5ec",
        }}
      >
        <div
          style={{
            position: "relative",
            maxWidth: 1240,
            margin: "0 auto",
            padding: "84px 24px 104px",
          }}
        >
          <div style={{ animation: "rise .7s ease both", maxWidth: 940 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "var(--rw-sea-glass)",
                display: "flex",
                alignItems: "center",
                gap: 13,
              }}
            >
              <span style={{ width: 28, height: 1.5, background: "var(--rw-sea-glass)", display: "inline-block" }} />
              <T k="home.hero.tag">Honolulu &middot; Est. 1982</T>
            </div>
            <h1
              style={{
                fontWeight: 700,
                fontSize: "clamp(46px,7.4vw,106px)",
                lineHeight: 0.96,
                letterSpacing: "-0.022em",
                margin: "22px 0 0",
                color: "#fff",
              }}
            >
              <T k="home.hero.line1">Real songs.</T>
              <br />
              <T k="home.hero.line2">Real bands.</T>
              <br />
              <em style={{ fontStyle: "italic", fontWeight: 600, color: "var(--rw-gold)" }}><T k="home.hero.line3">From day one.</T></em>
            </h1>
            <p style={{ fontSize: 18.5, lineHeight: 1.62, maxWidth: 466, margin: "26px 0 34px", color: "rgba(255,245,236,0.86)" }}>
              <T k="home.classic.hero.lead">
                A ten-year, song-based curriculum where every student learns to play, perform, and eventually
                write their own music — one real song at a time.
              </T>
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
              <Button href="/signup"><T k="cta.join">Join the member area</T></Button>
              <Button href="/program/curriculum" variant="quiet" onDark>
                <T k="home.classic.hero.curriculum">See the curriculum &rarr;</T>
              </Button>
            </div>
            <p style={{ margin: "20px 0 0", maxWidth: 466, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,245,236,0.78)" }}>
              <T k="home.classic.hero.note">
                Membership opens the lesson videos, song library and practice tools. Lessons at the school
                are arranged with us &mdash;
              </T>{" "}
              <Link
                href="/trial"
                style={{ color: "var(--rw-gold)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                <T k="home.classic.hero.trial">start with a free trial</T>
              </Link>
              .
            </p>
          </div>
        </div>
        <div style={{ position: "relative", lineHeight: 0 }}>
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ width: "100%", height: 64, display: "block" }}>
            <path d="M0,48 C240,96 480,10 720,40 C960,70 1200,20 1440,52 L1440,90 L0,90 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
      </section>

      {/* THE STRAPLINE, three parallel facts, set tight. */}
      <Container style={{ padding: "40px 24px 4px" }}>
        <ul className="rw-strapline">
          {[
            {
              key: "song",
              title: "One song a month",
              body: "Every song is taught in five levels — sing-a-long, chords, scales & fills, melody, and improv.",
            },
            {
              key: "format",
              title: "Solo or in a band",
              body: "Learn one-on-one, or sign up with friends and siblings to form your own Rock Band.",
            },
            {
              key: "path",
              title: "A ten-year path",
              body: "We can tell you exactly where you'll be in 6 months, 1, 2, 3, 5, and 10 years.",
            },
          ].map((v) => (
            <li key={v.key}>
              <h2 className="rw-strapline-title"><T k={`home.classic.strap.${v.key}.title`}>{v.title}</T></h2>
              <p className="rw-strapline-body"><T k={`home.classic.strap.${v.key}.body`}>{v.body}</T></p>
            </li>
          ))}
        </ul>
      </Container>

      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg,var(--rw-ink-deep) 0%,#0b3446 46%,#0d5a66 100%)" }}>
        <div className="rw-wave rw-wave-top" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
        <Container style={{ padding: "18px 24px 84px", position: "relative" }}>
          <SectionHead title={<T k="home.method.title">How one song gets taught</T>} eyebrow={<T k="home.method.eyebrow">The method</T>} onDark flush />
          <p
            style={{
              maxWidth: 620,
              margin: "18px 0 46px",
              fontSize: "var(--rw-text-md)",
              lineHeight: 1.6,
              color: "rgba(255,245,236,0.82)",
            }}
          >
            <T k="home.method.lead">
              Five passes over the same song — so by the end you understand it inside and out, not just how to
              play along.
            </T>
          </p>
          <ol className="rw-levels">
            {songLevels.map((lv) => (
              <li key={lv.n} className="rw-level">
                <span className="rw-level-n">{lv.n}</span>
                <h3 className="rw-level-name"><T k={`levels.${lv.n}.name`}>{lv.name}</T></h3>
                <p className="rw-level-desc"><T k={`levels.${lv.n}.desc`}>{lv.desc}</T></p>
              </li>
            ))}
          </ol>
        </Container>
        <div className="rw-wave rw-wave-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
      </section>

      <Section>
        <SectionHead title={<T k="home.instruments.title">Choose your instrument</T>} eyebrow={<T k="home.instruments.eyebrow">Pick your sound</T>} />
        <p
          style={{
            maxWidth: 620,
            margin: "18px 0 26px",
            fontSize: "var(--rw-text-md)",
            lineHeight: 1.6,
            color: "var(--rw-prose)",
          }}
        >
          <T k="home.instruments.lead">
            Lesson videos in the member area are organised by instrument. Pick yours and we&apos;ll carry it
            into signup.
          </T>
        </p>
        <div
          className="rw-cols-6"
          style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", border: "1px solid var(--rw-rule)", borderRadius: 14, overflow: "hidden" }}
        >
          {instruments.map((inst, i) => (
            <Link
              key={inst.name}
              href={`/signup?instrument=${encodeURIComponent(inst.name)}`}
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

      {/* WHO IT'S FOR, the page's one asymmetric section. */}
      <Section>
        <div className="rw-split">
          <div className="rw-split-head">
            <SectionHead title={<T k="home.ways.title">One school, three ways in</T>} eyebrow={<T k="home.ways.eyebrow">Who it&apos;s for</T>} as="h2" flush />
          </div>
          <ul className="rw-ways">
            {audiences.map((a) => (
              <li key={a.key} className="rw-way">
                <h3 className="rw-way-title"><T k={`audiences.${a.key}.title`}>{a.title}</T></h3>
                <p className="rw-way-desc"><T k={`audiences.${a.key}.desc`}>{a.desc}</T></p>
                <Link href={a.href} className="rw-way-cta">
                  <T k={`audiences.${a.key}.cta`}>{a.cta}</T> &rarr;
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* THE RECORD, the proof band. */}
      <Section band="sand">
        <Eyebrow><T k="home.record.eyebrow">The record</T></Eyebrow>
        <h2 className="rw-record-lead"><T k="home.record.lead">Teaching in Honolulu since 1982.</T></h2>
        <ul className="rw-record">
          <li>
            <b><T k="home.record.instruments.n">Six</T></b> <T k="home.classic.record.instruments">instruments — guitar, piano, bass, drums, voice and ukulele.</T>
          </li>
          <li>
            <b><T k="home.record.levels.n">Five</T></b> <T k="home.classic.record.levels">levels to every song, sing-a-long through improv.</T>
          </li>
          <li>
            <T k="home.record.pace.text">Most students finish a song every</T> <b><T k="home.record.pace.n">four to six weeks</T></b>.
          </li>
          <li>
            <T k="home.classic.record.membership">Membership opens every lesson video, the song library and</T> <b><T k="home.record.membership.n">five practice tools</T></b>.
          </li>
          <li>
            <T k="home.classic.record.bands">Bands rehearse weekly and finish at a</T> <b><T k="home.record.bands.n">Rock Works recital</T></b>.
          </li>
        </ul>
      </Section>

      {/* CTA */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,var(--rw-ink-deep),#0b3a4c 70%,#0e5561)", color: "#fff" }}>
        {/* The watermark is a wide-viewport detail. */}
        <div className="rw-wave rw-wave-top" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-sand)" />
          </svg>
        </div>
        <div className="rw-watermark" aria-hidden="true">
          <RockWorksIcon size={420} color="#fff" />
        </div>
        <Container width="text" style={{ position: "relative", padding: "34px 24px 80px", textAlign: "center" }}>
          <h2 style={{ fontWeight: 700, fontSize: "clamp(32px,4.2vw,52px)", margin: "0 0 16px", color: "#fff", letterSpacing: "-0.015em", lineHeight: 1.02 }}>
            <T k="home.ask.title">Ready to play your first song?</T>
          </h2>
          <p style={{ margin: "0 auto 30px", maxWidth: 520, fontSize: 17.5, lineHeight: 1.55, color: "rgba(255,245,236,0.82)" }}>
            <T k="home.classic.ask.lead">
              Membership opens every lesson video, the song library and the practice tools &mdash; the part
              of learning that happens between lessons.
            </T>
          </p>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
            <Button href="/signup"><T k="cta.join">Join the member area</T></Button>
            <Button href="/trial" variant="quiet" onDark>
              <T k="cta.trial">Book a free trial &rarr;</T>
            </Button>
          </div>
          <p style={{ margin: "20px auto 0", maxWidth: 520, fontSize: 15, lineHeight: 1.6, color: "rgba(255,245,236,0.9)" }}>
            $55 a month, cancel any time &mdash; or $135 for a three-month term.
          </p>
          <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,245,236,0.74)" }}>
            <T k="home.classic.ask.note">
              Lessons at the school are arranged with us, not booked here &mdash; the trial is where that
              starts.
            </T>
          </p>
        </Container>
      </section>
    </div>
  );
}
