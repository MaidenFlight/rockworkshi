// A small drawn icon set for the member area. Butt caps and miter joins, like the instrument
// marks in DESIGN.md, so they share the signage type's blunt terminals.
const PATHS = {
  star: <path d="M12 3l2.8 5.9 6.2.8-4.6 4.4 1.2 6.4L12 17.4l-5.6 3.1 1.2-6.4L3 9.7l6.2-.8z" fill="currentColor" stroke="none" />,
  "star-outline": <path d="M12 3l2.8 5.9 6.2.8-4.6 4.4 1.2 6.4L12 17.4l-5.6 3.1 1.2-6.4L3 9.7l6.2-.8z" />,
  "arrow-left": <path d="M20 12H5M11 5l-7 7 7 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  record: <rect x="5" y="5" width="14" height="14" rx="7" fill="currentColor" stroke="none" />,
  stop: <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />,
  play: <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M6 5h4.5v14H6zM13.5 5H18v14h-4.5z" fill="currentColor" stroke="none" />,
  "bar-back": <path d="M6 5v14M19 5.5v13L9 12z" />,
  "bar-forward": <path d="M18 5v14M5 5.5v13L15 12z" />,
  loop: <path d="M4 12V9h13l-3-3M20 12v3H7l3 3" />,
  mic: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  "eye-off": <path d="M4 4l16 16M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.2 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.1-1" />,
  chart: <path d="M4 5h16M4 10h16M4 15h16M4 20h10" />,
  check: <path d="M4.5 12.5l5 5L20 7" />,
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "-0.15em" }}
    >
      {PATHS[name]}
    </svg>
  );
}
