import Link from "next/link";
import EditorialHero from "@/components/EditorialHero";

const STEPS = [
  {
    n: 1,
    title: "Pick a real song",
    desc: "Every student starts with a real, complete song matched to their instrument and level — never a generic exercise book.",
  },
  {
    n: 2,
    title: "Learn it in five levels",
    desc: "Sing-a-long, chords, scales & fills, melody, then improv. Each level builds on the last until the song is truly yours.",
  },
  {
    n: 3,
    title: "Practice with the right tools",
    desc: "Between lessons, students use the member portal's metronome, tuner, and chord library to practice with a video player built around the song.",
  },
  {
    n: 4,
    title: "Perform it live",
    desc: "Finished songs are a student's ticket to the Rock Works stage — solo, or with a full band behind them.",
  },
];

export default function HowItWorks() {
  return (
    <div>
      <EditorialHero
        eyebrow="Lessons"
        title="How It Works"
        intro="One weekly lesson, one real song, five levels — practiced, performed, then repeated with the next song."
      />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 100px" }}>
        {STEPS.map((s) => (
          <div key={s.n} style={{ display: "flex", gap: 18, padding: "20px 0", borderBottom: "1px solid var(--rw-border)" }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg,var(--rw-teal),var(--rw-ink))",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {s.n}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--rw-ink)" }}>{s.title}</div>
              <p style={{ margin: "5px 0 0", fontSize: 15, color: "var(--rw-body-cool)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 32 }}>
          <Link href="/program/curriculum" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}>
            See the full curriculum &rarr;
          </Link>
          <Link href="/program/format" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}>
            See formats &amp; pricing &rarr;
          </Link>
          <Link href="/tools" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}>
            Try the practice tools &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
