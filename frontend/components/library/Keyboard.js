import { mod12 } from "@/lib/library";

// A stretch of keyboard with marked keys. marks maps a MIDI note to { hand, text, finger }:
// the right hand in red, the left in lagoon, and "lit" (a sung or sounding note) in ink.
const WW = 28;
const WH = 116;
const BW = 17;
const BH = 72;
const BLACK = new Set([1, 3, 6, 8, 10]);
const FILL = { right: "var(--rw-orange)", left: "var(--rw-teal)", lit: "var(--rw-ink)" };

export default function Keyboard({ marks, title, low, high }) {
  const keys = [...marks.keys()];
  // From a C or F below the lowest note to an E or B above the highest.
  let from = low ?? Math.min(...keys) - 1;
  while (![0, 5].includes(mod12(from))) from--;
  let to = high ?? Math.max(...keys) + 1;
  while (![4, 11].includes(mod12(to))) to++;
  const notes = [];
  for (let m = from; m <= to; m++) notes.push(m);
  const whites = notes.filter((m) => !BLACK.has(mod12(m)));
  const width = whites.length * WW + 2;
  const whiteX = (m) => whites.indexOf(m) * WW + 1;
  const blackX = (m) => whites.filter((w) => w < m).length * WW + 1 - BW / 2;

  const label = (m, x, keyWidth, bottom) => {
    const mark = marks.get(m);
    if (!mark) return null;
    return (
      <g>
        {mark.finger !== undefined && mark.finger !== null && (
          <text x={x + keyWidth / 2} y={bottom - 24} fontSize={12.5} fontWeight={800} textAnchor="middle" fill="var(--rw-surface)">
            {mark.finger}
          </text>
        )}
        <text x={x + keyWidth / 2} y={bottom - 8} fontSize={keyWidth < 20 ? 8.5 : 10} fontWeight={700} textAnchor="middle" fill="var(--rw-surface)">
          {mark.text}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${width} ${WH + 2}`} width={width} height={WH + 2} role="img" aria-label={title} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      {whites.map((m) => {
        const mark = marks.get(m);
        const x = whiteX(m);
        return (
          <g key={m}>
            <rect x={x} y={1} width={WW} height={WH} fill={mark ? FILL[mark.hand] : "var(--rw-surface)"} stroke="var(--rw-prose)" strokeWidth={1} />
            {mod12(m) === 0 && !mark && (
              <text x={x + WW / 2} y={WH - 7} fontSize={9.5} textAnchor="middle" fill="var(--rw-meta)">
                C{Math.floor(m / 12) - 1}
              </text>
            )}
            {label(m, x, WW, WH)}
          </g>
        );
      })}
      {notes
        .filter((m) => BLACK.has(mod12(m)))
        .map((m) => {
          const mark = marks.get(m);
          const x = blackX(m);
          return (
            <g key={m}>
              <rect x={x} y={1} width={BW} height={BH} fill={mark ? FILL[mark.hand] : "var(--rw-ink)"} stroke={mark ? "var(--rw-ink)" : "none"} strokeWidth={1.5} />
              {label(m, x, BW, BH)}
            </g>
          );
        })}
    </svg>
  );
}
