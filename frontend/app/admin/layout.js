"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ROLES } from "@/lib/auth/roles";

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
  const pathname = usePathname();

  return (
    <ProtectedRoute allow={[ROLES.ADMINISTRATOR]}>
      <div className="rw-admin-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 100px", display: "flex", gap: 32 }}>
        <nav className="rw-admin-nav" style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 14 }}>
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
                color: pathname === item.href ? "#fff" : "var(--rw-prose)",
                background: pathname === item.href ? "var(--rw-ink)" : "transparent",
                textDecoration: "none",
                marginBottom: 2,
              }}
            >
              {item.label}
            </Link>
          ))}

          <div style={{ borderTop: "1px solid var(--rw-border)", margin: "16px 0 10px" }} />
          <Link
            href="/member"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "9px 12px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--rw-teal)",
              textDecoration: "none",
            }}
          >
            View Student Dashboard &rarr;
          </Link>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </ProtectedRoute>
  );
}
