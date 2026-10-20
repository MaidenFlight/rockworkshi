import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteTextProvider } from "@/contexts/SiteTextContext";
import SiteTextBar from "@/components/SiteTextBar";
import { getSiteText } from "@/lib/siteText";

// Fonts are self-hosted so the build doesn't need to reach Google Fonts.
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

// Classic theme fonts. The "-real" names are aliased in tokens.css.
const zillaSlab = localFont({
  variable: "--font-zilla-slab-real",
  display: "swap",
  src: [
    { path: "./fonts/zilla-slab-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/zilla-slab-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/zilla-slab-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/zilla-slab-700.woff2", weight: "700", style: "normal" },
  ],
});

const sourceSans = localFont({
  variable: "--font-source-sans-real",
  display: "swap",
  src: [{ path: "./fonts/source-sans-3-variable.woff2", weight: "400 700", style: "normal" }],
});

export const metadata = {
  title: "Rock Works School of Music — Honolulu",
  description:
    "A ten-year, song-based music curriculum for individuals and rock bands, in Honolulu since 1982.",
};

export default async function RootLayout({ children }) {
  const siteText = await getSiteText();

  return (
    <html lang="en" className={`${bigShoulders.variable} ${libreFranklin.variable} ${zillaSlab.variable} ${sourceSans.variable}`}
      suppressHydrationWarning>
      <body>
        {/* Set the theme before first paint to avoid a flash of the default one. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('rw-world')==='classic'){document.documentElement.dataset.world='classic'}}catch(e){}",
          }}
        />
        <AuthProvider>
          <SiteTextProvider initialText={siteText}>
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
            <a href="#main" className="rw-skip">
              Skip to content
            </a>
            <Nav />
            {/* tabIndex -1 so the skip link actually moves focus here */}
            <main id="main" tabIndex={-1} style={{ flex: 1 }}>
              {children}
            </main>
            <Footer />
          </div>
          <SiteTextBar />
          </SiteTextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
