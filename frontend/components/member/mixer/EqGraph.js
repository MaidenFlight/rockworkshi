"use client";

import { useMemo, useRef } from "react";
import { DRIVE_TONE_HZ, EQ_BANDS } from "@/lib/audio/takeEffects";

const W = 320;
const H = 120;
const RANGE_DB = 15;
const F_LO = 20;
const F_HI = 20000;
const POINTS = 180;
const FREQS = Float32Array.from({ length: POINTS }, (_, i) => F_LO * (F_HI / F_LO) ** (i / (POINTS - 1)));
const BANDS = ["low", "mid", "high"];

const xOf = (f) => (Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * W;
const yOf = (db) => H / 2 - (Math.max(-RANGE_DB, Math.min(RANGE_DB, db)) / RANGE_DB) * (H / 2 - 6);

// The filters used to draw the curve: the same types, frequencies and Q as the take's real EQ,
// asked for their response by the browser itself, so the curve is the processing, not a sketch.
let filters = null;
function responseFor(fx) {
  if (typeof OfflineAudioContext === "undefined") return null;
  if (!filters) {
    const ctx = new OfflineAudioContext(1, 128, 44100);
    filters = Object.fromEntries(
      Object.entries(EQ_BANDS).map(([band, spec]) => {
        const f = ctx.createBiquadFilter();
        f.type = spec.type;
        f.frequency.value = spec.frequency;
        if (spec.Q) f.Q.value = spec.Q;
        return [band, f];
      })
    );
    filters.tone = ctx.createBiquadFilter();
    filters.tone.type = "lowpass";
    filters.tone.frequency.value = DRIVE_TONE_HZ;
  }
  const total = new Float32Array(POINTS);
  const mag = new Float32Array(POINTS);
  const phase = new Float32Array(POINTS);
  const stages = [...BANDS, ...(fx.drive > 0 ? ["tone"] : [])];
  for (const stage of stages) {
    if (stage !== "tone") filters[stage].gain.value = fx[stage];
    filters[stage].getFrequencyResponse(FREQS, mag, phase);
    for (let i = 0; i < POINTS; i++) total[i] += 20 * Math.log10(Math.max(mag[i], 1e-6));
  }
  return total;
}

// The take's EQ as a frequency response, with a handle on each band you can drag up and down.
export default function EqGraph({ fx, onChange, disabled }) {
  const svg = useRef(null);
  const curve = useMemo(() => responseFor(fx), [fx]);
  const path = curve ? Array.from(curve, (db, i) => `${i ? "L" : "M"} ${xOf(FREQS[i]).toFixed(1)} ${yOf(db).toFixed(1)}`).join(" ") : "";

  function drag(band, e) {
    if (disabled) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const setFrom = (clientY) => {
      const box = svg.current.getBoundingClientRect();
      const y = ((clientY - box.top) / box.height) * H;
      const db = ((H / 2 - y) / (H / 2 - 6)) * RANGE_DB;
      onChange({ [band]: Math.max(-12, Math.min(12, Math.round(db * 2) / 2)) });
    };
    const move = (ev) => setFrom(ev.clientY);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  const summary = BANDS.map((b) => `${b} ${fx[b] > 0 ? "+" : ""}${fx[b]} dB`).join(", ");
  return (
    <figure className="rw-eq" data-bypassed={disabled ? "true" : "false"} style={{ margin: 0 }}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`EQ curve: ${summary}${fx.drive > 0 ? ", with the drive's tone filter" : ""}`}>
        {[100, 1000, 10000].map((f) => (
          <g key={f}>
            <line x1={xOf(f)} x2={xOf(f)} y1={0} y2={H} className="rw-eq-grid" />
            <text x={xOf(f) + 3} y={H - 4} className="rw-eq-axis">
              {f >= 1000 ? `${f / 1000}k` : f} Hz
            </text>
          </g>
        ))}
        {[-12, -6, 6, 12].map((db) => (
          <line key={db} x1={0} x2={W} y1={yOf(db)} y2={yOf(db)} className="rw-eq-grid" />
        ))}
        <line x1={0} x2={W} y1={yOf(0)} y2={yOf(0)} className="rw-eq-zero" />
        <text x={3} y={yOf(12) - 3} className="rw-eq-axis">
          +12
        </text>
        <text x={3} y={yOf(-12) + 10} className="rw-eq-axis">
          −12
        </text>
        {path && <path d={`${path} L ${W} ${H / 2} L 0 ${H / 2} Z`} className="rw-eq-fill" />}
        {path && <path d={path} className="rw-eq-curve" data-eq-curve="true" />}
        {BANDS.map((band) => (
          <g key={band} className="rw-eq-handle" onPointerDown={(e) => drag(band, e)} data-band={band}>
            <circle cx={xOf(EQ_BANDS[band].frequency)} cy={yOf(fx[band])} r={11} fill="transparent" />
            <circle cx={xOf(EQ_BANDS[band].frequency)} cy={yOf(fx[band])} r={5} />
          </g>
        ))}
      </svg>
      <figcaption className="rw-studio-hint">
        {disabled
          ? "Bypassed: your take plays exactly as recorded."
          : `Low shelf at ${EQ_BANDS.low.frequency} Hz, mid peak at ${EQ_BANDS.mid.frequency / 1000} kHz, high shelf at ${EQ_BANDS.high.frequency / 1000} kHz${fx.drive > 0 ? `, plus the drive's ${DRIVE_TONE_HZ / 1000} kHz tone filter` : ""}. Drag a dot to change a band.`}
      </figcaption>
    </figure>
  );
}
