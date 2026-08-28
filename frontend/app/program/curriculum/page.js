import EditorialHero from "@/components/EditorialHero";
import { Container, Button } from "@/components/ui";
import { songLevels as LEVELS } from "@/lib/content";

// The five levels are the school's one genuinely uncopyable thing, and this is
// the page devoted to them — yet it rendered them smaller than the homepage
// does: 32px grey circles in a hairline list, against the homepage's 92px gold
// numerals. The dedicated page was the weakest statement of the school's best
// argument.
//
// It is a tracklist now, which is what a five-part sequence is in this world:
// numbered, tight, one line each, read top to bottom. The homepage teases the
// five; this is the record's own back cover.
export default function Curriculum() {
  return (
    <div>
      <EditorialHero
        eyebrow="Program"
        title="Curriculum"
        intro="One song a month, taught in five levels, across a ten-year path."
      />

      <Container width="text" style={{ padding: "56px 24px 40px" }}>
        <ol className="rw-track">
          {LEVELS.map((lv) => (
            <li key={lv.n} className="rw-track-row">
              <span className="rw-track-n">{lv.n}</span>
              <div className="rw-track-body">
                <h2 className="rw-track-name">{lv.name}</h2>
                <p className="rw-track-desc">{lv.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>

      {/* The page stated the method and then stopped, on a site whose whole
          job is to get someone into a room. Both products are named here for
          the same reason they are named on the homepage: a reader who has just
          understood the method is exactly the reader ready to act on it. */}
      <section className="rw-band">
        <Container width="text" style={{ padding: "40px 24px 48px" }}>
          <div className="rw-band-label">Start the first song</div>
          <p className="rw-band-copy">
            Lessons at the school are arranged with us and the trial is where that starts. Membership opens
            the lesson videos and practice tools for every level above.
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <Button href="/trial">Book a free trial</Button>
            <Button href="/signup" variant="quiet" onDark>
              Join the member area &rarr;
            </Button>
          </div>
        </Container>
      </section>
    </div>
  );
}
