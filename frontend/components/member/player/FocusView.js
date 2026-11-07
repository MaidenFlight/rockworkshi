"use client";

import { useEffect, useRef } from "react";
import ChordChart from "../ChordChart";
import Icon from "../Icon";
import s from "./FocusView.module.css";

function clock(t) {
  const whole = Math.max(0, Math.floor(t || 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// The player for when the screen is across the room and both hands are on the instrument: a native
// <dialog> filling the screen, like the metronome's focus view, with what to play at its largest and
// only the keys a practice needs, each big enough to hit from a step away. It's drawn inside the
// player, so it is the same player: the song keeps going when it opens or closes.
// chart: the props for ChordChart (chart, myPart, instrument, partAvailable, loop, onSeek, onLoopSection).
// While it's open the screen is kept awake where the browser allows it.
export default function FocusView({
  open,
  onClose,
  title,
  chart,
  position,
  where,
  ready,
  playing,
  recording,
  recordTime,
  onPlayPause,
  onStep,
  speed,
  speeds,
  onSpeed,
  preparingSpeed,
  loop,
  onLoopHere,
  onClearLoop,
  onRecord,
  onStopRecording,
  status,
}) {
  const dialog = useRef(null);
  const playKey = useRef(null);
  const opener = useRef(null);

  // Opens on Play, so Space or Enter starts the song at once, and gives focus back to whatever opened
  // it (the transport's Focus key when the opener is gone or unknown).
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
      playKey.current?.focus();
    }
    if (!open && d.open) d.close();
    if (!open && opener.current) {
      const back = opener.current !== document.body && opener.current.isConnected ? opener.current : document.querySelector(".rw-tp-focus");
      opener.current = null;
      back?.focus();
    }
  }, [open]);

  // A screen that dims and locks mid-song is no use across the room. Released on close, and taken
  // again when the page comes back into view (browsers drop it when it's hidden).
  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !navigator.wakeLock) return;
    let lock = null;
    let done = false;
    const take = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (done) l.release();
          else lock = l;
        })
        .catch(() => {});
    take();
    const again = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", again);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", again);
      lock?.release().catch(() => {});
    };
  }, [open]);

  const looping = loop?.end != null;

  return (
    <dialog ref={dialog} className={s.dialog} aria-label="Focus view" onClose={onClose}>
      {open && (
        <div className={s.stage}>
          <header className={s.head}>
            <div className={s.where}>
              <span className={s.song}>{title}</span>
              <span className={s.place}>{where ? `${where.section} · bar ${where.bar} of ${where.bars}` : "Get ready"}</span>
            </div>
            <span className={s.clock} aria-label={`At ${clock(position)}`}>
              {clock(position)}
            </span>
            <button type="button" className={s.exit} onClick={onClose}>
              <Icon name="collapse" size={18} />
              Exit focus
            </button>
          </header>

          <div className={s.chart}>
            <ChordChart {...chart} position={position} disabled={!ready || recording} stage />
          </div>

          <footer className={s.keys}>
            <div role="group" aria-label="Transport" className={s.transport}>
              <button type="button" className={s.key} onClick={() => onStep(-1)} disabled={!ready || recording} aria-label="Previous bar">
                <Icon name="bar-back" size={26} />
              </button>
              <button ref={playKey} type="button" className={s.play} onClick={onPlayPause} disabled={!ready || recording}>
                <Icon name={playing ? "pause" : "play"} size={26} />
                {playing ? "Pause" : "Play"}
              </button>
              <button type="button" className={s.key} onClick={() => onStep(1)} disabled={!ready || recording} aria-label="Next bar">
                <Icon name="bar-forward" size={26} />
              </button>
            </div>

            <div className={s.group}>
              {looping ? (
                <button type="button" className={s.wide} data-on="true" onClick={onClearLoop} disabled={recording}>
                  <Icon name="loop" size={20} />
                  <span>
                    Repeating {clock(loop.start)}–{clock(loop.end)}
                    <span className={s.sub}>Stop repeating</span>
                  </span>
                </button>
              ) : (
                <button type="button" className={s.wide} onClick={onLoopHere} disabled={!ready || recording}>
                  <Icon name="loop" size={20} />
                  Loop this section
                </button>
              )}
            </div>

            <div role="group" aria-label="Speed" className={s.group}>
              <span className={s.label}>Speed</span>
              <span className={s.seg}>
                {speeds.map((v) => (
                  <button key={v} type="button" onClick={() => onSpeed(v)} disabled={!ready || recording || preparingSpeed} aria-pressed={speed === v}>
                    {Math.round(v * 100)}%
                  </button>
                ))}
              </span>
              {!speeds.includes(speed) && <span className={s.now}>Now {Math.round(speed * 100)}%</span>}
            </div>

            {onRecord && (
              <button type="button" className={s.rec} data-recording={recording ? "true" : "false"} onClick={recording ? onStopRecording : onRecord} disabled={!ready}>
                <Icon name={recording ? "stop" : "record"} size={18} />
                {recording ? `Stop · ${clock(recordTime)}` : "Record"}
              </button>
            )}

            {status && (
              <p className={s.status} role="status">
                {status}
              </p>
            )}
          </footer>
        </div>
      )}
    </dialog>
  );
}
