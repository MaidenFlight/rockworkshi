import EditorialHero from "@/components/EditorialHero";

const OPTIONS = [
  { title: "One-on-one", desc: "Weekly private lessons, paced entirely around one student." },
  { title: "Rock Band", desc: "Small groups of students learn the same song together and perform it as a band." },
  { title: "Family & friends", desc: "Siblings or friends can share a lesson slot and learn side by side." },
];

export default function Format() {
  return (
    <div>
      <EditorialHero eyebrow="Program" title="Format" intro="Choose how you want to learn — solo, with friends, or in a band." />
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
      </div>
    </div>
  );
}
