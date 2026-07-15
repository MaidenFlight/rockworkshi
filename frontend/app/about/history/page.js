import EditorialHero from "@/components/EditorialHero";

const TIMELINE = [
  { year: "1982", text: "Rock Works opens its doors in Honolulu with a handful of guitar students." },
  { year: "1996", text: "The ten-year, song-based curriculum is formalized across all instruments." },
  { year: "2008", text: "Rock Band lessons launch, giving students a real stage to play toward." },
  { year: "2026", text: "Thousands of students later, Rock Works keeps teaching one real song at a time." },
];

export default function History() {
  return (
    <div>
      <EditorialHero eyebrow="About" title="History" intro="Four decades of teaching real songs to real people in Honolulu." />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 100px" }}>
        <div className="rw-timeline" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
          {TIMELINE.map((item) => (
            <div key={item.year} style={{ borderTop: "2px solid #ef5130", paddingTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 20, color: "#0a2338", fontFamily: "var(--font-zilla-slab), serif" }}>
                {item.year}
              </div>
              <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: "#6a6560" }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
