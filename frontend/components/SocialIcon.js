// The three social marks.
//
// These replace two-letter text stand-ins — "IG", "FB", "YT" set in circles.
// Letters in a circle are what you draw when you have not drawn the icon yet:
// they carry no brand recognition at 16px, they inherit the body face rather
// than an icon system, and they sit optically higher than a real glyph because
// caps have no descender to balance them.
//
// Drawn on the same 24x24 grid as components/InstrumentIcon.js so the two sets
// are one family, but these are solid rather than stroked. That is deliberate:
// the instrument marks are the school's own drawings and carry its stroke
// language, while these are other companies' identities and are recognised by
// silhouette. A stroked Instagram camera or YouTube badge stops reading as
// itself long before it gets down to footer size.
//
// Sized from the parent's font-size via `1em` and filled with currentColor, so
// a single colour change on the anchor moves the mark, its hover state and its
// focus ring together.

const MARKS = {
  Instagram: (
    <>
      <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Z" />
      <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      <circle cx="17.4" cy="6.6" r="1.2" />
    </>
  ),

  Facebook: (
    <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5H16.7V4.62A21 21 0 0 0 14.28 4.5c-2.4 0-4.04 1.47-4.04 4.16v2.23H7.5V14h2.74v8h3.26Z" />
  ),

  YouTube: (
    <>
      <path d="M21.6 7.2a2.9 2.9 0 0 0-2.05-2.06C17.75 4.66 12 4.66 12 4.66s-5.75 0-7.55.48A2.9 2.9 0 0 0 2.4 7.2C1.92 9 1.92 12 1.92 12s0 3 .48 4.8a2.9 2.9 0 0 0 2.05 2.06c1.8.48 7.55.48 7.55.48s5.75 0 7.55-.48a2.9 2.9 0 0 0 2.05-2.06c.48-1.8.48-4.8.48-4.8s0-3-.48-4.8Zm-11.7 7.75V9.05L14.9 12l-5 2.95Z" />
    </>
  ),
};

export default function SocialIcon({ name }) {
  const art = MARKS[name];
  // An unrecognised name draws nothing rather than an empty box. The three keys
  // are the `label` values in footerSocial (lib/content.js).
  if (!art) return null;

  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {art}
    </svg>
  );
}
