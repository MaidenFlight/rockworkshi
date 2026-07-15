"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/useSession";

const NAV = [
  { label: "Overview", href: "/admin" },
  { label: "Students", href: "/admin/students" },
  { label: "Trial Requests", href: "/admin/trials" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Teachers", href: "/admin/teachers" },
  { label: "FAQs", href: "/admin/faqs" },
  { label: "Song Library", href: "/admin/songs" },
  { label: "On Stage", href: "/admin/onstage" },
  { label: "Lessons", href: "/admin/lessons" },
  { label: "Pages", href: "/admin/pages" },
  { label: "Resources", href: "/admin/resources" },
  { label: "Media", href: "/admin/media" },
];

export default function AdminLayout({ children }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/signin");
    else if (!user.isAdmin) router.replace("/member");
  }, [loading, user, router]);

  if (loading || !user || !user.isAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: "100px auto", textAlign: "center", color: "#6a6560" }}>
        Checking access…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 100px", display: "flex", gap: 32 }}>
      <nav style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 14 }}>
          Admin
        </div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "block",
              padding: "9px 12px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: pathname === item.href ? "#fff" : "#33454f",
              background: pathname === item.href ? "#0a2338" : "transparent",
              textDecoration: "none",
              marginBottom: 2,
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
