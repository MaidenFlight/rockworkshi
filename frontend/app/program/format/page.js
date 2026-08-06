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
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {OPTIONS.map((o) => (
            <div key={o.title} style={{ border: "1px solid #ece0d5", borderRadius: 14, padding: 24, background: "#fffdf9" }}>
              <h3 style={{ fontWeight: 600, fontSize: 19, color: "#0a2338", margin: "0 0 10px" }}>{o.title}</h3>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#6a6560" }}>{o.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 32, fontSize: 15.5, lineHeight: 1.7, color: "#33454f", maxWidth: 640 }}>
          Every format follows the same song-based curriculum — the difference is who&apos;s in the room with you.
          Most students start one-on-one and move into a Rock Band once they&apos;re ready to play with others.
        </p>

        <h2 style={{ fontWeight: 600, fontSize: 22, color: "#0a2338", margin: "56px 0 20px" }}>Membership</h2>
        <div className="rw-cols-2" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }}>
          {PRICING.map((p) => (
            <div key={p.name} style={{ border: "1px solid #ece0d5", borderRadius: 14, padding: 24, background: "#fffdf9" }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, color: "#0a2338", marginBottom: 10 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 700, fontSize: 30, color: "#ef5130" }}>{p.price}</span>
                <span style={{ fontSize: 13.5, color: "#8a7d6a" }}>{p.per}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#6a6560" }}>{p.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 13.5, color: "#8a7d6a" }}>
          Membership covers everything on this site. Lesson times and fees are arranged with the
          school — ask your teacher or mention it at your trial lesson.
        </p>
      </div>
    </div>
  );
}
