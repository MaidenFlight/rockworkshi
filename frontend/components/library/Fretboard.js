// A stretch of neck drawn sideways, high string on top, as tab reads. Used for scales, bass
// arpeggios and the note finder. Each dot is { string, fret, text, tone } where tone is "root",
// "note", "blue" (a blues scale's extra note) or "dim" (outside the position being shown).
const W = 42;
const OPEN = 34;
const GAP = 25;
const LEFT = 26;
const TOP = 16;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

const FILL = { root: "var(--rw-orange)", note: "var(--rw-ink)", blue: "var(--rw-teal)", dim: "var(--rw-surface)" };

export default function Fretboard({ tuning, from = 0, to = 15, dots, title }) {
  const n = tuning.midi.length;
  const first = Math.max(1, from);
  const nut = LEFT + (from === 0 ? OPEN : 0);
  const width = nut + (to - first + 1) * W + 12;
  const height = TOP * 2 + (n - 1) * GAP + 20;
  const yOf = (string) => TOP + (n - 1 - string) * GAP;
  const xOf = (fret) => (fret === 0 ? LEFT + OPEN / 2 : nut + (fret - first + 0.5) * W);
  const wire = (k) => nut + k * W;
  const mid = TOP + ((n - 1) * GAP) / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title} style={{ display: "block" }}>
      {Array.from({ length: to - first + 1 }).map((_, k) => {
        const fret = first + k;
        const cx = nut + (k + 0.5) * W;
        if (fret === 12 || fret === 24) {
          return (
            <g key={fret}>
              <circle cx={cx} cy={TOP + GAP * 0.9} r={4} fill="var(--rw-rule)" />
              <circle cx={cx} cy={TOP + (n - 1) * GAP - GAP * 0.9} r={4} fill="var(--rw-rule)" />
            </g>
          );
        }
        return INLAYS.includes(fret) ? <circle key={fret} cx={cx} cy={mid} r={4} fill="var(--rw-rule)" /> : null;
      })}

      {Array.from({ length: to - first + 2 }).map((_, k) => (
        <line
          key={k}
          x1={wire(k)}
          x2={wire(k)}
          y1={TOP - 4}
          y2={TOP + (n - 1) * GAP + 4}
          stroke="var(--rw-prose)"
          strokeWidth={k === 0 && from === 0 ? 4 : 1}
          opacity={k === 0 && from === 0 ? 1 : 0.55}
        />
      ))}

      {tuning.midi.map((_, s) => (
        <g key={s}>
          <line x1={LEFT} x2={width - 12} y1={yOf(s)} y2={yOf(s)} stroke="var(--rw-prose)" strokeWidth={1 + (n - 1 - s) * 0.18} opacity={0.8} />
          <text x={LEFT - 12} y={yOf(s) + 4} fontSize={11} textAnchor="middle" fill="var(--rw-meta)">
            {tuning.strings[s]}
          </text>
        </g>
      ))}

      {dots.map((d) => {
        const cx = xOf(d.fret);
        const cy = yOf(d.string);
        const dim = d.tone === "dim";
        return (
          <g key={`${d.string}-${d.fret}`}>
            <circle cx={cx} cy={cy} r={10.5} fill={FILL[d.tone] || FILL.note} stroke={dim ? "var(--rw-line)" : "none"} strokeWidth={1.2} />
            <text x={cx} y={cy + 4} fontSize={String(d.text).length > 2 ? 8.5 : 10.5} fontWeight={700} textAnchor="middle" fill={dim ? "var(--rw-meta)" : "var(--rw-surface)"}>
              {d.text}
            </text>
          </g>
        );
      })}

      {Array.from({ length: to - first + 1 }).map((_, k) => {
        const fret = first + k;
        const show = fret === first || fret === to || INLAYS.includes(fret) || fret === 12;
        return show ? (
          <text key={fret} x={nut + (k + 0.5) * W} y={height - 4} fontSize={10.5} textAnchor="middle" fill="var(--rw-meta)">
            {fret}
          </text>
        ) : null;
      })}
    </svg>
  );
}
