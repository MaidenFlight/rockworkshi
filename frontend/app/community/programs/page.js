import Link from "next/link";
import EditorialHero from "@/components/EditorialHero";
import { programs } from "@/lib/content";

export default function SpecialPrograms() {
  return (
    <div>
      <EditorialHero eyebrow="Community" title="Special Programs" intro="Beyond weekly lessons — ways to go deeper." />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 100px" }}>
        <div className="rw-tags rw-tags-3">
          {programs.map((p) => (
            <Link key={p.slug} href={`/community/programs/${p.slug}`} className="rw-tag rw-tag-link">
              <h3 className="rw-tag-title">{p.title}</h3>
              <p className="rw-tag-body">{p.desc}</p>
              <span className="rw-tag-cta">Learn more &rarr;</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
