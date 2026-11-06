"use client";

import { useId } from "react";

const HEIGHT = 170;
const CAP = 38;
const TRAVEL = HEIGHT - CAP;
const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// A channel fader drawn like a hardware console's: a dark slot with a printed scale and a cap with
// a white line across it, and the channel's live meter beside the slot. An invisible native range
// input lies over it, so dragging, clicking, the keyboard and screen readers all work as they do
// for any slider. Values are 0-100.
// on: whether the channel is heard (lit lamp), separate from how loud its fader is.
// disabled: the fader can't do anything right now (a play mode silences its channel). describedBy
// points at the sentence saying why, so it never just looks broken.
export default function Fader({ label, value, onChange, on = null, master = false, meter = null, status = null, format = (v) => `${v}%`, disabled = false, describedBy = undefined, children }) {
  const id = useId();
  const text = format(value);
  return (
    <div className="rw-fader-strip" data-on={on === null ? undefined : on ? "true" : "false"} data-disabled={disabled ? "true" : undefined}>
      <span aria-hidden="true" className="rw-fader-lamp" title={on === null ? undefined : on ? "Heard" : "Not heard"} />
      <div className="rw-fader-body">
        <div className="rw-fader" style={{ height: HEIGHT }}>
          <Scale />
          <span aria-hidden="true" className="rw-fader-slot" style={{ top: CAP / 2 - 6, bottom: CAP / 2 - 6 }} />
          <input
            id={id}
            className="rw-fader-input"
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-valuetext={text}
            disabled={disabled}
            aria-describedby={describedBy}
          />
          <span aria-hidden="true" className="rw-fader-cap" data-master={master ? "true" : undefined} style={{ top: (1 - value / 100) * TRAVEL, height: CAP }} />
        </div>
        {meter && <div className="rw-fader-meter">{meter}</div>}
      </div>
      <output htmlFor={id} className="rw-fader-value">
        {text}
      </output>
      <div className="rw-fader-keys">{children}</div>
      <label htmlFor={id} className="rw-fader-label">
        {label}
      </label>
      {status && <span className="rw-fader-status">{status}</span>}
    </div>
  );
}

// The printed scale beside the slot: a tick every 10%, longer at 0, 50 and 100.
function Scale() {
  const y = (v) => CAP / 2 + (1 - v / 100) * TRAVEL;
  return (
    <svg aria-hidden="true" width={10} height={HEIGHT} className="rw-fader-scale">
      {TICKS.map((v) => {
        const long = v % 50 === 0;
        return <line key={v} x1={long ? 0 : 4} x2={10} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={long ? 0.9 : 0.5} strokeWidth={1} />;
      })}
    </svg>
  );
}
