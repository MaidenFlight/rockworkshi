import Link from "next/link";
import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";
import { programs } from "@/lib/content";

export default function SpecialPrograms() {
  return (
    <div>
      <EditorialHero eyebrow={<T k="programs.hero.eyebrow">Community</T>} title={<T k="programs.hero.title">Special Programs</T>} intro={<T k="programs.hero.intro">Beyond weekly lessons — ways to go deeper.</T>} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 100px" }}>
        <div className="rw-tags rw-tags-3">
          {programs.map((p) => (
            <Link key={p.slug} href={`/community/programs/${p.slug}`} className="rw-tag rw-tag-link">
              <h3 className="rw-tag-title"><T k={`programs.${p.slug}.title`}>{p.title}</T></h3>
              <p className="rw-tag-body"><T k={`programs.${p.slug}.desc`}>{p.desc}</T></p>
              <span className="rw-tag-cta"><T k="programs.learnmore">Learn more &rarr;</T></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
