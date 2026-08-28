import Link from "next/link";
import { instruments, audiences, songLevels } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import InstrumentIcon from "@/components/InstrumentIcon";
import { Section, Container, SectionHead, Eyebrow, Button } from "@/components/ui";

// The hero and the levels band keep their own styles rather than going through
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
            // The warm end is now a light source rather than a colour field.
            // The old gradient ran through two orange stops and painted roughly
            // a quarter of the hero solid orange — which the system bans
            // outright ("never a background for a large area") and which put a
            // 400px orange shape in the same viewport as the orange button, so
            // nothing read as primary. Removing the image column made it worse
            // by handing that corner even more room.
            // A radial bloom falling off to nothing keeps the last-light read
            // the north star asks for, without ever becoming a field: it is
            // spill from a rig, not a sunset.
            "radial-gradient(115% 85% at 94% 112%, rgba(232,106,55,0.5) 0%, rgba(232,106,55,0.14) 42%, rgba(232,106,55,0) 66%)," +
            "linear-gradient(168deg,var(--rw-ink-deep) 0%,#0a2f43 36%,#0d5561 66%,#127a86 100%)",
          color: "#fff5ec",
        }}
      >
        {/* One column, not two. The right-hand column held /band.svg — a drawn
            stick figure captioned as though it were a photograph of the school.
            It was the largest element on the page and the first thing a visitor
            saw, and it read as unfinished on a site that takes payment. A
            confident type-only hero beats a two-column hero whose second column
            is a placeholder, so the column is gone until a real photograph
            exists. The caption chip went with it; it was being clipped by its
            own overflow:hidden parent anyway.

            The measure is held at 15ch on the headline rather than the full
            1200 — 84px type running the whole container width would break the
            line wherever the viewport happened to fall. */}
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
              Honolulu &middot; Est. 1982
            </div>
            <h1
              style={{
                fontWeight: 700,
                // Larger than it was. With the image column gone the headline
                // is the only thing holding the hero, and at 84px in a 1240
                // container it sat in a narrow stack with half the band empty
                // beside it. Type carrying a space has to be sized for that
                // space or the space reads as missing content.
                fontSize: "clamp(46px,7.4vw,106px)",
                lineHeight: 0.96,
                letterSpacing: "-0.022em",
                margin: "22px 0 0",
                color: "#fff",
              }}
            >
              Real songs.
              <br />
              Real bands.
              <br />
              <em style={{ fontStyle: "italic", fontWeight: 600, color: "var(--rw-gold)" }}>From day one.</em>
            </h1>
            <p style={{ fontSize: 18.5, lineHeight: 1.62, maxWidth: 466, margin: "26px 0 34px", color: "rgba(255,245,236,0.86)" }}>
              A ten-year, song-based curriculum where every student learns to play, perform, and eventually
              write their own music — one real song at a time.
            </p>
            {/* This button said "Start Lessons" and led to a paid signup for
                member-area access — a different product from the lessons, which
                are arranged with the school and are deliberately never priced
                on the site. So the page's largest action named the one thing
                its destination does not sell, and the visitor who actually
                wanted lessons had no route at all. Both are named now, and the
                note below is the only place on the page that had to explain
                the difference — the CTA repeats it with the price attached. */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
              <Button href="/signup">Join the member area</Button>
              <Button href="/program/curriculum" variant="quiet" onDark>
                See the curriculum &rarr;
              </Button>
            </div>
            <p style={{ margin: "20px 0 0", maxWidth: 466, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,245,236,0.78)" }}>
              Membership opens the lesson videos, song library and practice tools. Lessons at the school
              are arranged with us &mdash;{" "}
              <Link
                href="/trial"
                style={{ color: "var(--rw-gold)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                start with a free trial
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

      {/* THE STRAPLINE — three parallel facts, set tight.
          This used to be a three-column row with vertical rules, generous
          padding and 22px slab headings — which is exactly what the audience
          section further down also was. Two near-identical rows 900px apart
          made the page read as one repeated move, and the eye stopped
          expecting anything new after the second screen.
          It is now the denser of the two: smaller headings, a single hairline
          above rather than rules between, sitting close under the hero wave
          like a masthead strapline. The audience section keeps the generous
          treatment. The contrast between them is the rhythm. */}
      <Container style={{ padding: "40px 24px 4px" }}>
        <ul className="rw-strapline">
          {[
            {
              title: "One song a month",
              body: "Every song is taught in five levels — sing-a-long, chords, scales & fills, melody, and improv.",
            },
            {
              title: "Solo or in a band",
              body: "Learn one-on-one, or sign up with friends and siblings to form your own Rock Band.",
            },
            {
              title: "A ten-year path",
              body: "We can tell you exactly where you'll be in 6 months, 1, 2, 3, 5, and 10 years.",
            },
          ].map((v) => (
            <li key={v.title}>
              <h2 className="rw-strapline-title">{v.title}</h2>
              <p className="rw-strapline-body">{v.body}</p>
            </li>
          ))}
        </ul>
      </Container>

      {/* THE FIVE LEVELS
          Replaces a stats band whose two figures ("96% of families", "9 in 10
          students") and its "Rock Works Family Survey, 2026" attribution were
          invented — see PRODUCT.md, Evidence on Hand. What stands here instead
          is the school's actual method, which was previously buried in a single
          clause higher up the page, and which is the one thing on this page a
          neighbouring school could not truthfully copy.

          The numerals are earned here in a way 01/02/03 above them were not:
          1-5 is a real sequence the reader needs, and the rule threading the
          markers is the argument — one path through one song, not five
          separate offerings. */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg,var(--rw-ink-deep) 0%,#0b3446 46%,#0d5a66 100%)" }}>
        {/* The band rises out of the paper and sinks back into it on the same
            cubic the page heroes use, flipped for the top edge. This is the
            only dark band on the site that sits between two cream sections, so
            it is the only one that needs the wave twice — and it was shipping
            with two straight edges, which is the one thing the form language
            says never to do. */}
        <div className="rw-wave rw-wave-top" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
        <Container style={{ padding: "18px 24px 84px", position: "relative" }}>
          <SectionHead title="How one song gets taught" eyebrow="The method" onDark flush />
          <p
            style={{
              maxWidth: 620,
              margin: "18px 0 46px",
              fontSize: "var(--rw-text-md)",
              lineHeight: 1.6,
              color: "rgba(255,245,236,0.82)",
            }}
          >
            Five passes over the same song — so by the end you understand it inside and out, not just how to
            play along.
          </p>
          <ol className="rw-levels">
            {songLevels.map((lv) => (
              <li key={lv.n} className="rw-level">
                <span className="rw-level-n">{lv.n}</span>
                <h3 className="rw-level-name">{lv.name}</h3>
                <p className="rw-level-desc">{lv.desc}</p>
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

      {/* INSTRUMENTS
          All six tiles pointed at /program/format — six distinct doors into
          one room that never mentions bass, so the choice the section invites
          was thrown away at the click. Each one carries its own name into
          signup now, where the wizard already stores that exact string and the
          backend matches lesson videos against it.

          Which makes the line below load-bearing rather than decorative: the
          section asks a lessons-shaped question and now answers it with the
          paid product, so it has to say what picking an instrument actually
          buys. That is a real thing — membership gates the videos per
          instrument — and it is the only honest bridge between the two. It is
          not a third printing of the lessons-versus-membership note the page
          carries twice already; it names a feature. */}
      <Section>
        <SectionHead title="Choose your instrument" eyebrow="Pick your sound" />
        <p
          style={{
            maxWidth: 620,
            margin: "18px 0 26px",
            fontSize: "var(--rw-text-md)",
            lineHeight: 1.6,
            color: "var(--rw-prose)",
          }}
        >
          Lesson videos in the member area are organised by instrument. Pick yours and we&apos;ll carry it
          into signup.
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

      {/* WHO IT'S FOR — the page's one asymmetric section.
          This was a third row of equal columns divided by vertical rules, and
          with the strapline above it that made three of the page's five
          sections the same shape. It is now a heading held in a narrow left
          column against a vertical list on the right: the only place the page
          changes its measure mid-section, and the moment the grid breaks.

          It also settles a misalignment nobody would have named but everyone
          could see — the old columns carried a 34px inner inset, so their
          headings started at x=178 while every other heading, rule and level
          name on the page started at x=144. Nothing lines up with 34px of
          nothing. */}
      <Section>
        <div className="rw-split">
          <div className="rw-split-head">
            <SectionHead title="One school, three ways in" eyebrow="Who it's for" as="h2" flush />
          </div>
          <ul className="rw-ways">
            {audiences.map((a) => (
              <li key={a.title} className="rw-way">
                <h3 className="rw-way-title">{a.title}</h3>
                <p className="rw-way-desc">{a.desc}</p>
                <Link href={a.href} className="rw-way-cta">
                  {a.cta} &rarr;
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* THE RECORD — the proof band. See .rw-record in globals.css for why it
          is shaped the way it is, and for the provenance of every line.

          The slot is no longer empty, but the rule that guarded it still
          holds: nothing goes in here that the school cannot stand behind. If
          real customer quotes ever arrive, they belong in this band and these
          lines make room for them — they do not belong anywhere else on the
          page, and neither does anything counted for the occasion. */}
      <Section band="sand">
        <Eyebrow>The record</Eyebrow>
        <h2 className="rw-record-lead">Teaching in Honolulu since 1982.</h2>
        <ul className="rw-record">
          <li>
            <b>Six</b> instruments — guitar, piano, bass, drums, voice and ukulele.
          </li>
          <li>
            <b>Five</b> levels to every song, sing-a-long through improv.
          </li>
          <li>
            Most students finish a song every <b>four to six weeks</b>.
          </li>
          <li>
            Membership opens every lesson video, the song library and <b>five practice tools</b>.
          </li>
          <li>
            Bands rehearse weekly and finish at a <b>Rock Works recital</b>.
          </li>
        </ul>
      </Section>

      {/* CTA */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,var(--rw-ink-deep),#0b3a4c 70%,#0e5561)", color: "#fff" }}>
        {/* The watermark is a wide-viewport detail. right:-6% puts it safely off
            the right edge at 1440, but at 390 that same percentage lands it dead
            centre behind the headline, where 8% white reads as a grey smudge
            through the type rather than as a mark. Hidden below the breakpoint
            where it stops being decoration and starts being dirt. */}
        {/* The CTA met the paper above it on a straight edge, which the form
            language forbids outright — "dark meets paper on the wave, never on
            a straight edge". It was survivable while the section above was
            cream; with the sand record band now landing directly on it the
            tonal step is larger and the hard line is the first thing the eye
            catches. Same cubic as everywhere else, flipped on Y so the paper
            spills down into the dark, filled Coral Sand to match what is
            actually above it. The container's top padding drops by the wave's
            height so the ask does not sink down the section. */}
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
            Ready to play your first song?
          </h2>
          <p style={{ margin: "0 auto 30px", maxWidth: 520, fontSize: 17.5, lineHeight: 1.55, color: "rgba(255,245,236,0.82)" }}>
            Membership opens every lesson video, the song library and the practice tools &mdash; the part
            of learning that happens between lessons.
          </p>
          {/* The same pairing the hero uses — solid primary beside a quiet
              underlined link — so the two read as one decision with a cheaper
              option rather than as two competing buttons. The trial was a
              sentence-level link under the price a moment ago; at the point of
              the ask it has to be a control, because it is exactly what a
              visitor who is not ready to pay is looking for. */}
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
            <Button href="/signup">Join the member area</Button>
            <Button href="/trial" variant="quiet" onDark>
              Book a free trial &rarr;
            </Button>
          </div>
          {/* The price appeared nowhere on this page, and the button above bills
              for it four steps later. Someone who reaches a card form having
              never seen a number is a refund request, and the site takes real
              cards. Both plans are stated here; "cancel any time" is attached
              only to the monthly, because the term renews and does not. The
              amounts are display copy — the server holds the real ones
              (backend/src/lib/plans.js) and the client never sends a price. */}
          <p style={{ margin: "20px auto 0", maxWidth: 520, fontSize: 15, lineHeight: 1.6, color: "rgba(255,245,236,0.9)" }}>
            $55 a month, cancel any time &mdash; or $135 for a three-month term.
          </p>
          <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,245,236,0.74)" }}>
            Lessons at the school are arranged with us, not booked here &mdash; the trial is where that
            starts.
          </p>
        </Container>
      </section>
    </div>
  );
}
