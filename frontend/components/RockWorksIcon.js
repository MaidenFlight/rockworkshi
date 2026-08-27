// The Rock Works mark: a plectrum cleaved by the school's own wave.
//
// It replaces a mark that was OpenAI's logomark — the same SVG path on the
// same 716 grid — which had been standing in as this school's identity in the
// nav, the footer, the browser tab, five auth pages and as a 420px watermark
// on the homepage. Another company's registered trademark on a site taking
// payments, so it had to go.
//
// The name is the brief. "Rock" is the music and, in Hawaii, the ground
// itself; "Works" is a place where things are made, and a works stamps its
// mark on what it makes. So: a pick — the one tool shared by the school's
// guitar, bass and ukulele students, and the most legible small shape in
// music — split by the wave that already cuts the foot of every page hero
// (see PageHero in components/ui/index.js). Struck stone, split by the
// Pacific.
//
// Three things hold it together:
//
// 1. It is one colour, always. It has to survive as a 16px favicon, as gold
//    on the hero gradient and as a 10%-white watermark, and a mark that needs
//    two colours cannot do that. No gradient, no second fill.
//
// 2. The pick is slightly WIDER than it is tall (50 x 48.7 on this grid).
//    That ratio is the whole reason it reads as a pick: drawn taller than
//    wide it becomes a teardrop, and the first two attempts here were map
//    pins. A real 351 is a triangle with two big shoulder radii and a tighter
//    tip, so the outline is built as the convex hull of three circles rather
//    than drawn freehand — that keeps the flanks straight between corners and
//    the tangents exact.
//
// 3. The mark is severed, and that is the one risk it takes. Logos are
//    usually whole; this one has daylight through it, which is a real cost at
//    small sizes. Below about 20px the gap closes and it reads as a solid
//    pick — an honest degradation, because the silhouette alone is still the
//    mark. An earlier version also slid the two halves sideways, like a
//    snapped stone whose pieces no longer fit. It was cut: at nav and favicon
//    sizes it damaged the silhouette without ever reading as intent, and the
//    cleave is already the bold move.
//
// The wave's own cubic is M0,40 C360,80 1080,0 1440,40 on a 1440x70 box.
// Scaled literally onto 64 units its deviation is 0.4 units — invisible — so
// the S is kept and the amplitude opened up. The shape is the site's; the
// depth belongs to this drawing.
//
// Geometry is generated, not hand-typed. Two closed paths, no <mask> and no
// clipPath ids, so the mark can be inlined several times on one page (nav,
// footer and watermark all appear on the homepage) with nothing to collide.

const UPPER =
  "M9.74 28.53C6.72 24.65 6.15 19.4 8.27 14.95C10.42 10.43 14.99 7.55 20 7.55C28 7.55 36 7.55 44 7.55C49.01 7.55 53.58 10.43 55.73 14.95C57.05 17.7 57.33 20.76 56.63 23.62C43.82 19.7 23.4 30.76 9.74 28.53Z";

const LOWER =
  "M56.63 27.02C56.19 28.85 55.34 30.6 54.11 32.13C48.16 39.47 42.22 46.82 36.28 54.16C35.23 55.45 33.66 56.2 32 56.2C30.34 56.2 28.77 55.45 27.72 54.16C21.78 46.82 15.84 39.47 9.89 32.13C9.84 32.06 9.79 32 9.74 31.93C23.4 34.16 43.82 23.1 56.63 27.02Z";

export default function RockWorksIcon({ size = 32, color = "var(--rw-orange)" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={UPPER} fill={color} />
      <path d={LOWER} fill={color} />
    </svg>
  );
}
