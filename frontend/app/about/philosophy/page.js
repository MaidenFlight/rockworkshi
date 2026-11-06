import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";
import { Prose } from "@/components/ui";

export default function Philosophy() {
  return (
    <div>
      <EditorialHero
        title={<T k="philosophy.hero.title">Our Philosophy</T>}
        intro={<T k="philosophy.hero.intro">We believe every student should be playing real music from their very first lesson — not drills, not exercises, songs.</T>}
      />
      <Prose style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 100px" }}>
        <p>
          <T k="philosophy.p1">
            Most music programs start with theory and scales, and hope the songs come later. We flip that. Every
            student learns their instrument through a song they actually want to play — chords first, technique
            along the way, mastery by the end.
          </T>
        </p>
        <p>
          <T k="philosophy.p2">
            That doesn&apos;t mean we skip the fundamentals. Each song is taught across five levels — sing-a-long,
            chords, scales &amp; fills, melody, and improv — so by the time a student has finished a song, they
            understand it inside and out, not just how to play along.
          </T>
        </p>
        <p>
          <T k="philosophy.p3">
            And we believe music is better together. Whether it&apos;s a one-on-one lesson or a full Rock Band with
            friends, our students are always building toward playing in front of people — because that&apos;s where
            music actually comes alive.
          </T>
        </p>
      </Prose>
    </div>
  );
}
