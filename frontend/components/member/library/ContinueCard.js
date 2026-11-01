import Link from "next/link";
import { formatClock, formatWhen } from "@/lib/practice";

// The most recently opened song. The player reopens it where it was left, paused.
export default function ContinueCard({ item }) {
  if (!item) return null;
  const { song, position, lastOpenedAt } = item;
  return (
    <section
      aria-label="Continue practising"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "18px 20px",
        background: "var(--rw-surface)",
        border: "1px solid var(--rw-border)",
        borderLeft: "4px solid var(--rw-orange)",
        borderRadius: 14,
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)" }}>
          Continue practising
        </div>
        <div style={{ fontWeight: 700, fontSize: 18, color: "var(--rw-ink)", marginTop: 4 }}>{song.title}</div>
        <div style={{ fontSize: 13.5, color: "var(--rw-meta)" }}>
          {[song.artist, `opened ${formatWhen(lastOpenedAt)}`].filter(Boolean).join(" · ")}
          {song.hasTracks && position ? ` · left off at ${formatClock(position)}` : ""}
        </div>
      </div>
      <Link
        href={`/member/song/${song.id}`}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          background: "var(--rw-orange)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Continue
      </Link>
    </section>
  );
}
