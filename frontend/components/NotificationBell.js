"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/meetings";

// The header's way into the notification inbox, with how many are unread. Checked on each page and
// every minute.
export default function NotificationBell({ style }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stale = false;
    const check = () => api("/notifications/unread").then((d) => !stale && setUnread(d.unread)).catch(() => {});
    check();
    const timer = setInterval(check, 60000);
    return () => {
      stale = true;
      clearInterval(timer);
    };
  }, [pathname]);

  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link href="/notifications" className="rw-nav-link" aria-label={label} title={label} style={{ ...style, position: "relative", display: "inline-flex", alignItems: "center" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 8,
            background: "var(--rw-orange-deep)",
            color: "var(--rw-cream)",
            fontSize: 10,
            fontWeight: 800,
            lineHeight: "16px",
            textAlign: "center",
          }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
