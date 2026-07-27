import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";

// Self-hosted from app/fonts rather than next/font/google. Fetching these at
// build time meant the build needed to reach fonts.googleapis.com, and failed
// when it couldn't. The files are the same latin-subset woff2 Google was
// serving, so rendering is unchanged.
//
// Zilla Slab has no variable version, so it's one file per weight and style —
// and every one is preloaded, so only the faces actually used are listed.
// Headings use 500, 600 and 700 (an h1/h2/h3 with no weight renders at the UA
// default bold); the single italic is the home hero's "From day one." em.
// Re-add a face here, with its woff2, if a design starts using one.
const zillaSlab = localFont({
  variable: "--font-zilla-slab",
  display: "swap",
  src: [
    { path: "./fonts/zilla-slab-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/zilla-slab-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/zilla-slab-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/zilla-slab-700.woff2", weight: "700", style: "normal" },
  ],
});

// Source Sans 3 is a variable font: Google returned the same file for every
// weight we asked for, so it's one file covering the 400–700 range we use.
// Italic isn't included because the previous config didn't request it either —
// the few italic runs in body copy are synthesized, as they were before.
const sourceSans = localFont({
  variable: "--font-source-sans",
  display: "swap",
  src: [{ path: "./fonts/source-sans-3-variable.woff2", weight: "400 700", style: "normal" }],
});

export const metadata = {
  title: "Rock Works School of Music",
  description:
    "A ten-year, song-based music curriculum for individuals and rock bands, in Honolulu since 1982.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${zillaSlab.variable} ${sourceSans.variable}`}>
      <body>
        <AuthProvider>
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
            <Nav />
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
