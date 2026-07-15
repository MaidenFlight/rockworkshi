const TOP = 22;
const FSP = 24;
const STR_SP = 20;
const FRETS = 5;
const MARGIN = 20;

export function ChordDiagram({ frets, base = 1, accent = "#ef5130" }) {
  const n = frets.length;
  const width = MARGIN * 2 + (n - 1) * STR_SP;
  const height = TOP + FRETS * FSP + 14;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {base > 1 && (
        <text x={MARGIN - 14} y={TOP + FSP / 2 + 4} fontSize={10} fill="#8a7d6a">
          {base}fr
        </text>
      )}
      {Array.from({ length: FRETS + 1 }).map((_, f) => (
        <line
          key={f}
          x1={MARGIN}
          y1={TOP + f * FSP}
          x2={MARGIN + (n - 1) * STR_SP}
          y2={TOP + f * FSP}
          stroke="#33454f"
          strokeWidth={f === 0 && base === 1 ? 3 : 1}
        />
      ))}
      {Array.from({ length: n }).map((_, i) => (
        <line
          key={i}
          x1={MARGIN + i * STR_SP}
          y1={TOP}
          x2={MARGIN + i * STR_SP}
          y2={TOP + FRETS * FSP}
          stroke="#33454f"
          strokeWidth={1}
        />
      ))}
      {frets.map((fret, i) => {
        const x = MARGIN + i * STR_SP;
        if (fret === -1) {
          return (
            <text key={i} x={x} y={TOP - 10} fontSize={12} fill="#8a7d6a" textAnchor="middle">
              &times;
            </text>
          );
        }
        if (fret === 0) {
          return <circle key={i} cx={x} cy={TOP - 10} r={4} fill="none" stroke="#33454f" strokeWidth={1.5} />;
        }
        const disp = fret - (base - 1);
        const cy = TOP + (disp - 0.5) * FSP;
        return <circle key={i} cx={x} cy={cy} r={7} fill={accent} />;
      })}
    </svg>
  );
}

const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMITONES = [1, 3, 6, 8, 10];
const WW = 15;
const WH = 66;
const BW = 9;
const BH = 42;

export function PianoDiagram({ notes, accent = "#ef5130" }) {
  const N = 19; // ~1.5 octaves of semitones shown
  const octaves = Math.ceil(N / 12) + 1;
  const whiteKeys = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const s of WHITE_SEMITONES) {
      const semitone = oct * 12 + s;
      if (semitone < N) whiteKeys.push(semitone);
    }
  }
  const width = whiteKeys.length * WW;

  const highlighted = new Set(notes.map((n) => ((n % 12) + 12) % 12));

  return (
    <svg viewBox={`0 0 ${width} ${WH}`} width={width} height={WH}>
      {whiteKeys.map((semitone, i) => (
        <rect
          key={semitone}
          x={i * WW}
          y={0}
          width={WW}
          height={WH}
          fill={highlighted.has(semitone % 12) ? accent : "#fff"}
          stroke="#0a2338"
          strokeWidth={1}
        />
      ))}
      {whiteKeys.map((semitone, i) => {
        const nextBlack = semitone + 1;
        if (!BLACK_SEMITONES.includes(nextBlack % 12)) return null;
        return (
          <rect
            key={`b${semitone}`}
            x={(i + 1) * WW - BW / 2}
            y={0}
            width={BW}
            height={BH}
            fill={highlighted.has(nextBlack % 12) ? accent : "#0a2338"}
          />
        );
      })}
    </svg>
  );
}
