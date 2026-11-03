// A small drawn icon set for the member area. Butt caps and miter joins, like the instrument
// marks in DESIGN.md, so they share the signage type's blunt terminals.
const PATHS = {
  star: <path d="M12 3l2.8 5.9 6.2.8-4.6 4.4 1.2 6.4L12 17.4l-5.6 3.1 1.2-6.4L3 9.7l6.2-.8z" fill="currentColor" stroke="none" />,
  "star-outline": <path d="M12 3l2.8 5.9 6.2.8-4.6 4.4 1.2 6.4L12 17.4l-5.6 3.1 1.2-6.4L3 9.7l6.2-.8z" />,
  "arrow-left": <path d="M20 12H5M11 5l-7 7 7 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  record: <rect x="5" y="5" width="14" height="14" rx="7" fill="currentColor" stroke="none" />,
  stop: <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />,
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
