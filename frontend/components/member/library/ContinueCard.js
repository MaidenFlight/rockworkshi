import { Button } from "@/components/ui";
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
        padding: "16px 20px",
        background: "var(--rw-surface)",
        border: "1px solid var(--rw-border)",
        borderRadius: "var(--rw-radius-md)",
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h2 style={{ margin: 0, fontWeight: 800, fontSize: "var(--rw-text-2xl)", lineHeight: 1.05, textTransform: "uppercase", color: "var(--rw-ink)" }}>
          {song.title}
        </h2>
        <div style={{ fontSize: 13.5, color: "var(--rw-meta)", marginTop: 2 }}>
          {[
            "Continue practising",
            song.artist,
            song.hasTracks && position ? `left off at ${formatClock(position)}` : null,
            `opened ${formatWhen(lastOpenedAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <Button href={`/member/song/${song.id}`}>
        Continue
      </Button>
    </section>
  );
}
