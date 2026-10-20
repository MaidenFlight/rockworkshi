// The Rock Works mark: a plectrum cleaved by the school's own wave.

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
