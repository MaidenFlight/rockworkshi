import RockWorksIcon from "@/components/RockWorksIcon";
import { Container, Button } from "@/components/ui";
import T from "@/components/T";
import { PLANS } from "@/lib/auth/signupOptions";
import Reveal from "./Reveal";
import s from "./ClosingBill.module.css";

// The closing bill: the homepage's last section (Silkie), set like the back page of a concert
// programme. A headline, then the two ways to begin as one printed spread: the member area on
// lacquer (the practice console's own ground) and lessons at the school on label stock.
//
// The prices are read from the plan list signup uses, so this page cannot quote a figure the
// form does not charge. The amounts themselves live on the server (backend/src/lib/plans.js).
const priceOf = (key) => PLANS.find((p) => p.key === key).price.split("/")[0];

// The mark's outline with the wave closed up, so it can be echoed as a single line.
const PICK =
  "M9.74 28.53C6.72 24.65 6.15 19.4 8.27 14.95C10.42 10.43 14.99 7.55 20 7.55H44C49.01 7.55 53.58 10.43 55.73 14.95C57.05 17.7 57.33 20.76 56.63 23.62V27.02C56.19 28.85 55.34 30.6 54.11 32.13L36.28 54.16C35.23 55.45 33.66 56.2 32 56.2C30.34 56.2 28.77 55.45 27.72 54.16L9.89 32.13C9.84 32.06 9.79 32 9.74 31.93Z";

// Where the mark's weight sits, in its own 64-unit square. The echoes grow from here.
const HEART = "translate(-32 -27)";

// Thirteen echoes of the pick, each a little further out than the last and a little fainter:
// a note leaving the string. The gaps open up as they travel.
const ECHOES = Array.from({ length: 13 }, (_, i) => ({
  scale: Math.round((1.24 + i * 0.25 + i * i * 0.012) * 1000) / 1000,
  strength: Math.round(0.62 * 0.84 ** i * 1000) / 1000,
}));

function Echo() {
  return (
    <svg className={s.echo} viewBox="-150 -150 300 300" aria-hidden="true" focusable="false">
      <g className={s.echoCore} transform={HEART}>
        <RockWorksIcon size={64} color="currentColor" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {ECHOES.map((e) => (
          <g key={e.scale} transform={`scale(${e.scale}) ${HEART}`} opacity={e.strength}>
            <path d={PICK} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={s.arrow} width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true" focusable="false">
      <path d="M0 6H16M11 1L16 6L11 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
    </svg>
  );
}

export default function ClosingBill() {
  return (
    <Reveal as="section" className={s.close} data-rw-closing="" aria-labelledby="rw-closing-title">
      <div className="rw-wave rw-wave-top" aria-hidden="true">
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-sand)" />
        </svg>
      </div>

      {/* The room: one warm light, the pick and its echoes, and the paper's grain. Decoration only. */}
      <div className={s.room} aria-hidden="true">
        <span className={s.light} />
        <Echo />
        <span className={s.grain} />
      </div>

      <Container className={s.inner}>
        <header className={s.head}>
          <p className={s.eyebrow}><T k="home.close.eyebrow">Every musician starts somewhere</T></p>
          <h2 id="rw-closing-title" className={s.title}>
            <span className={s.line}><span className={s.rise}><T k="home.close.line1">Your first song.</T></span></span>{" "}
            <span className={`${s.line} ${s.gold}`}><span className={s.rise}><T k="home.close.line2">Your next stage.</T></span></span>
          </h2>
          <p className={s.lead}>
            <T k="home.close.lead">
              Learn at your own pace or join us in Honolulu. Your music journey starts here.
            </T>
          </p>
        </header>

        <Reveal className={s.paths}>
          <article className={`${s.path} ${s.online}`}>
            <p className={s.label}><T k="home.close.online.label">Learn online</T></p>
            <h3 className={s.pathTitle}><T k="home.close.online.title">Your practice studio.</T></h3>
            <p className={s.copy}>
              <T k="home.close.online.copy">
                Membership opens the member area: the song lessons available now, lesson videos, the
                song library and interactive practice tools. Use it alongside lessons at the school,
                or entirely online from anywhere.
              </T>
            </p>
            <div className={s.terms}>
              <p className={s.offer}>
                <span className={s.figure}>{priceOf("monthly")}</span>
                <span className={s.per}>
                  <b>per month</b> <span>Cancel any time.</span>
                </span>
              </p>
              <p className={s.alt}>
                Or <b>{priceOf("term")}</b> for a three-month term.
              </p>
            </div>
            <div className={s.go}>
              <Button href="/signup" className={s.cta}>
                <T k="cta.join">Join the member area</T>
                <Arrow />
              </Button>
            </div>
          </article>

          <article className={`${s.path} ${s.inPerson}`}>
            <p className={s.label}><T k="home.close.school.label">Learn in person</T></p>
            <h3 className={s.pathTitle}><T k="home.close.school.title">Find your sound.</T></h3>
            <p className={s.copy}>
              <T k="home.close.school.copy">
                Lessons happen in person at the school in Honolulu, arranged with us. Six months in,
                you join a band, with a chance to play on a Hawaii stage.
              </T>
            </p>
            <div className={s.terms}>
              <p className={s.offer}>
                <span className={s.figure}><T k="home.close.school.figure">Free</T></span>
                <span className={s.per}>
                  <b><T k="home.close.school.what">trial lesson</T></b>{" "}
                  <span><T k="home.close.school.note">On the instrument you pick. We have the instruments.</T></span>
                </span>
              </p>
              <p className={s.alt}>
                <T k="home.close.school.terms">Lessons are arranged with the school, separately from membership.</T>
              </p>
            </div>
            <div className={s.go}>
              <Button href="/trial" variant="field" className={s.cta}>
                <T k="home.close.school.cta">Book a free trial</T>
                <Arrow />
              </Button>
            </div>
          </article>

          <p className={s.bill}>
            <span className={s.billMark}>
              <RockWorksIcon size={18} color="var(--rw-gold)" />
              <T k="home.hero.tag">Honolulu &middot; Est. 1982</T>
            </span>
          </p>
        </Reveal>
      </Container>
    </Reveal>
  );
}
