import EditorialHero from "@/components/EditorialHero";

const OPTIONS = [
  { title: "One-on-one", desc: "Weekly private lessons, paced entirely around one student." },
  { title: "Rock Band", desc: "Small groups of students learn the same song together and perform it as a band." },
  { title: "Family & friends", desc: "Siblings or friends can share a lesson slot and learn side by side." },
];

// Membership pricing only — what it costs to have access to the member area.
// Lesson fees are arranged with the school and deliberately aren't quoted here.
const PRICING = [
  { name: "Monthly", price: "$55", per: "/ month", desc: "Full access to every lesson, the song library, and the practice tools. Cancel any time." },
  { name: "Term", price: "$135", per: "/ 3 months", desc: "The same access, paid up front for a full term. Works out at $45 a month." },
];

export default function Format() {
  return (
    <div>
      <EditorialHero eyebrow="Program" title="Format & Pricing" intro="Choose how you want to learn — solo, with friends, or in a band — and what it costs." />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px 100px" }}>
        {/* Was three equal rounded cards — the arrangement six inner pages
            shared and the one the homepage threw out. They are tags now: the
            flare rule across the top is what makes the row read as one set. */}
        <div className="rw-tags rw-tags-3">
          {OPTIONS.map((o) => (
            <div key={o.title} className="rw-tag">
              <h3 className="rw-tag-title">{o.title}</h3>
              <p className="rw-tag-body">{o.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 32, fontSize: 15.5, lineHeight: 1.7, color: "var(--rw-prose)", maxWidth: 640 }}>
          Every format follows the same song-based curriculum — the difference is who&apos;s in the room with you.
          Most students start one-on-one and move into a Rock Band once they&apos;re ready to play with others.
        </p>

        <h2 className="rw-subhead">Membership</h2>
        {/* The number is the loudest thing on a pricing page. It was 30px in
            the display face — the same weight this page gave its section
            headings — so nothing on the page said "this is what it costs". */}
        <div className="rw-tags rw-tags-2">
          {PRICING.map((p) => (
            <div key={p.name} className="rw-tag">
              <h3 className="rw-tag-title">{p.name}</h3>
              <div className="rw-price">
                <span className="rw-price-figure">{p.price}</span>
                <span className="rw-price-per">{p.per}</span>
              </div>
              <p className="rw-tag-body">{p.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 13.5, color: "var(--rw-meta)" }}>
          Membership covers everything on this site. Lesson times and fees are arranged with the
          school — ask your teacher or mention it at your trial lesson.
        </p>
      </div>
    </div>
  );
}
