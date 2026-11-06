"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { primaryNav } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";
import ProfileMenu from "@/components/auth/ProfileMenu";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardFor } from "@/lib/auth/enrolment";
import { firstNameOf, initialsOf } from "@/lib/auth/displayName";

// What a signed-in student sees in the header: practice first, the school's pages in one menu.
const memberNav = [
  { label: "Practice", href: "/member", exact: true, also: ["/member/assignment", "/member/lesson"] },
  { label: "Library", href: "/member/library", also: ["/member/song"] },
  { label: "Tools", href: "/tools" },
  {
    label: "School",
    menu: primaryNav.flatMap((item) => item.menu ?? [{ label: item.label === "Home" ? "Home page" : item.label, href: item.href }]),
  },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);
  const [openGroup, setOpenGroup] = useState(null); // the desktop menu opened by click or keyboard
  const burger = useRef(null);
  const drawer = useRef(null);

  const dashboardHref = dashboardFor(user);
  // A student signed in is here to practise, so the header leads with that and folds the
  // school's own pages into one menu. Teachers, admins and guardians keep the full header.
  const isStudent = isAuthenticated && dashboardHref === "/member";
  const items = isStudent ? memberNav : primaryNav;

  const matches = (href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const isActive = (item) =>
    item.href ? (item.exact ? pathname === item.href || item.also?.some(matches) : matches(item.href) || item.also?.some(matches)) : item.menu?.some((sub) => matches(sub.href));

  useEffect(() => {
    if (!mobileOpen) return;
    const returnTo = burger.current;
    document.body.style.overflow = "hidden";
    // The drawer is a modal dialog: focus goes in, Tab stays in, and focus comes back after.
    drawer.current?.querySelector("button, a")?.focus();
    function onKeyDown(e) {
      if (e.key === "Escape") setMobileOpen(false);
      if (e.key !== "Tab" || !drawer.current) return;
      const stops = [...drawer.current.querySelectorAll("a[href], button:not([disabled])")];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      returnTo?.focus();
    };
  }, [mobileOpen]);

  // A desktop menu closes on Escape (focus back on its button) and when focus leaves it.
  function groupKeys(e, label) {
    if (e.key !== "Escape" || openGroup !== label) return;
    setOpenGroup(null);
    e.currentTarget.querySelector(".rw-navtrigger")?.focus();
  }
  function groupBlur(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpenGroup(null);
  }

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
        background: "var(--rw-nav-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--rw-nav-border)",
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
          <RockWorksIcon size={38} color="var(--rw-nav-mark)" />
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1,
            }}
          >
            <span className="rw-wordmark">Rock Works</span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--rw-nav-sub)",
                marginTop: 4,
              }}
            >
              School of Music
            </span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <div className="rw-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {items.map((item) => (
              <div
                key={item.label}
                className="rw-navgroup"
                data-open={openGroup === item.label ? "true" : undefined}
                onKeyDown={(e) => groupKeys(e, item.label)}
                onBlur={groupBlur}
                style={{ position: "relative" }}
              >
                {item.menu ? (
                  <>
                    <button
                      type="button"
                      className="rw-nav-link rw-navtrigger"
                      aria-expanded={openGroup === item.label}
                      aria-controls={`menu-${item.label}`}
                      onClick={() => setOpenGroup(openGroup === item.label ? null : item.label)}
                      style={isActive(item) ? activeNavLinkStyle : navLinkStyle}
                    >
                      {item.label} <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.7 }}>&#9662;</span>
                    </button>
                    <div
                      id={`menu-${item.label}`}
                      className="rw-dropdown"
                      data-wide={item.menu.length > 8 ? "true" : undefined}
                      style={{
                        position: "absolute",
                        top: "100%",
                        ...(item.menu.length > 8 ? { right: 0 } : { left: 0 }),
                        minWidth: 210,
                        background: "var(--rw-nav-panel)",
                        border: "1px solid var(--rw-nav-border)",
                        borderRadius: "var(--rw-radius-md)",
                        boxShadow: "var(--rw-nav-shadow)",
                        padding: 8,
                        marginTop: 6,
                      }}
                    >
                      {item.menu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="rw-dropitem"
                          aria-current={matches(sub.href) ? "page" : undefined}
                          onClick={() => setOpenGroup(null)}
                          style={{ display: "block", padding: "10px 12px", borderRadius: "var(--rw-radius-sm)", fontSize: 14, fontWeight: 600, color: "var(--rw-nav-panel-fg)", textDecoration: "none" }}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className="rw-nav-link"
                    aria-current={isActive(item) ? "page" : undefined}
                    style={isActive(item) ? activeNavLinkStyle : navLinkStyle}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <span className="rw-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            {isAuthenticated ? (
              <>
                {/* A student's dashboard is Practice, already in the header. */}
                {!isStudent && (
                  <Link href={dashboardHref} className="rw-nav-link" style={navLinkStyle}>
                    Dashboard
                  </Link>
                )}
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
            ref={burger}
            type="button"
            className="rw-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            style={{ display: "none", width: 44, height: 44, flexDirection: "column", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--rw-nav-border)", borderRadius: "var(--rw-radius-sm)", padding: 0, cursor: "pointer", color: "var(--rw-nav-fg)" }}
          >
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
          </button>
        </nav>
      </div>

      {mobileOpen && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 70, background: "color-mix(in srgb, var(--rw-ink) 55%, transparent)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
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
              <span style={{ fontFamily: "var(--rw-font-display)", fontWeight: 800, fontSize: "var(--rw-text-xl)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--rw-ink)" }}>Menu</span>
              <button
                type="button"
                className="rw-nav-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Close the menu"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "transparent", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-sm)", color: "var(--rw-ink)", cursor: "pointer" }}
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: "8px 12px 20px" }}>
              {items.map((item) => (
                <div key={item.label} style={{ borderBottom: "1px solid var(--rw-border)" }}>
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
                    {!isStudent && (
                      <>
                        <Link href={dashboardHref} onClick={() => setMobileOpen(false)} style={mobileMenuLinkStyle}>
                          Dashboard
                        </Link>
                        <Link href="/member" onClick={() => setMobileOpen(false)} style={mobileMenuLinkStyle}>
                          Student Dashboard
                        </Link>
                      </>
                    )}
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
  color: "var(--rw-nav-fg)",
  textDecoration: "none",
  cursor: "pointer",
};

// active link uses the text orange
const activeNavLinkStyle = {
  ...navLinkStyle,
  color: "var(--rw-nav-active)",
  boxShadow: "inset 0 -2px 0 var(--rw-nav-active)",
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
