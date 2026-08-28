import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";

// Self-hosted from app/fonts rather than next/font/google. Fetching at build
// time meant the build had to reach fonts.googleapis.com and failed when it
// couldn't. These are the latin-subset woff2 files Google serves.
//
// THE TYPE CHANGED ON 2026-08-28. Zilla Slab (a high-contrast slab serif on a
// cream ground) plus Source Sans was one of the three looks AI-generated
// interfaces converge on regardless of subject, and this is a school selling
// rock and roll to teenagers. Both faces are gone.
//
// Big Shoulders Display is a condensed signage face — American industrial
// lettering, built to be read tall and loud at distance. It is the poster
// voice: headlines, the wordmark, level numerals, nothing under 20px.
// Libre Franklin carries every word anyone actually reads. Franklin Gothic is
// the American newspaper and poster workhorse, which is the correct company
// for a signage display face; it has no opinion at 15px, which is the job.
const bigShoulders = localFont({
  variable: "--font-big-shoulders",
  display: "swap",
  src: [{ path: "./fonts/big-shoulders-display-variable.woff2", weight: "400 900", style: "normal" }],
});

const libreFranklin = localFont({
  variable: "--font-libre-franklin",
  display: "swap",
  src: [{ path: "./fonts/libre-franklin-variable.woff2", weight: "400 800", style: "normal" }],
});

export const metadata = {
  // "Honolulu" belongs in the tab and the search result, not only in the
  // description below it. The school is a physical place first.
  title: "Rock Works School of Music — Honolulu",
  description:
    "A ten-year, song-based music curriculum for individuals and rock bands, in Honolulu since 1982.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${libreFranklin.variable}`}>
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: A school that puts teenagers on a stage, refusing the calm cream brochure every music school ships.
OWN-WORLD: The 1950s Hawaiian silkie. Lacquer black, flare red field, gold, lagoon; condensed signage caps over Franklin Gothic; chrome on the wordmark only; a motif field above an engineered border band, label stock wherever prose runs.
STORY: You see a school that makes noise, understand one song is taught five ways, and either book a trial or join the member area.
FIRST VIEWPORT: Full-bleed flare field; wordmark in chrome top-left; school line at poster scale; the six instrument marks as the printed repeat; the border band across the foot carrying both actions and the price.
FORM: The Silkie, candidate 3 of 7 on the re-rolled grounded list; seed key 26642ac2.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`,
          }}
        />
        <AuthProvider>
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
            {/* The nav is 26 tab stops deep — seven items, four of them
                dropdowns, then Sign In, Sign Up and Book a Trial. A keyboard
                or switch user paid that toll on every page before reaching the
                thing the page is for. First stop in the document now, invisible
                until it takes focus. See .rw-skip in globals.css. */}
            <a href="#main" className="rw-skip">
              Skip to content
            </a>
            <Nav />
            {/* tabIndex -1 so the heading target actually receives focus when
                the skip link is followed; without it some browsers move the
                scroll position but leave focus in the nav, which defeats it. */}
            <main id="main" tabIndex={-1} style={{ flex: 1 }}>
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
