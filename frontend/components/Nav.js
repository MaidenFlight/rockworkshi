"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { primaryNav } from "@/lib/content";
import RockWorksIcon from "@/components/RockWorksIcon";

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(251,245,236,0.86)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #ece0d5",
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
          <RockWorksIcon size={38} color="#ef5130" />
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1,
            }}
          >
            <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 700, fontSize: 25, letterSpacing: "0.01em", color: "#0a2338" }}>
              Rock Works
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#0e8a97",
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
                      style={navLinkStyle}
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
                        background: "#fffdf9",
                        border: "1px solid #ece0d5",
                        borderRadius: 11,
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
                          style={{ display: "block", padding: "10px 12px", borderRadius: 7, fontSize: 14, fontWeight: 600, color: "#33454f", textDecoration: "none" }}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link href={item.href} className="rw-nav-link" style={navLinkStyle}>
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <span className="rw-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <Link href="/signin" className="rw-nav-link" style={navLinkStyle}>
              Sign In
            </Link>
            <Link href="/trial" className="rw-cta" style={ctaStyle}>
              Book a Trial
            </Link>
          </span>

          <button
            className="rw-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            style={{ display: "none", background: "transparent", border: "1px solid #d8cab8", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "#0a2338" }}
          >
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "currentColor", margin: "3px 0" }} />
          </button>
        </nav>
      </div>

      {mobileOpen && (
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
              background: "#fbf5ec",
              boxShadow: "-20px 0 50px -20px rgba(6,25,45,0.5)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              animation: "rise .22s ease both",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid #ece0d5" }}>
              <span style={{ fontFamily: "var(--font-zilla-slab), serif", fontWeight: 700, fontSize: 19, color: "#0a2338" }}>Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                style={{ background: "transparent", border: "none", fontSize: 24, color: "#0a2338", cursor: "pointer", lineHeight: 1 }}
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
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", fontFamily: "inherit", padding: "15px 8px", fontSize: 16, fontWeight: 700, color: "#0a2338", cursor: "pointer" }}
                      >
                        {item.label}
                        <span style={{ fontSize: 12, color: "#8a7d6a" }}>&#9662;</span>
                      </button>
                      {mobileExpanded === item.label && (
                        <div style={{ padding: "0 8px 12px" }}>
                          {item.menu.map((sub) => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => setMobileOpen(false)}
                              style={{ display: "block", padding: "11px 14px", fontSize: 14.5, fontWeight: 600, color: "#33454f", textDecoration: "none", borderLeft: "2px solid #e6d8c6" }}
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
                      style={{ display: "block", padding: "15px 8px", fontSize: 16, fontWeight: 700, color: "#0a2338", textDecoration: "none" }}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20, padding: "0 8px" }}>
                <Link
                  href="/signin"
                  onClick={() => setMobileOpen(false)}
                  style={{ textAlign: "center", padding: 12, borderRadius: 8, border: "1px solid #d8cab8", fontWeight: 600, fontSize: 15, color: "#33454f", textDecoration: "none" }}
                >
                  Sign In
                </Link>
                <Link
                  href="/trial"
                  onClick={() => setMobileOpen(false)}
                  style={{ textAlign: "center", padding: 13, borderRadius: 8, background: "#ef5130", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
                >
                  Book a Trial
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

const navLinkStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 14.5,
  fontWeight: 600,
  color: "#33454f",
  textDecoration: "none",
  cursor: "pointer",
};

const ctaStyle = {
  padding: "10px 18px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14.5,
  color: "#fff",
  background: "#ef5130",
  textDecoration: "none",
  cursor: "pointer",
};
