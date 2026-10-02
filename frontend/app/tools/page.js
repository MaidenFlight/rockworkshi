import Link from "next/link";
import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";

const TOOLS = [
  { title: "Metronome", desc: "A steady click at any tempo, with tap tempo.", emoji: "⏱️", bg: "var(--rw-orange-tint)", href: "/tools/metronome" },
  { title: "Tuner", desc: "Mic-based tuning plus plucked reference tones.", emoji: "\u{1F3B8}", bg: "#e6f0fb", href: "/tools/tuner" },
  { title: "Chord Library", desc: "Real fingerings for guitar, ukulele, bass, and piano.", emoji: "\u{1F4D6}", bg: "#fdf3d9", href: "/tools/chords" },
  { title: "Piano", desc: "A two-octave, polyphonic on-screen keyboard.", emoji: "\u{1F3B9}", bg: "#e3f3ea", href: "/tools/piano" },
  { title: "Rhythm Trainer", desc: "Clap or play along with a count-in and highlighted beats.", emoji: "\u{1F941}", bg: "#f3e6da", href: "/tools/rhythm" },
];

export default function ToolsHub() {
  return (
    <div>
      <EditorialHero
        eyebrow={<T k="tools.hero.eyebrow">Practice</T>}
        title={<T k="tools.hero.title">Music Tools</T>}
        intro={<T k="tools.hero.intro">Free practice tools for students and anyone dropping by — no sign-in required.</T>}
      />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 100px" }}>
        <div className="rw-cols-2" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18, marginBottom: 20 }}>
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rw-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: "var(--rw-surface)",
                border: "1px solid var(--rw-border)",
                borderRadius: 14,
                padding: "22px 24px",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: t.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                {t.emoji}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "var(--rw-ink)" }}><T k={`tools.${t.href.split("/").pop()}.title`}>{t.title}</T></div>
                <div style={{ fontSize: 14, color: "var(--rw-body)", marginTop: 2 }}><T k={`tools.${t.href.split("/").pop()}.desc`}>{t.desc}</T></div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: 22, background: "var(--rw-sand)", borderRadius: 14 }}>
          <Link href="/trial" style={{ fontSize: 14, fontWeight: 700, color: "var(--rw-orange-deep)", textDecoration: "none" }}>
            <T k="tools.links.trial">Book a Trial</T>
          </Link>
          <span style={{ color: "var(--rw-line)" }}>&middot;</span>
          <Link href="/program/curriculum" style={{ fontSize: 14, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}>
            <T k="tools.links.curriculum">See the Curriculum</T>
          </Link>
          <span style={{ color: "var(--rw-line)" }}>&middot;</span>
          <Link href="/signin" style={{ fontSize: 14, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}>
            <T k="tools.links.signin">Student Sign In</T>
          </Link>
        </div>
      </div>
    </div>
  );
}
