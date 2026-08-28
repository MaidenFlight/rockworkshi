import HomeSilkie from "@/components/home/HomeSilkie";
import HomeClassic from "@/components/home/HomeClassic";

// Both homepages ship, and [data-world] on <html> decides which one paints.
//
// The world toggle is a token swap everywhere else on the site — 48 routes read
// the same token NAMES, so palette, type and radii switch without any route
// knowing a second world exists. The homepage is the exception: its structure
// changed in the redesign, so restoring the old colours alone would produce a
// hybrid page that never shipped and that nobody chose.
//
// Rendering both and hiding one with display:none rather than branching in JS
// keeps the switch flash-free (the world is set on <html> before first paint by
// the inline script in layout.js) and keeps the hidden composition out of the
// accessibility tree entirely. The cost is honest and worth naming: this page
// serves two compositions' worth of markup, and there are two h1 elements in
// the document, one of them display:none.
export default function Home() {
  return (
    <>
      <div className="rw-world-silkie">
        <HomeSilkie />
      </div>
      <div className="rw-world-classic">
        <HomeClassic />
      </div>
    </>
  );
}
