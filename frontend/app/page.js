import Link from "next/link";
import { instruments, audiences, songLevels } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import InstrumentIcon from "@/components/InstrumentIcon";
import { Section, Container, SectionHead, Eyebrow, Button } from "@/components/ui";

// THE SILKIE — the homepage as a printed garment.
//
// A silkie has three parts and so does this page: a saturated FIELD carrying a
// motif repeat, an engineered BORDER BAND at the hem where the print
// concentrates and the garment says what it is, and LABEL STOCK where anything
// has to be read. Every section below is one of those three, and none of them
// is a row of equal cards.
//
// The wave survives from the previous world and changes job: it was the seam
// between dark bands and paper, and it is now the seam between field and band —
// the same curve, cut where the print stops.
//
// Every word on this page is carried over unchanged. The redesign replaces the
// look, not the facts, and the facts were fought for: the two products are
// still named separately, the price is still stated before anyone reaches a
// card form, and nothing here is invented.

// The print repeat. The six instrument marks are the motif — the school's own
// drawn set, tiled the way a shirt tiles a figure, at a scale where they read
// as pattern rather than as icons. It is decoration and nothing else, so it is
// aria-hidden and never carries meaning the copy does not also carry.
function PrintRepeat({ color, opacity }) {
  const rows = 5;
  const cols = 7;
  return (
    <div className="rw-repeat" aria-hidden="true" style={{ color, opacity }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="rw-repeat-row" style={{ marginLeft: r % 2 ? "5%" : 0 }}>
          {Array.from({ length: cols }).map((_, c) => {
            const inst = instruments[(r * cols + c) % instruments.length];
            return (
              <span key={c} style={{ transform: `rotate(${((r + c) % 4) * 6 - 9}deg)` }}>
                <InstrumentIcon name={inst.name} size={96} />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div>
      {/* ---- THE FIELD ----
          Full-bleed flare. This is the loud element the previous homepage did
          not have anywhere on it: the brightest thing on that page was a small
          button, on a site selling rock and roll to teenagers.

          Type is lacquer on flare rather than white on flare — 5.06:1 against
          3.65:1, and the darker mark reads as printed ink on cloth, which is
          what the world is. Nothing small is ever set on this ground; the
          constraint is written into the token. */}
      <section className="rw-field">
        <PrintRepeat color="var(--rw-ink)" opacity={0.09} />
        <Container style={{ position: "relative", padding: "76px 24px 92px" }}>
          <div className="rw-field-tag">Honolulu &middot; Est. 1982</div>
          <h1 className="rw-poster">
            Real songs.
            <br />
            Real bands.
            <br />
            <span className="rw-poster-em">From day one.</span>
          </h1>
          <p className="rw-field-lead">
            A ten-year, song-based curriculum where every student learns to play, perform, and eventually
            write their own music &mdash; one real song at a time.
          </p>
        </Container>

        {/* The seam. Same cubic the site has always used, cut where the print
            stops and the band begins. */}
        <div className="rw-wave rw-wave-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-ink)" />
          </svg>
        </div>
      </section>

      {/* ---- THE BORDER BAND ----
          On a silkie the hem band is where the print concentrates and the
          garment states itself. Here it carries the whole offer: both products
          named, both actions, and the price — which sits above the fold on a
          site that takes real cards, instead of four steps into a wizard. */}
      <section className="rw-band">
        <Container style={{ padding: "0 24px 54px" }}>
          <div className="rw-band-grid">
            <div>
              <div className="rw-band-label">The member area</div>
              <p className="rw-band-copy">
                Membership opens the lesson videos, song library and practice tools &mdash; the part of
                learning that happens between lessons.
              </p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <Button href="/signup">Join the member area</Button>
                <span className="rw-band-price">$55 a month, cancel any time &mdash; or $135 a term</span>
              </div>
            </div>
            <div>
              <div className="rw-band-label">Lessons at the school</div>
              <p className="rw-band-copy">
                Arranged with us, not booked here. A free trial is where that starts &mdash; bring
                nothing, we have the instruments.
              </p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <Button href="/trial" variant="quiet" onDark>
                  Book a free trial &rarr;
                </Button>
                <Link href="/program/curriculum" className="rw-band-link">
                  See the curriculum
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---- THE METHOD ----
          Still the one thing a neighbouring school could not truthfully copy,
          and still the second thing on the page. What changed is the numerals:
          they were 34px circles in a hairline row and they are now the largest
          objects in the section, because 1 to 5 IS the argument. */}
      <Section band="ink">
        <SectionHead title="How one song gets taught" eyebrow="The method" onDark flush />
        <p className="rw-ink-lead">
          Five passes over the same song &mdash; so by the end you understand it inside and out, not just
          how to play along.
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
      </Section>

      {/* ---- THE MOTIFS ----
          The six marks were the most evocative things the school owns and the
          old page rendered them as small grey line icons in a spreadsheet row,
          at the visual weight of a settings menu. They are the print motif
          now: big, on their own ground, each one a door. */}
      <Section>
        <SectionHead title="Choose your instrument" eyebrow="Pick your sound" />
        <p className="rw-lede">
          Lesson videos in the member area are organised by instrument. Pick yours and we&apos;ll carry it
          into signup.
        </p>
        <div className="rw-motifs">
          {instruments.map((inst) => (
            <Link
              key={inst.name}
              href={`/signup?instrument=${encodeURIComponent(inst.name)}`}
              className="rw-motif"
            >
              <span className="rw-motif-mark">
                <InstrumentIcon name={inst.name} size={78} />
              </span>
              <span className="rw-motif-name">{inst.name}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ---- WHO IT'S FOR ----
          The page's one asymmetric section, kept from the previous world
          because the argument for it still holds: it is the only place the
          page changes measure mid-section. */}
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

      {/* ---- THE RECORD ----
          The proof band. The rule that guarded this slot when it was empty
          still holds through the redesign: nothing goes in here the school
          cannot stand behind, and real customer quotes belong here when they
          exist. The street address is still the one line missing, and it is
          still not invented. */}
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

      {/* ---- THE ASK ----
          The field returns, so the page opens and closes on the same ground.
          The price repeats here because someone who scrolled past the band
          should not have to scroll back up to find a number. */}
      <section className="rw-field rw-field-ask">
        <div className="rw-wave rw-wave-top" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
          </svg>
        </div>
        <PrintRepeat color="var(--rw-ink)" opacity={0.07} />
        <Container width="text" style={{ position: "relative", padding: "40px 24px 84px", textAlign: "center" }}>
          <div className="rw-mark-chrome" aria-hidden="true">
            <RockWorksIcon size={64} color="currentColor" />
          </div>
          <h2 className="rw-poster rw-poster-ask">Ready to play your first song?</h2>
          <p className="rw-field-lead" style={{ margin: "0 auto 26px", textAlign: "center" }}>
            Membership opens every lesson video, the song library and the practice tools. Lessons at the
            school are arranged with us.
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
            <Button href="/signup" variant="field">
              Join the member area
            </Button>
            <Button href="/trial" variant="quiet">
              Book a free trial &rarr;
            </Button>
          </div>
          <p className="rw-ask-price">$55 a month, cancel any time &mdash; or $135 for a three-month term.</p>
        </Container>
      </section>
    </div>
  );
}
