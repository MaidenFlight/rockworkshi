"use client";

import s from "./rhythm.module.css";

const ms = (sec) => Math.round(sec * 1000);

// The delay check, inside the console. Phones, Bluetooth headphones and screens each add a little
// delay between a click and a tap; twelve taps measure it and the trainer allows for it.
export default function DelayCheck({ delay, cal, running, onStart, onStop, onReset, onClose }) {
  if (cal.phase === "idle") {
    return (
      <div className={s.delayRow}>
        <p className={s.delayText}>
          Sound delay: {delay ? `${ms(delay)} ms allowed for` : "not measured"}
        </p>
        <button type="button" className={s.consoleLink} onClick={onStart} disabled={running}>
          {delay ? "Check again" : "Check it"}
        </button>
      </div>
    );
  }

  return (
    <div className={s.delayPanel} role="group" aria-label="Delay check">
      {cal.phase === "running" && (
        <>
          <p className={s.delayText}>
            Four clicks count you in. Then tap the pad (or press Space) with each of the next twelve. Keep it relaxed.
          </p>
          <p className={s.delayCount} aria-live="polite">
            {cal.taps ?? 0} {cal.taps === 1 ? "tap" : "taps"}
          </p>
          <button type="button" className={s.consoleLink} onClick={onStop}>
            Cancel
          </button>
        </>
      )}
      {cal.phase === "done" && cal.result && (
        <>
          {cal.result.ok ? (
            <p className={s.delayText} role="status">
              Your taps land {Math.abs(ms(cal.result.offset))} ms {cal.result.offset >= 0 ? "after" : "before"} the click. The trainer
              now allows for that on this device.
            </p>
          ) : cal.result.reason === "few" ? (
            <p className={s.delayText} role="status">
              Only {cal.result.count} taps landed near a click, so nothing was changed. Tap once with every click and try again.
            </p>
          ) : (
            <p className={s.delayText} role="status">
              Those taps were uneven (about ±{ms(cal.result.spread)} ms), so nothing was changed. Try again and keep it steady.
            </p>
          )}
          <div className={s.delayActions}>
            <button type="button" className={s.consoleLink} onClick={onStart}>
              Try again
            </button>
            {delay !== 0 && (
              <button type="button" className={s.consoleLink} onClick={onReset}>
                Set back to 0
              </button>
            )}
            <button type="button" className={s.consoleLink} onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
