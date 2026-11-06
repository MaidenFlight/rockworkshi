import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";

const TIMELINE = [
  { year: "1982", text: "Rock Works opens its doors in Honolulu with a handful of guitar students." },
  { year: "1996", text: "The ten-year, song-based curriculum is formalized across all instruments." },
  { year: "2008", text: "Rock Band lessons launch, giving students a real stage to play toward." },
  { year: "2026", text: "Thousands of students later, Rock Works keeps teaching one real song at a time." },
];

export default function History() {
  return (
    <div>
      <EditorialHero title={<T k="history.hero.title">History</T>} intro={<T k="history.hero.intro">Four decades of teaching real songs to real people in Honolulu.</T>} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 100px" }}>
        {/* Its own class: .rw-timeline belongs to the song player's console. */}
        <ol className="rw-history">
          {TIMELINE.map((item) => (
            <li key={item.year} className="rw-history-step">
              <span className="rw-history-year">{item.year}</span>
              <p className="rw-history-text"><T k={`history.${item.year}`}>{item.text}</T></p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
