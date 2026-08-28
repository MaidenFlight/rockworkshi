import Link from "next/link";
import { notFound } from "next/navigation";
import { programs } from "@/lib/content";
import { PageHero, Container, Button } from "@/components/ui";

export function generateStaticParams() {
  return programs.map((p) => ({ slug: p.slug }));
}

// This page was still the previous world after the redesign because it never
// used the shared page header — it hand-rolled its own banner, so fixing
// PageHero fixed eighteen routes and missed this one.
//
// What it had instead was a 16:6 gradient box with the program's title set at
// 14px, centred, floating in the middle of it. That is a photograph's slot with
// no photograph in it, and the school has none (PRODUCT.md, Evidence on Hand).
// An empty frame captioned with the thing it is failing to show reads worse
// than no frame at all, so it is gone rather than restyled — the same call the
// homepage hero made about /band.svg. The header carries the title now, at the
// scale the rest of the site gives a page title.
export default async function ProgramDetail({ params }) {
  const { slug } = await params;
  const program = programs.find((p) => p.slug === slug);
  if (!program) notFound();

  return (
    <div>
      <PageHero eyebrow="Programs" title={program.title} lead={program.desc} />

      <Container style={{ padding: "48px 24px 100px" }}>
        <Link href="/community/programs" className="rw-backlink">
          &larr; All programs
        </Link>

        <div className="rw-featured-grid rw-detail-grid">
          <div>
            <h2 className="rw-subhead rw-subhead-flush">How it works</h2>
            <p className="rw-detail-method">{program.method}</p>

            {/* Was a teal circle with a check glyph per row — a Unicode mark
                standing in for an icon, which the system's own drawn marks
                make unnecessary. A flare rule down the left of each row does
                the same job in the world's own vocabulary. */}
            <ul className="rw-spec">
              {program.structureItems.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>

            <p className="rw-detail-progress">
              <b>Expected progress.</b> {program.progress}
            </p>
          </div>

          <aside className="rw-tag rw-detail-aside">
            <dl className="rw-facts">
              <dt>Who it&apos;s for</dt>
              <dd>{program.forWho}</dd>
              <dt>Instruments</dt>
              <dd>{program.instruments}</dd>
              <dt>Format</dt>
              <dd>{program.format}</dd>
            </dl>
            <Button href="/contact" className="rw-detail-cta">
              {program.ctaLabel} &rarr;
            </Button>
            <Link href="/program/format" className="rw-tag-cta rw-detail-alt">
              See format &amp; pricing
            </Link>
          </aside>
        </div>
      </Container>
    </div>
  );
}
