import Link from "next/link";
import InstrumentCards from "@/components/home/InstrumentCards";
import { instruments, audiences, songLevels, bandPromise } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import InstrumentIcon from "@/components/InstrumentIcon";
import PlayerPreview from "@/components/home/PlayerPreview";
import { Section, Container, SectionHead, Eyebrow, Button } from "@/components/ui";
import T from "@/components/T";

// Homepage for the Silkie (default) theme.
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

export default function HomeSilkie() {
  return (
    <div>
      {/* ---- THE STAGE ---- */}
      {/* A stage just before the show: two spotlights and a red glow over lacquer. The lights are CSS
          only, so a re-render never replays them; they come up once as the page paints. */}
      <section className="rw-stage">
        <div className="rw-stage-lights" aria-hidden="true">
          <span className="rw-stage-glow" />
          <span className="rw-stage-beam rw-stage-beam-left" />
          <span className="rw-stage-beam rw-stage-beam-right" />
          <span className="rw-stage-haze" />
        </div>
        <Container className="rw-stage-inner">
          <h1 className="rw-poster">
            <T k="home.hero.line1">Real songs.</T>
            <br />
            <T k="home.hero.line2">Real bands.</T>
            <br />
            <span className="rw-poster-em"><T k="home.hero.line3">From day one.</T></span>
          </h1>
          <p className="rw-stage-lead">
            <T k="home.hero.lead">
              Learn on a real song from your first lesson. Six months in, you&apos;re in a band &mdash;
              rehearsing weekly, aiming at a Hawaii stage.
            </T>
          </p>
          <div className="rw-stage-actions">
            <Button href="/signup"><T k="cta.join">Join the member area</T></Button>
            <Button href="/trial" variant="secondary" className="rw-stage-alt">
              <T k="home.hero.trial">Book a free trial</T>
            </Button>
          </div>
          <p className="rw-stage-bill"><T k="home.hero.tag">Honolulu &middot; Est. 1982</T></p>
        </Container>

        <div className="rw-wave rw-wave-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-ink)" />
          </svg>
        </div>
      </section>

      {/* The stage carries the two actions. This band only sets the two side by side, so its ways in
          are text links rather than a second pair of buttons. */}
      <section className="rw-band">
        <Container style={{ padding: "0 24px 54px" }}>
          <div className="rw-band-grid">
            <div className="rw-band-col">
              <h2 className="rw-band-label"><T k="home.band.member.label">The member area</T></h2>
              <p className="rw-band-copy">
                <T k="home.band.member.copy">
                  Membership opens the lesson videos, song library and practice tools &mdash; between
                  lessons at the school, or entirely online from anywhere.
                </T>
              </p>
              <p className="rw-band-price">$55 a month, cancel any time &mdash; or $135 a term</p>
              <div className="rw-band-links">
                <Link href="/signup" className="rw-band-link">
                  <T k="cta.join">Join the member area</T>
                </Link>
              </div>
            </div>
            <div className="rw-band-col">
              <h2 className="rw-band-label"><T k="home.band.lessons.label">Lessons at the school</T></h2>
              <p className="rw-band-copy">
                <T k="home.band.lessons.copy">
                  In person at the school in Honolulu, arranged with us, not booked here. A free trial is
                  where that starts &mdash; bring nothing, we have the instruments.
                </T>
              </p>
              <div className="rw-band-links">
                <Link href="/trial" className="rw-band-link">
                  <T k="home.band.trial">Book a free trial</T>
                </Link>
                <Link href="/program/curriculum" className="rw-band-link">
                  <T k="home.band.curriculum">See the curriculum</T>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Section band="ink">
        <SectionHead title={<T k="home.method.title">How one song gets taught</T>} eyebrow={<T k="home.method.eyebrow">The method</T>} onDark flush />
        <p className="rw-ink-lead">
          <T k="home.method.lead">
            Five passes over the same song &mdash; so by the end you understand it inside and out, not just
            how to play along.
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
        <PlayerPreview />
      </Section>

      <Section band="sand">
        <div className="rw-promise">
          <div className="rw-promise-figure" aria-hidden="true">
            <span className="rw-promise-n">{bandPromise.months}</span>
            <span className="rw-promise-unit">Months</span>
          </div>
          <div>
            <h2 className="rw-promise-head"><T k="band.headline">{bandPromise.headline}</T></h2>
            <p className="rw-promise-body"><T k="band.joins">{bandPromise.joins}</T></p>
            <p className="rw-promise-body"><T k="band.stage">{bandPromise.stage}</T></p>
            <Link href="/community/programs/rock-band-program" className="rw-tag-cta">
              <T k="home.promise.cta">How the Rock Band program works &rarr;</T>
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHead title={<T k="home.instruments.title">Choose your instrument</T>} />
        <InstrumentCards />
      </Section>

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

      {/* ---- THE RECORD ---- */}
      <Section band="sand">
        <Eyebrow><T k="home.record.eyebrow">The record</T></Eyebrow>
        <h2 className="rw-record-lead"><T k="home.record.lead">Teaching in Honolulu since 1982.</T></h2>
        <dl className="rw-sheet">
          <div className="rw-sheet-row">
            <dt><T k="home.record.instruments.label">Instruments</T></dt>
            <dd>
              <span className="rw-sheet-marks" aria-hidden="true">
                {instruments.map((inst) => (
                  <InstrumentIcon key={inst.name} name={inst.name} size={38} />
                ))}
              </span>
              <span>
                <b><T k="home.record.instruments.n">Six</T></b> <T k="home.record.instruments.text">— guitar, piano, bass, drums, voice and ukulele.</T>
              </span>
            </dd>
          </div>
          <div className="rw-sheet-row">
            <dt><T k="home.record.levels.label">Levels per song</T></dt>
            <dd>
              <b><T k="home.record.levels.n">Five</T></b><T k="home.record.levels.text">, sing-a-long through improv.</T>
            </dd>
          </div>
          <div className="rw-sheet-row">
            <dt><T k="home.record.pace.label">Pace</T></dt>
            <dd>
              <T k="home.record.pace.text">Most students finish a song every</T> <b><T k="home.record.pace.n">four to six weeks</T></b>.
            </dd>
          </div>
          <div className="rw-sheet-row">
            <dt><T k="home.record.membership.label">Membership opens</T></dt>
            <dd>
              <T k="home.record.membership.text">Every lesson video, the song library and</T> <b><T k="home.record.membership.n">five practice tools</T></b>.
            </dd>
          </div>
          <div className="rw-sheet-row">
            <dt><T k="home.record.placement.label">Band placement</T></dt>
            <dd>
              <T k="home.record.placement.pre">At</T> <b><T k="home.record.placement.n">six months</T></b><T k="home.record.placement.text">, with a shot at a Hawaii stage.</T>
            </dd>
          </div>
          <div className="rw-sheet-row">
            <dt><T k="home.record.bands.label">Bands</T></dt>
            <dd>
              <T k="home.record.bands.text">Rehearse weekly and finish at a</T> <b><T k="home.record.bands.n">Rock Works recital</T></b>.
            </dd>
          </div>
        </dl>
      </Section>

      {/* ---- THE ASK ---- */}
      <section className="rw-field rw-field-ask">
        <div className="rw-wave rw-wave-top" aria-hidden="true">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-sand)" />
          </svg>
        </div>
        <PrintRepeat color="var(--rw-ink)" opacity={0.07} />
        <Container width="text" style={{ position: "relative", padding: "40px 24px 84px", textAlign: "center" }}>
          <div className="rw-mark-chrome" aria-hidden="true">
            <RockWorksIcon size={64} color="currentColor" />
          </div>
          <h2 className="rw-poster rw-poster-ask"><T k="home.ask.title">Ready to play your first song?</T></h2>
          <p className="rw-field-lead" style={{ margin: "0 auto 26px", textAlign: "center" }}>
            <T k="home.ask.lead">
              Membership opens every lesson video, the song library and the practice tools. Lessons at the
              school are arranged with us.
            </T>
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
            <Button href="/signup" variant="field">
              <T k="cta.join">Join the member area</T>
            </Button>
            <Button href="/trial" variant="quiet">
              <T k="cta.trial">Book a free trial &rarr;</T>
            </Button>
          </div>
          <p className="rw-ask-price">$55 a month, cancel any time &mdash; or $135 for a three-month term.</p>
        </Container>
      </section>
    </div>
  );
}
