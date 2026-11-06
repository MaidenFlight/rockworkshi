"use client";

import { tendency, CLEAN_PASS, MAX_WINDOW } from "@/lib/rhythm/scoring";
import Notation from "./Notation";
import s from "./rhythm.module.css";

const RANGE = Math.round(MAX_WINDOW * 1000);

function verdict(score) {
  if (score >= CLEAN_PASS) return "Clean pass";
  if (score >= 70) return "Close";
  return "Rough";
}

// Every hit as a dot on a line from early to late. Dots that would overlap stack upward.
function OffsetPlot({ offsets }) {
  const W = 320;
  const mid = W / 2;
  const scale = (mid - 14) / RANGE;
  const placed = [];
  const dots = [...offsets]
    .sort((a, b) => a - b)
    .map((ms) => {
      const x = mid + Math.max(-RANGE, Math.min(RANGE, ms)) * scale;
      let row = 0;
      while (placed.some((p) => p.row === row && Math.abs(p.x - x) < 7)) row += 1;
      placed.push({ x, row });
      return { x, y: 40 - Math.min(row, 4) * 7 };
    });
  const band = 30 * scale;
  return (
    <svg viewBox={`0 0 ${W} 64`} className={s.plot} aria-hidden="true" focusable="false">
      <rect x={mid - band} y={6} width={band * 2} height={40} className={s.plotBand} />
      <line x1={10} x2={W - 10} y1={46} y2={46} className={s.plotAxis} />
      <line x1={mid} x2={mid} y1={6} y2={50} className={s.plotCentre} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={3.4} className={s.plotDot} />
      ))}
      <text x={12} y={61} className={s.plotLabel}>
        Early
      </text>
      <text x={mid} y={61} textAnchor="middle" className={s.plotLabel}>
        On the beat
      </text>
      <text x={W - 12} y={61} textAnchor="end" className={s.plotLabel}>
        Late
      </text>
    </svg>
  );
}

export default function Results({ last, best, marks, reveal, counts, roundWord }) {
  if (!last) return null;
  const sum = last.summary;
  const lean = tendency(sum);
  const parts = [
    `${sum.on} on time`,
    sum.early ? `${sum.early} early` : null,
    sum.late ? `${sum.late} late` : null,
    sum.missed ? `${sum.missed} missed` : null,
    sum.extra ? `${sum.extra} extra ${sum.extra === 1 ? "tap" : "taps"}` : null,
  ].filter(Boolean);

  return (
    <section className={s.results} aria-labelledby="rt-results-title">
      <div className={s.resultsHead}>
        <h2 id="rt-results-title" className={s.h2}>
          Last {roundWord}
        </h2>
        <span className={s.resultsMeta}>
          {roundWord === "round" ? "Round" : "Pass"} {last.pass + 1} at {last.bpm} BPM
        </span>
      </div>

      <div className={s.scoreRow}>
        <p className={s.score}>
          <span className={s.scoreValue}>{sum.score}</span>
          <span className={s.scoreUnit}>%</span>
        </p>
        <div className={s.scoreText}>
          <p className={s.verdict}>
            {verdict(sum.score)}
            {last.newBest && <span className={s.bestTag}>New best</span>}
          </p>
          <p className={s.tally}>{parts.join(" · ")}</p>
        </div>
      </div>

      {reveal && (
        <div className={s.reveal}>
          <p className={s.revealLabel}>What you heard</p>
          <Notation bars={last.bars} marks={marks} counts={counts} size="sm" />
        </div>
      )}

      {sum.offsets.length > 0 && <OffsetPlot offsets={sum.offsets} />}

      <ul className={s.notes}>
        {lean && lean.kind === "rushing" && (
          <li>
            You&rsquo;re rushing: on average your taps land {lean.ms} ms ahead of the note. Feel the space before each one.
          </li>
        )}
        {lean && lean.kind === "dragging" && (
          <li>You&rsquo;re dragging: on average your taps land {lean.ms} ms behind the note. Lean into each one.</li>
        )}
        {lean && lean.kind === "centred" && <li>Centred: on average within {lean.ms} ms of the note.</li>}
        {sum.offsets.length > 2 && <li>Your timing varied by about ±{sum.spreadMs} ms from tap to tap.</li>}
        {sum.score < 60 && last.bpm > 50 && <li>Take it 10 BPM slower and run it again. Clean and slow beats fast and loose.</li>}
        {best && (
          <li>
            Your best here: {best.score}% at {best.bpm} BPM.
          </li>
        )}
      </ul>
    </section>
  );
}
