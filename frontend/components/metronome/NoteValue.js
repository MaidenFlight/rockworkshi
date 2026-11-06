// Note values drawn as notation: one note or a beamed group, with an optional dot, flag or
// tuplet number. Drawn rather than typed, because the music symbols in fonts differ on every
// device. Stems use butt caps, like the icon set.
const GAP = 7;

export default function NoteValue({ count = 1, beams = 0, tuplet, dotted, flag, height = 24, label }) {
  const top = tuplet ? 8 : 2;
  const headY = 19 + top;
  const stemTop = 4 + top;
  const xs = Array.from({ length: count }, (_, i) => 4 + i * GAP);
  const last = xs[xs.length - 1];
  const width = last + 7 + (dotted ? 5 : 0) + (flag && count === 1 ? 4 : 0);
  const viewHeight = 24 + top;
  return (
    <svg
      viewBox={`0 0 ${width} ${viewHeight}`}
      height={height}
      width={(height * width) / viewHeight}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      {xs.map((x) => (
        <ellipse key={`h${x}`} cx={x} cy={headY} rx={3.3} ry={2.4} transform={`rotate(-20 ${x} ${headY})`} fill="currentColor" />
      ))}
      {xs.map((x) => (
        <line key={`s${x}`} x1={x + 2.9} y1={headY - 0.6} x2={x + 2.9} y2={stemTop} stroke="currentColor" strokeWidth={1.4} strokeLinecap="butt" />
      ))}
      {count > 1 &&
        Array.from({ length: beams }, (_, b) => (
          <rect key={`b${b}`} x={xs[0] + 2.2} y={stemTop + b * 3.1} width={last - xs[0] + 1.4} height={2.1} fill="currentColor" />
        ))}
      {count === 1 && flag && (
        <path d={`M${xs[0] + 3.6} ${stemTop}c0.4 3.2 4.6 4.4 4.6 8.4c0 1.4-0.5 2.6-1.2 3.4c0.3-0.9 0.5-1.9 0.2-2.9c-0.6-2.3-3.6-3.3-3.6-3.3z`} fill="currentColor" />
      )}
      {dotted && <circle cx={last + 7.4} cy={headY - 0.4} r={1.5} fill="currentColor" />}
      {tuplet && (
        <text
          x={(xs[0] + last) / 2 + 2.9}
          y={top + 1}
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="700"
          fontFamily="var(--rw-font-body)"
          fill="currentColor"
        >
          {tuplet}
        </text>
      )}
    </svg>
  );
}

// The symbol for the note a BPM counts.
export const PULSE_SYMBOL = {
  quarter: { count: 1 },
  "dotted-quarter": { count: 1, dotted: true },
  eighth: { count: 1, flag: true },
};
