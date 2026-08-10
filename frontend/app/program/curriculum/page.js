import EditorialHero from "@/components/EditorialHero";

const LEVELS = [
  { n: 1, name: "Sing-a-long", desc: "Learn the melody and lyrics by ear — no instrument required yet." },
  { n: 2, name: "Chords", desc: "Play the song's core chord progression in a simple strum or comp pattern." },
  { n: 3, name: "Scales & fills", desc: "Add the scale the song lives in, plus a few signature fills." },
  { n: 4, name: "Melody", desc: "Play the actual vocal or lead melody on your instrument." },
  { n: 5, name: "Improv", desc: "Solo over the changes using everything from the earlier levels." },
];

export default function Curriculum() {
  return (
    <div>
      <EditorialHero
        eyebrow="Program"
        title="Curriculum"
        intro="One song a month, taught in five levels, across a ten-year path."
      />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 100px" }}>
        {LEVELS.map((lv) => (
          <div key={lv.n} style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: "1px solid var(--rw-border)" }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--rw-rule)",
                color: "var(--rw-prose)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {lv.n}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16.5, color: "var(--rw-ink)" }}>{lv.name}</div>
              <p style={{ margin: "4px 0 0", fontSize: 14.5, color: "var(--rw-body)", lineHeight: 1.55 }}>{lv.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
