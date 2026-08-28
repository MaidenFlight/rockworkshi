"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { primaryNav } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import ProfileMenu from "@/components/auth/ProfileMenu";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/auth/roles";
import { firstNameOf, initialsOf } from "@/lib/auth/displayName";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);

  const dashboardHref = role === ROLES.ADMINISTRATOR ? "/admin" : "/member";

  const isActive = (item) =>
    item.href ? (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) : item.menu?.some((sub) => pathname.startsWith(sub.href));

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    function onKeyDown(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  async function handleMobileSignOut() {
    setMobileOpen(false);
    await signOut();
    router.push("/");
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(251,245,236,0.86)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--rw-border)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "17px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, textDecoration: "none" }}>
          <RockWorksIcon size={38} color="var(--rw-orange)" />
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1,
            }}
          >
            <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 700, fontSize: 25, letterSpacing: "0.01em", color: "var(--rw-ink)" }}>
              Rock Works
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--rw-teal)",
                marginTop: 4,
              }}
            >
              School of Music
            </span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <div className="rw-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {primaryNav.map((item) => (
              <div key={item.label} className="rw-navgroup" style={{ position: "relative" }}>
                {item.menu ? (
                  <>
                    <button
                      className="rw-nav-link rw-navtrigger"
                      aria-haspopup="true"
                      style={isActive(item) ? activeNavLinkStyle : navLinkStyle}
                    >
                      {item.label} <span style={{ fontSize: 9, opacity: 0.7 }}>&#9662;</span>
                    </button>
                    <div
                      className="rw-dropdown"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        minWidth: 210,
                        background: "var(--rw-surface)",
                        border: "1px solid var(--rw-border)",
                        borderRadius: "var(--rw-radius-md)",
                        boxShadow: "0 18px 40px -20px rgba(6,25,45,0.4)",
                        padding: 8,
                        marginTop: 6,
                      }}
                    >
                      {item.menu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="rw-dropitem"
                          style={{ display: "block", padding: "10px 12px", borderRadius: 7, fontSize: 14, fontWeight: 600, color: "var(--rw-prose)", textDecoration: "none" }}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link href={item.href} className="rw-nav-link" style={isActive(item) ? activeNavLinkStyle : navLinkStyle}>
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <span className="rw-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            {isAuthenticated ? (
              <>
                <Link href={dashboardHref} className="rw-nav-link" style={navLinkStyle}>
                  Dashboard
                </Link>
                <ProfileMenu />
              </>
            ) : (
              <>
                <Link href="/signin" className="rw-nav-link" style={navLinkStyle}>
                  Sign In
                </Link>
                <Link href="/signup" className="rw-nav-link" style={navLinkStyle}>
                  Sign Up
                </Link>
                <Link href="/trial" className="rw-cta" style={ctaStyle}>
                  Book a Trial
                </Link>
              </>
            )}
          </span>

          <button
            className="rw-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            style={{ display: "none", background: "transparent", border: "1px solid var(--rw-line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--rw-ink)" }}
          >
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
          </button>
        </nav>
      </div>

      {/* Portalled to <body>: the header's backdrop-filter creates a containing
          block for fixed-position descendants, which would otherwise clip this
          drawer and its overlay to the height of the header itself. */}
      {mobileOpen && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,25,45,0.4)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 71,
              width: "min(86vw,340px)",
              background: "var(--rw-cream)",
              boxShadow: "-20px 0 50px -20px rgba(6,25,45,0.5)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              animation: "rise .22s ease both",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--rw-border)" }}>
              <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 700, fontSize: 19, color: "var(--rw-ink)" }}>Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                style={{ background: "transparent", border: "none", fontSize: 24, color: "var(--rw-ink)", cursor: "pointer", lineHeight: 1 }}
              >
                &#10005;
              </button>
            </div>
            <div style={{ padding: "8px 12px 20px" }}>
              {primaryNav.map((item) => (
                <div key={item.label} style={{ borderBottom: "1px solid #efe4d5" }}>
                  {item.menu ? (
                    <>
                      <button
                        onClick={() => setMobileExpanded(mobileExpanded === item.label ? null : item.label)}
                        aria-expanded={mobileExpanded === item.label}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", fontFamily: "inherit", padding: "15px 8px", fontSize: 16, fontWeight: 700, color: "var(--rw-ink)", cursor: "pointer" }}
                      >
                        {item.label}
                        <span style={{ fontSize: 12, color: "var(--rw-meta)" }}>&#9662;</span>
                      </button>
                      {mobileExpanded === item.label && (
                        <div style={{ padding: "0 8px 12px" }}>
                          {item.menu.map((sub) => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => setMobileOpen(false)}
                              style={{ display: "block", padding: "11px 14px", fontSize: 14.5, fontWeight: 600, color: "var(--rw-prose)", textDecoration: "none", borderLeft: "2px solid var(--rw-rule)" }}
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      style={{ display: "block", padding: "15px 8px", fontSize: 16, fontWeight: 700, color: "var(--rw-ink)", textDecoration: "none" }}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
              {isAuthenticated ? (
                <div style={{ marginTop: 20, padding: "14px 8px 0", borderTop: "1px solid var(--rw-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,var(--rw-teal),var(--rw-ink))",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 14.5,
                        flexShrink: 0,
                      }}
                    >
                      {initialsOf(user)}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: "var(--rw-ink)" }}>{firstNameOf(user)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <Link href={dashboardHref} onClick={() => setMobileOpen(false)} style={mobileMenuLinkStyle}>
                      Dashboard
                    </Link>
                    <Link href="/member" onClick={() => setMobileOpen(false)} style={mobileMenuLinkStyle}>
                      Student Dashboard
                    </Link>
                    <Link href="/member/profile" onClick={() => setMobileOpen(false)} style={mobileMenuLinkStyle}>
                      My Profile
                    </Link>
                    <Link href="/member/settings" onClick={() => setMobileOpen(false)} style={mobileMenuLinkStyle}>
                      Account Settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleMobileSignOut}
                      style={{ ...mobileMenuLinkStyle, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "var(--rw-orange-deep)", fontFamily: "inherit" }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20, padding: "0 8px" }}>
                  <Link
                    href="/signin"
                    onClick={() => setMobileOpen(false)}
                    style={{ textAlign: "center", padding: 12, borderRadius: 8, border: "1px solid var(--rw-line)", fontWeight: 600, fontSize: 15, color: "var(--rw-prose)", textDecoration: "none" }}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    style={{ textAlign: "center", padding: 12, borderRadius: 8, border: "1px solid var(--rw-line)", fontWeight: 600, fontSize: 15, color: "var(--rw-prose)", textDecoration: "none" }}
                  >
                    Sign Up
                  </Link>
                  <Link
                    href="/trial"
                    onClick={() => setMobileOpen(false)}
                    style={{ textAlign: "center", padding: 13, borderRadius: 8, background: "var(--rw-orange)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
                  >
                    Book a Trial
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </header>
  );
}

const navLinkStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 14.5,
  fontWeight: 600,
  color: "var(--rw-prose)",
  textDecoration: "none",
  cursor: "pointer",
};

// The active link is orange TEXT, not an orange surface, so it takes the text
// orange. On the nav's translucent cream, --rw-orange measures 4.46:1 at
// 14.5px — under the 4.5 floor by a hair, and this is the one nav item a
// reader is meant to find. --rw-orange-deep is 5.45:1 there. The underline goes
// with it: two oranges a few units apart, stacked, reads as a mistake rather
// than as a pair.
const activeNavLinkStyle = {
  ...navLinkStyle,
  color: "var(--rw-orange-deep)",
  boxShadow: "inset 0 -2px 0 var(--rw-orange-deep)",
};

const mobileMenuLinkStyle = {
  display: "block",
  padding: "11px 8px",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--rw-prose)",
  textDecoration: "none",
};

const ctaStyle = {
  padding: "10px 18px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14.5,
  color: "#fff",
  background: "var(--rw-orange)",
  textDecoration: "none",
  cursor: "pointer",
};
