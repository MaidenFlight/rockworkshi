import { mod12 } from "@/lib/library";

// A chord box: strings top to bottom of the neck, low string on the left, as chord books draw them.
// Dots carry fingers, note names or intervals; the root's dots are red.
const SX = 24;
const FY = 28;
const TOP = 34;
const LEFT = 30;

export default function ChordBox({ voicing, tuning, notes, intervals, label = "fingers", rootPc, title }) {
  const { frets, fingers, barres, base, span } = voicing;
  const n = frets.length;
  const width = LEFT * 2 + (n - 1) * SX;
  const height = TOP + span * FY + 30;
  const x = (i) => LEFT + i * SX;
  const y = (fret) => TOP + (fret - base + 0.5) * FY;
  const pcOf = (i) => mod12(tuning.midi[i] + frets[i]);
  const text = (i) => {
    if (label === "notes") return notes.get(pcOf(i)) || "";
    if (label === "intervals") return intervals.get(pcOf(i)) || "";
    return fingers[i] ? String(fingers[i]) : "";
  };
  // Strings held down by a barre at its fret draw as the bar, not as separate dots.
  const underBarre = (i) => barres.some((b) => frets[i] === b.fret && i >= b.from && i <= b.to);
  const describe = frets.map((f, i) => `${tuning.strings[i]} ${f < 0 ? "muted" : f === 0 ? "open" : `fret ${f}`}`).join(", ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`${title}: ${describe}`}>
      {base > 1 && (
        <text x={LEFT - 12} y={TOP + FY / 2 + 4} fontSize={11} textAnchor="end" fill="var(--rw-meta)" fontWeight={700}>
          {base}fr
        </text>
      )}
      {Array.from({ length: span + 1 }).map((_, f) => (
        <line key={f} x1={x(0)} x2={x(n - 1)} y1={TOP + f * FY} y2={TOP + f * FY} stroke="var(--rw-prose)" strokeWidth={f === 0 && base === 1 ? 4 : 1} />
      ))}
      {frets.map((_, i) => (
        <line key={i} x1={x(i)} x2={x(i)} y1={TOP} y2={TOP + span * FY} stroke="var(--rw-prose)" strokeWidth={1.2} />
      ))}

      {frets.map((f, i) => {
        if (f > 0) return null;
        const cy = TOP - 13;
        if (f < 0) {
          return (
            <text key={i} x={x(i)} y={cy + 4} fontSize={13} textAnchor="middle" fill="var(--rw-meta)">
              ×
            </text>
          );
        }
        const root = pcOf(i) === rootPc;
        return <circle key={i} cx={x(i)} cy={cy} r={5} fill="none" stroke={root ? "var(--rw-orange)" : "var(--rw-prose)"} strokeWidth={root ? 2.2 : 1.5} />;
      })}

      {barres.map((b) => {
        // The bar is one finger; the roots it holds still show red, so a red bar never means every note is the root.
        const roots = frets.map((f, i) => i).filter((i) => frets[i] === b.fret && i >= b.from && i <= b.to && pcOf(i) === rootPc);
        return (
          <g key={`${b.fret}-${b.from}`}>
            <rect x={x(b.from) - 10} y={y(b.fret) - 10} width={x(b.to) - x(b.from) + 20} height={20} rx={10} fill="var(--rw-ink)" />
            {label === "fingers" && roots.map((i) => <circle key={i} cx={x(i)} cy={y(b.fret)} r={7} fill="var(--rw-orange)" />)}
            {label === "fingers" && (
              <text x={(x(b.from) + x(b.to)) / 2} y={y(b.fret) + 4.5} fontSize={12.5} fontWeight={700} textAnchor="middle" fill="var(--rw-surface)">
                {b.finger}
              </text>
            )}
          </g>
        );
      })}

      {frets.map((f, i) => {
        if (f <= 0) return null;
        const root = pcOf(i) === rootPc;
        const barred = underBarre(i);
        if (barred && label === "fingers") return null;
        const t = text(i);
        return (
          <g key={i}>
            {!barred && <circle cx={x(i)} cy={y(f)} r={10} fill={root ? "var(--rw-orange)" : "var(--rw-ink)"} />}
            <text x={x(i)} y={y(f) + 4.3} fontSize={t.length > 2 ? 9 : 11.5} fontWeight={700} textAnchor="middle" fill="var(--rw-surface)">
              {t}
            </text>
          </g>
        );
      })}

      {tuning.strings.map((s, i) => (
        <text key={i} x={x(i)} y={height - 8} fontSize={11} textAnchor="middle" fill="var(--rw-meta)">
          {s}
        </text>
      ))}
    </svg>
  );
}
