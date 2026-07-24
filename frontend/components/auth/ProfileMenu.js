"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { firstNameOf, initialsOf } from "@/lib/auth/displayName";

const MENU_ITEMS = [
  { label: "Student Dashboard", href: "/member" },
  { label: "My Profile", href: "/member/profile" },
  { label: "Account Settings", href: "/member/settings" },
];

export default function ProfileMenu() {
  const { user, signOut } = useAuth();
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
        aria-label={`Account menu for ${firstNameOf(user)}`}
        onClick={() => setOpen((o) => !o)}
        style={triggerStyle}
      >
        <span aria-hidden="true" style={avatarStyle}>
          {initialsOf(user)}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#0a2338" }}>{firstNameOf(user)}</span>
        <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.7, color: "#33454f" }}>
          &#9662;
        </span>
      </button>

      {open && (
        <div role="menu" aria-label="Account menu" style={menuStyle}>
          {MENU_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" className="rw-menu-item" onClick={() => setOpen(false)} style={menuItemStyle}>
              {item.label}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid #ece0d5", margin: "6px 0" }} />
          <button
            type="button"
            role="menuitem"
            className="rw-menu-item"
            onClick={handleSignOut}
            style={{ ...menuItemStyle, width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#cf3f20" }}
          >
            Sign Out
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
  borderRadius: 999,
  border: "1px solid #ece0d5",
  background: "#fffdf9",
  cursor: "pointer",
};

const avatarStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#0e8a97,#0a2338)",
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
  background: "#fffdf9",
  border: "1px solid #ece0d5",
  borderRadius: 12,
  boxShadow: "0 20px 44px -20px rgba(6,25,45,0.4)",
  padding: 8,
  zIndex: 80,
};

const menuItemStyle = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  color: "#33454f",
  textDecoration: "none",
};
