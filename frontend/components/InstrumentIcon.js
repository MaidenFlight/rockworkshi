// The six instrument marks.
const ICONS = {
  Guitar: (
    <>
      <path d="M9.8 1.6H14.2V4.4H9.8Z" />
      <path d="M10.7 4.4V12M13.3 4.4V12" />
      <path d="M12 11.6C9.6 11.6 7.8 12.4 7.8 14C7.8 15.4 9.1 15.6 9.1 16.6C9.1 17.8 6.2 18 6.2 19.8C6.2 21.5 8.8 22.6 12 22.6C15.2 22.6 17.8 21.5 17.8 19.8C17.8 18 14.9 17.8 14.9 16.6C14.9 15.6 16.2 15.4 16.2 14C16.2 12.4 14.4 11.6 12 11.6Z" />
      <path d="M9.8 20.4H14.2" />
      <circle className="rw-icon-accent" cx="12" cy="15.2" r="1.7" />
    </>
  ),

  Piano: (
    <>
      <rect x="2.6" y="5.8" width="18.8" height="12.8" rx="1.5" />
      <path d="M2.6 9.2H21.4" />
      {/* Five white keys, C to G, a crop of a keyboard, not a squeezed octave. */}
      <path d="M6.36 9.2V18.6M10.12 9.2V18.6M13.88 9.2V18.6M17.64 9.2V18.6" />
      <path
        fill="currentColor"
        stroke="none"
        d="M5.26 9.2H7.46V14H5.26ZM9.02 9.2H11.22V14H9.02ZM16.54 9.2H18.74V14H16.54Z"
      />
      <path className="rw-icon-accent-fill" stroke="none" opacity="0.38" d="M6.36 9.2H10.12V18.6H6.36Z" />
    </>
  ),

  Bass: (
    <>
      <path d="M9.9 1H14.1V4.4H9.9Z" />
      <path d="M10.9 4.4V13.6M13.1 4.4V13.6" />
      <path d="M12 13.2C9.6 13.2 8 13.9 8 15.3C8 16.4 5.8 16.8 5.8 18.5C5.8 20.7 8.6 22.4 12 22.4C15.4 22.4 18.2 20.7 18.2 18.5C18.2 16.8 16 16.4 16 15.3C16 13.9 14.4 13.2 12 13.2Z" />
      <path className="rw-icon-accent-fill" stroke="none" d="M8.8 17.4H15.2V19.1H8.8Z" />
    </>
  ),

  Drums: (
    <>
      <ellipse className="rw-icon-accent" cx="12" cy="6.6" rx="7.8" ry="3.2" />
      <path d="M4.2 6.6V17M19.8 6.6V17" />
      <path d="M4.2 17A7.8 3.2 0 0 0 19.8 17" />
      {/* The tension rods. */}
      <path d="M4.2 9.6L6.8 15.4L9.4 9.6L12 15.4L14.6 9.6L17.2 15.4L19.8 9.6" />
    </>
  ),

  Voice: (
    <>
      <circle cx="12" cy="6.2" r="4.2" />
      <path d="M8.2 4.8H15.8M8.2 7.6H15.8" />
      <path d="M10.6 10.2L11.2 20.4H12.8L13.4 10.2" />
      <path className="rw-icon-accent" d="M17.8 3.8A4.6 4.6 0 0 1 17.8 8.6M20.4 2.4A7.6 7.6 0 0 1 20.4 10" />
    </>
  ),

  Ukulele: (
    <>
      <path d="M10.2 5.6H13.8V8H10.2Z" />
      <path d="M10.8 8V13.4M13.2 8V13.4" />
      <path d="M12 13C10.1 13 8.5 13.7 8.5 15C8.5 16.1 9.2 16.3 9.2 17.2C9.2 18.2 7.4 18.4 7.4 19.6C7.4 20.9 9.5 21.6 12 21.6C14.5 21.6 16.6 20.9 16.6 19.6C16.6 18.4 14.8 18.2 14.8 17.2C14.8 16.3 15.5 16.1 15.5 15C15.5 13.7 13.9 13 12 13Z" />
      <path d="M10.4 19.8H13.6" />
      <circle className="rw-icon-accent" cx="12" cy="16.2" r="1.35" />
    </>
  ),
};

export const INSTRUMENT_ICON_NAMES = Object.keys(ICONS);

export default function InstrumentIcon({ name, size = 52 }) {
  const art = ICONS[name];
  // An unknown name draws nothing rather than a broken glyph.
  if (!art) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {art}
    </svg>
  );
}
