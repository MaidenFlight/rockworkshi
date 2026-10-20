import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";
import { Container, Button } from "@/components/ui";
import { songLevels as LEVELS } from "@/lib/content";

export default function Curriculum() {
  return (
    <div>
      <EditorialHero
        eyebrow={<T k="curriculum.hero.eyebrow">Program</T>}
        title={<T k="curriculum.hero.title">Curriculum</T>}
        intro={<T k="curriculum.hero.intro">One song a month, taught in five levels, across a ten-year path.</T>}
      />

      <Container width="text" style={{ padding: "56px 24px 40px" }}>
        <ol className="rw-track">
          {LEVELS.map((lv) => (
            <li key={lv.n} className="rw-track-row">
              <span className="rw-track-n">{lv.n}</span>
              <div className="rw-track-body">
                <h2 className="rw-track-name"><T k={`levels.${lv.n}.name`}>{lv.name}</T></h2>
                <p className="rw-track-desc"><T k={`levels.${lv.n}.desc`}>{lv.desc}</T></p>
              </div>
            </li>
          ))}
        </ol>
      </Container>

      <section className="rw-band">
        <Container width="text" style={{ padding: "40px 24px 48px" }}>
          <div className="rw-band-label"><T k="curriculum.band.label">Start the first song</T></div>
          <p className="rw-band-copy">
            <T k="curriculum.band.copy">
              Lessons at the school are arranged with us and the trial is where that starts. Membership opens
              the lesson videos and practice tools for every level above.
            </T>
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <Button href="/trial"><T k="cta.trial.plain">Book a free trial</T></Button>
            <Button href="/signup" variant="quiet" onDark>
              <T k="cta.join.arrow">Join the member area &rarr;</T>
            </Button>
          </div>
        </Container>
      </section>
    </div>
  );
}
