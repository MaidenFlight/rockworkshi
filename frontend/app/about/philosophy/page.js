import EditorialHero from "@/components/EditorialHero";

export default function Philosophy() {
  return (
    <div>
      <EditorialHero
        eyebrow="About"
        title="Our Philosophy"
        intro="We believe every student should be playing real music from their very first lesson — not drills, not exercises, songs."
      />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 100px", display: "flex", flexDirection: "column", gap: 28 }}>
        <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "#33454f" }}>
          Most music programs start with theory and scales, and hope the songs come later. We flip that. Every
          student learns their instrument through a song they actually want to play — chords first, technique
          along the way, mastery by the end.
        </p>
        <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "#33454f" }}>
          That doesn&apos;t mean we skip the fundamentals. Each song is taught across five levels — sing-a-long,
          chords, scales &amp; fills, melody, and improv — so by the time a student has finished a song, they
          understand it inside and out, not just how to play along.
        </p>
        <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "#33454f" }}>
          And we believe music is better together. Whether it&apos;s a one-on-one lesson or a full Rock Band with
          friends, our students are always building toward playing in front of people — because that&apos;s where
          music actually comes alive.
        </p>
      </div>
    </div>
  );
}
