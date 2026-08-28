import EditorialHero from "@/components/EditorialHero";
import { Container, Button } from "@/components/ui";

// This page had one centred paragraph saying alumni features are coming. That
// is an empty state that has not admitted it is one: it looks like a page that
// failed to load rather than a page waiting on material.
//
// It is designed as an empty state now, which means it does the one useful
// thing it can — ask the people who would fill it. The school has no confirmed
// alumni stories (PRODUCT.md, Evidence on Hand) and none are invented here; the
// only claim on the page is the one the school can stand behind, that it has
// been teaching in Honolulu since 1982.
export default function Alumni() {
  return (
    <div>
      <EditorialHero
        eyebrow="Community"
        title="Alumni"
        intro="Rock Works students go on to keep playing — in bands, on stages, and for life."
      />

      <Container width="text" style={{ padding: "64px 24px 90px" }}>
        <div className="rw-empty">
          <p className="rw-empty-lead">This page is waiting on its people.</p>
          <p className="rw-empty-body">
            The school has been teaching in Honolulu since 1982, which is a lot of players to lose track
            of. We are collecting alumni stories rather than writing them, so there is nothing here yet
            and nothing invented in the meantime.
          </p>
          <p className="rw-empty-body">
            If you studied here — last year or in the eighties — we would like to hear where the playing
            took you.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <Button href="/contact">Tell us your story</Button>
            <Button href="/on-stage" variant="quiet">
              See students on stage &rarr;
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
