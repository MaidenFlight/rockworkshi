import Link from "next/link";

// The term at a glance, at the foot of the dashboard's side column: which month it is and what each
// month holds. `data` is GET /term, which never sends a song title before it's open. This month's song
// is played from the practice panel, so here it's a row like the others. The student demo has no lesson
// videos, so its membership line leaves them out.
export default function YourTerm({ data, demo = false }) {
  // Loading, failed or lapsed: the practice panel already says what to do.
  if (!data || data.membership !== "active") return null;
  const { term } = data;

  if (term.state === "none") {
    return (
      <section className="rw-st-card" aria-labelledby="your-term">
        <h2 id="your-term">Your membership</h2>
        <p style={text}>It opens the library{demo ? "" : ", lesson videos"} and practice tools. Lessons at the school are arranged separately.</p>
        <Link href="/trial" className="rw-dash-link" style={link}>
          Ask about lessons
        </Link>
      </section>
    );
  }

  return (
    <section className="rw-st-card" aria-labelledby="your-term">
      <h2 id="your-term">Your term</h2>
      <p style={{ ...text, color: "var(--rw-meta)", fontSize: "var(--rw-text-sm)" }}>
        {term.group.name} ·{" "}
        {term.state === "ended" ? "finished" : term.state === "upcoming" ? `starts ${term.group.startShort}` : `month ${term.currentMonth} of 3`}
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {term.slots.map((s) => {
          const now = s.month === term.currentMonth;
          return (
            <li key={s.month} style={row} aria-current={now ? "step" : undefined}>
              <span style={{ fontWeight: 700, color: "var(--rw-ink)", width: 72, flexShrink: 0 }}>Month {s.month}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {s.state === "available" ? (
                  <Link href={`/member/song/${s.song.id}`} className="rw-dash-link" style={link}>
                    {s.song.title}
                  </Link>
                ) : s.state === "preparing" ? (
                  "Being prepared"
                ) : (
                  `Unlocks ${s.unlockShort}`
                )}
              </span>
              {now && <span className="rw-st-chip">Now</span>}
            </li>
          );
        })}
      </ol>

      {term.earlier?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: "var(--rw-text-sm)", fontWeight: 700, color: "var(--rw-ink)", marginBottom: 4 }}>Earlier terms</div>
          {term.earlier.map((g) => (
            <div key={g.id} style={{ fontSize: "var(--rw-text-sm)", color: "var(--rw-body)" }}>
              {g.name}:{" "}
              {g.songs.map((s, i) => (
                <span key={s.month}>
                  {i > 0 && ", "}
                  <Link href={`/member/song/${s.song.id}`} style={link}>
                    {s.song.title}
                  </Link>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const text = { color: "var(--rw-body)", fontSize: "var(--rw-text-base)", lineHeight: 1.6, margin: "0 0 10px" };
const link = { color: "var(--rw-orange-deep)", fontWeight: 700 };
const row = { display: "flex", gap: 10, alignItems: "center", minHeight: 44, padding: "4px 0", borderTop: "1px solid var(--rw-border)", fontSize: "var(--rw-text-sm)", color: "var(--rw-body)" };
