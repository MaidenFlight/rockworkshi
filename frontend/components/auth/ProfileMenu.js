"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardFor } from "@/lib/auth/enrolment";
import { holds } from "@/lib/auth/roles";
import { firstNameOf, initialsOf } from "@/lib/auth/displayName";

const MENU_ITEMS = [
  { label: "Student Dashboard", href: "/member" },
  { label: "Meetings", href: "/meetings" },
  { label: "Notifications", href: "/notifications" },
  { label: "My Profile", href: "/member/profile" },
  { label: "Account Settings", href: "/member/settings" },
];
const TEACHER_ITEM = { label: "Teaching", href: "/teacher" };
const ADMIN_ITEM = { label: "Admin", href: "/admin" };

export default function ProfileMenu() {
  const { user, signOut, leaveDemo } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    if (user?.isDemo) return leaveDemo();
    await signOut();
    router.push("/");
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        className="rw-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${firstNameOf(user)}${user?.isDemo ? ", student demo" : ""}`}
        onClick={() => setOpen((o) => !o)}
        style={triggerStyle}
      >
        <span aria-hidden="true" style={avatarStyle}>
          {initialsOf(user)}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--rw-ink)" }}>{firstNameOf(user)}</span>
        {/* The header stays in view, so the demo stays labelled after its band has scrolled away. */}
        {user?.isDemo && <span className="rw-demo-chip">Student demo</span>}
        <span aria-hidden="true" style={{ display: "inline-flex", color: "var(--rw-prose)" }}>
          <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="butt" style={{ opacity: 0.75, transform: open ? "rotate(180deg)" : undefined }}>
            <path d="M2 4.5l4 4 4-4" />
          </svg>
        </span>
      </button>

      {open && (
        <div role="menu" aria-label="Account menu" style={menuStyle}>
          {/* A student's dashboard is Practice in the header, so it isn't listed again here. */}
          {[...(holds(user, "teacher") ? [TEACHER_ITEM] : []), ...(user?.isAdmin ? [ADMIN_ITEM] : []), ...MENU_ITEMS]
            .filter((item) => item.href !== "/member" || dashboardFor(user) !== "/member")
            .map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" className="rw-menu-item" onClick={() => setOpen(false)} style={menuItemStyle}>
              {item.label}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid var(--rw-border)", margin: "6px 0" }} />
          <button
            type="button"
            role="menuitem"
            className="rw-menu-item"
            onClick={handleSignOut}
            style={{ ...menuItemStyle, width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "var(--rw-orange-deep)" }}
          >
            {user?.isDemo ? "Leave demo" : "Sign Out"}
          </button>
        </div>
      )}
    </div>
  );
}

const triggerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "6px 12px 6px 6px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-border)",
  background: "var(--rw-surface)",
  cursor: "pointer",
};

const avatarStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "linear-gradient(135deg,var(--rw-teal),var(--rw-ink))",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 12.5,
  flexShrink: 0,
};

const menuStyle = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 220,
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
  boxShadow: "0 20px 44px -20px color-mix(in srgb, var(--rw-ink-deep) 40%, transparent)",
  padding: 8,
  zIndex: 80,
};

const menuItemStyle = {
  display: "block",
  padding: "10px 12px",
  borderRadius: "var(--rw-radius-sm)",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--rw-prose)",
  textDecoration: "none",
};
