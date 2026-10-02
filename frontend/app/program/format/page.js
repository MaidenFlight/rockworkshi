import EditorialHero from "@/components/EditorialHero";
import { Button } from "@/components/ui";
import T from "@/components/T";

const OPTIONS = [
  { key: "solo", title: "One-on-one", desc: "Weekly private lessons, paced entirely around one student." },
  { key: "band", title: "Rock Band", desc: "Small groups of students learn the same song together and perform it as a band." },
  { key: "family", title: "Family & friends", desc: "Siblings or friends can share a lesson slot and learn side by side." },
];

// Membership pricing only — what it costs to have access to the member area.
// Lesson fees are arranged with the school and deliberately aren't quoted here.
const PRICING = [
  { key: "monthly", name: "Monthly", price: "$55", per: "/ month", desc: "Full access to every lesson, the song library, and the practice tools. Cancel any time." },
  { key: "term", name: "Term", price: "$135", per: "/ 3 months", desc: "The same access, paid up front for a full term. Works out at $45 a month." },
];

export default function Format() {
  return (
    <div>
      <EditorialHero
        eyebrow={<T k="format.hero.eyebrow">Program</T>}
        title={<T k="format.hero.title">Format & Pricing</T>}
        intro={<T k="format.hero.intro">Choose how you want to learn — solo, with friends, or in a band — and what it costs.</T>}
      />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px 100px" }}>
        <h2 className="rw-subhead rw-subhead-flush"><T k="format.ways.heading">Ways to learn</T></h2>
        {/* Was three equal rounded cards — the arrangement six inner pages
            shared and the one the homepage threw out. They are tags now: the
            flare rule across the top is what makes the row read as one set. */}
        <div className="rw-tags rw-tags-3">
          {OPTIONS.map((o) => (
            <div key={o.key} className="rw-tag">
              <h3 className="rw-tag-title"><T k={`format.ways.${o.key}.title`}>{o.title}</T></h3>
              <p className="rw-tag-body"><T k={`format.ways.${o.key}.body`}>{o.desc}</T></p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 32, fontSize: 15.5, lineHeight: 1.7, color: "var(--rw-prose)", maxWidth: 640 }}>
          <T k="format.ways.note">
            Every format follows the same song-based curriculum — the difference is who&apos;s in the room with you.
            Most students start one-on-one and move into a Rock Band once they&apos;re ready to play with others.
          </T>
        </p>

        <h2 className="rw-subhead"><T k="format.membership.heading">Membership</T></h2>
        {/* The number is the loudest thing on a pricing page. It was 30px in
            the display face — the same weight this page gave its section
            headings — so nothing on the page said "this is what it costs". */}
        <div className="rw-tags rw-tags-2">
          {PRICING.map((p) => (
            <div key={p.name} className="rw-tag" style={{ display: "flex", flexDirection: "column" }}>
              <h3 className="rw-tag-title"><T k={`format.plan.${p.key}.name`}>{p.name}</T></h3>
              <div className="rw-price">
                <span className="rw-price-figure">{p.price}</span>
                <span className="rw-price-per">{p.per}</span>
              </div>
              <p className="rw-tag-body"><T k={`format.plan.${p.key}.body`}>{p.desc}</T></p>
              {/* This page had no control in <main> at all: a visitor who had
                  just read the price had nothing to press. The plan itself is
                  picked at payment, so both cards start the same signup. */}
              <div style={{ marginTop: "auto", paddingTop: 22 }}>
                <Button href="/signup"><T k="format.plan.join">Join the member area</T></Button>
              </div>
            </div>
          ))}
        </div>
        {/* Said plainly because the formats above carry no price and the only
            prices on the page belong to a different thing. */}
        <p style={{ marginTop: 24, fontSize: 15.5, lineHeight: 1.7, color: "var(--rw-prose)", maxWidth: 640 }}>
          <T k="format.membership.note">
            Membership is the online member area: lesson videos, the song library and the practice tools.
            Lessons at the school are a separate arrangement &mdash; times and fees are agreed with us
            directly, usually at your free trial.
          </T>
        </p>
        <div style={{ marginTop: 20 }}>
          <Button href="/trial" variant="quiet">
            <T k="format.trial">Book a free trial &rarr;</T>
          </Button>
        </div>
      </div>
    </div>
  );
}
