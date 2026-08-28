import EditorialHero from "@/components/EditorialHero";
import { Container, Button } from "@/components/ui";

const STEPS = [
  {
    n: 1,
    title: "Pick a real song",
    desc: "Every student starts with a real, complete song matched to their instrument and level — never a generic exercise book.",
  },
  {
    n: 2,
    title: "Learn it in five levels",
    desc: "Sing-a-long, chords, scales & fills, melody, then improv. Each level builds on the last until the song is truly yours.",
  },
  {
    n: 3,
    title: "Practice with the right tools",
    desc: "Between lessons, students use the member portal's metronome, tuner, and chord library to practice with a video player built around the song.",
  },
  {
    n: 4,
    title: "Join a band at six months",
    desc: "Six months on your instrument and you are placed in a Rock Band — four or five players, each on a different part, learning one song together and rehearsing weekly.",
  },
  {
    n: 5,
    title: "Play it in front of people",
    desc: "Bands get the chance to perform on a real stage in Hawaii, and finished songs are a student's ticket to the Rock Works recital.",
  },
];

// This page and /program/curriculum were the same component built twice: a
// numbered circle beside a title and a paragraph, in a hairline list. Two
// pages, one shape, which is the fault the homepage layout pass was written to
// fix and which had simply moved inland.
//
// They are different arguments and now have different forms. Curriculum is a
// tracklist: five parts of one thing, read as a set. This is a path: four
// stages in sequence, where the point is that each one leads to the next, so
// the steps are wide blocks threaded by a rule rather than rows in a list.
export default function HowItWorks() {
  return (
    <div>
      <EditorialHero
        eyebrow="Lessons"
        title="How It Works"
        intro="One weekly lesson, one real song, five levels — and a band of your own at six months."
      />

      <Container style={{ padding: "56px 24px 44px" }}>
        <ol className="rw-path">
          {STEPS.map((s) => (
            <li key={s.n} className="rw-path-step">
              <span className="rw-path-n">{s.n}</span>
              <h2 className="rw-path-title">{s.title}</h2>
              <p className="rw-path-desc">{s.desc}</p>
            </li>
          ))}
        </ol>
      </Container>

      <section className="rw-band">
        <Container style={{ padding: "40px 24px 48px" }}>
          <div className="rw-band-label">Where to next</div>
          <div className="rw-onward">
            <Button href="/program/curriculum" variant="quiet" onDark>
              See the full curriculum &rarr;
            </Button>
            <Button href="/program/format" variant="quiet" onDark>
              See formats &amp; pricing &rarr;
            </Button>
            <Button href="/tools" variant="quiet" onDark>
              Try the practice tools &rarr;
            </Button>
          </div>
        </Container>
      </section>
    </div>
  );
}
