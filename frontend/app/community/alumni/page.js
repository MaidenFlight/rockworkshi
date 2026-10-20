import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";
import { Container, Button } from "@/components/ui";

export default function Alumni() {
  return (
    <div>
      <EditorialHero
        eyebrow={<T k="alumni.hero.eyebrow">Community</T>}
        title={<T k="alumni.hero.title">Alumni</T>}
        intro={<T k="alumni.hero.intro">Rock Works students go on to keep playing — in bands, on stages, and for life.</T>}
      />

      <Container width="text" style={{ padding: "64px 24px 90px" }}>
        <div className="rw-empty">
          <p className="rw-empty-lead"><T k="alumni.empty.lead">This page is waiting on its people.</T></p>
          <p className="rw-empty-body">
            <T k="alumni.empty.p1">
              The school has been teaching in Honolulu since 1982, which is a lot of players to lose track
              of. We are collecting alumni stories rather than writing them, so there is nothing here yet
              and nothing invented in the meantime.
            </T>
          </p>
          <p className="rw-empty-body">
            <T k="alumni.empty.p2">
              If you studied here — last year or in the eighties — we would like to hear where the playing
              took you.
            </T>
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <Button href="/contact"><T k="alumni.cta.story">Tell us your story</T></Button>
            <Button href="/on-stage" variant="quiet">
              <T k="alumni.cta.onstage">See students on stage &rarr;</T>
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
