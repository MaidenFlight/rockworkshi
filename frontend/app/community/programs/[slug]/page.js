import Link from "next/link";
import { notFound } from "next/navigation";
import { programs } from "@/lib/content";
import { PageHero, Container, Button } from "@/components/ui";
import T from "@/components/T";

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
      <PageHero
        eyebrow={<T k="program.hero.eyebrow">Programs</T>}
        title={<T k={`programs.${slug}.title`}>{program.title}</T>}
        lead={<T k={`programs.${slug}.desc`}>{program.desc}</T>}
      />

      <Container style={{ padding: "48px 24px 100px" }}>
        <Link href="/community/programs" className="rw-backlink">
          <T k="program.back">&larr; All programs</T>
        </Link>

        <div className="rw-featured-grid rw-detail-grid">
          <div>
            <h2 className="rw-subhead rw-subhead-flush"><T k="program.how">How it works</T></h2>
            <p className="rw-detail-method"><T k={`programs.${slug}.method`}>{program.method}</T></p>

            {/* Was a teal circle with a check glyph per row — a Unicode mark
                standing in for an icon, which the system's own drawn marks
                make unnecessary. A flare rule down the left of each row does
                the same job in the world's own vocabulary. */}
            <ul className="rw-spec">
              {program.structureItems.map((it, i) => (
                <li key={it}>
                  <T k={`programs.${slug}.structure${i + 1}`}>{it}</T>
                </li>
              ))}
            </ul>

            <p className="rw-detail-progress">
              <b><T k="program.progress">Expected progress.</T></b> <T k={`programs.${slug}.progress`}>{program.progress}</T>
            </p>
          </div>

          <aside className="rw-tag rw-detail-aside">
            <dl className="rw-facts">
              <dt><T k="program.facts.who">Who it&apos;s for</T></dt>
              <dd><T k={`programs.${slug}.forWho`}>{program.forWho}</T></dd>
              <dt><T k="program.facts.instruments">Instruments</T></dt>
              <dd><T k={`programs.${slug}.instruments`}>{program.instruments}</T></dd>
              <dt><T k="program.facts.format">Format</T></dt>
              <dd><T k={`programs.${slug}.format`}>{program.format}</T></dd>
            </dl>
            <Button href="/contact" className="rw-detail-cta">
              <T k={`programs.${slug}.cta`}>{program.ctaLabel}</T> &rarr;
            </Button>
            <Link href="/program/format" className="rw-tag-cta rw-detail-alt">
              <T k="program.formatlink">See format &amp; pricing</T>
            </Link>
          </aside>
        </div>
      </Container>
    </div>
  );
}
