"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The tabs across the top of a workspace (Teacher Studio, the family area). A tab is current on
// its own page and on the pages under it.
export default function SectionTabs({ tabs, label }) {
  const pathname = usePathname();
  const owns = (t) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)) || (t.also || []).some((p) => pathname.startsWith(p));
  const current = [...tabs].sort((a, b) => b.href.length - a.href.length).find(owns);
  return (
    <nav aria-label={label} className="rw-st-tabs">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="rw-st-tab" aria-current={current?.href === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
