"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CLIP_KNEE } from "@/lib/audio/mix";
import { TRAINER_CHOICES, trainerPlan, trainerSettings, trainerStatus } from "@/lib/speedTrainer";
import Icon from "../Icon";
import Meter from "./Meter";

// The speed trainer's settings from last time in this browser, or the defaults.
function storedTrainer() {
  try {
    return trainerSettings(JSON.parse(window.localStorage.getItem("rw-speed-trainer") || "null"));
  } catch {
    return trainerSettings(null);
  }
}

function clock(s) {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

// The bar that stays in reach while you scroll: play, where you are, speed, clicks, the loop,
// recording, and the master level. It sticks just under the site's own header. onOpenRecorder puts
// "Record your take" in it, so the take a student is practising towards is never one tab away.
// onStartTrainer(settings) starts the speed trainer (lib/speedTrainer.js) and resolves with a reason
// when it can't; trainer is the running one, { settings, run }, or null.
export default function Transport({
  ready,
  loadedCount,
  total,
  playing,
  recording,
  review,
  onPlayPause,
  onStep,
  hasChart,
  position,
  duration,
  where,
  speed,
  speeds,
  onSpeed,
  preparingSpeed,
  speedError,
  countIn,
  onCountIn,
  metronome,
  onMetronome,
  getBeat,
  getCountInBeat,
  loop,
  onClearLoop,
  recordTime,
  getMaster,
  onOpenRecorder = null,
  trainer = null,
  onStartTrainer = null,
  onStopTrainer = null,
}) {
  const bar = useRef(null);
  const trainerId = useId();
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [plan, setPlan] = useState(storedTrainer);
  const [trainerError, setTrainerError] = useState("");
  const [starting, setStarting] = useState(false);

  async function startTrainer() {
    setTrainerError("");
    setStarting(true);
    try {
      setTrainerError((await onStartTrainer(plan)) || "");
    } finally {
      setStarting(false);
    }
  }
  const beatDots = useRef(null);
  const countDots = useRef(null);
  const [top, setTop] = useState(0);
  const [away, setAway] = useState(false); // scrolled out of sight (only matters on a phone)
  const [notice, setNotice] = useState("");
  const [shownSpeed, setShownSpeed] = useState(speed);
  // Say what changed when the speed does, then let it go.
  if (shownSpeed !== speed) {
    setShownSpeed(speed);
    setNotice(speed === 1 ? "Back to full speed" : `Now ${Math.round(speed * 100)}% · same pitch, slower tempo`);
  }
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(id);
  }, [notice]);

  // Stick under the site header, whatever height it is at this width.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    // The observer reports once straight away, then on every change.
    const watch = new ResizeObserver(() => setTop(header.getBoundingClientRect().height));
    watch.observe(header);
    return () => watch.disconnect();
  }, []);

  // On a phone the compact bar appears while the transport itself is off screen.
  useEffect(() => {
    const watch = new IntersectionObserver(([entry]) => setAway(!entry.isIntersecting));
    watch.observe(bar.current);
    return () => watch.disconnect();
  }, []);

  // The beat lights follow the song's own clock: the metronome's beat while playing, and the
  // count-in's four clicks before the music starts.
  useEffect(() => {
    if (!playing) {
      light(beatDots.current, -1);
      light(countDots.current, -1);
      return;
    }
    let frame = requestAnimationFrame(function step() {
      const counting = getCountInBeat();
      light(countDots.current, counting);
      light(beatDots.current, counting < 0 && metronome ? getBeat() : -1);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, metronome, getBeat, getCountInBeat]);

  const sectionDone = where ? (where.bar - 1) / where.bars : 0;

  return (
    <div ref={bar} className="rw-transport" style={{ top }} data-recording={recording ? "true" : "false"}>
      <div className="rw-tp-row">
        <div role="group" aria-label="Transport" className="rw-tp-keys">
          <button type="button" className="rw-tp-key" onClick={() => onStep(-1)} disabled={!ready || recording} aria-label={hasChart ? "Previous bar" : "Back 5 seconds"} title={hasChart ? "Previous bar (←)" : "Back 5 seconds (←)"}>
            <Icon name="bar-back" size={18} />
          </button>
          <button type="button" className="rw-tp-play" onClick={onPlayPause} disabled={!ready || recording} title="Play or pause (Space)" data-playing={playing ? "true" : "false"}>
            <Icon name={playing ? "pause" : "play"} size={18} />
            {!ready ? `Loading ${loadedCount}/${total}` : playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="rw-tp-key" onClick={() => onStep(1)} disabled={!ready || recording} aria-label={hasChart ? "Next bar" : "Forward 5 seconds"} title={hasChart ? "Next bar (→)" : "Forward 5 seconds (→)"}>
            <Icon name="bar-forward" size={18} />
          </button>
        </div>

        <div className="rw-tp-clock">
          <span className="rw-tp-time">
            <span className="rw-tp-now" data-time-now="true">{clock(position)}</span>
            <span className="rw-tp-total">/ {clock(duration)}</span>
          </span>
          <span className="rw-tp-state" data-state={recording ? "rec" : playing ? "playing" : "paused"}>
            {!ready ? "Loading the band" : recording ? "Recording" : playing ? (speed < 1 ? `Playing at ${Math.round(speed * 100)}%` : "Playing") : "Paused"}
          </span>
        </div>

        {where && (
          <div className="rw-tp-where" data-where="true">
            <span className="rw-tp-section">{where.section}</span>
            <span className="rw-tp-bar">
              Bar {where.bar} of {where.bars}
            </span>
            <span className="rw-tp-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${sectionDone})` }} />
            </span>
          </div>
        )}

        {recording && (
          <div className="rw-tp-rec" role="status" data-rec-timer="true">
            <span className="rw-rec-dot" aria-hidden="true" />
            Recording <span style={{ fontVariantNumeric: "tabular-nums" }}>{clock(recordTime)}</span>
          </div>
        )}

        {onOpenRecorder && !recording && (
          <button type="button" className="rw-btn rw-tp-take" onClick={onOpenRecorder}>
            <Icon name="record" size={14} />
            Record your take
          </button>
        )}

        <div className="rw-tp-master">
          <Meter getNodes={getMaster} active={playing} vertical={false} length={92} thickness={5} clipAt={CLIP_KNEE} clipLabel="Clip guard" title="Master level, left and right" />
        </div>
      </div>

      {!review && (
        <div className="rw-tp-row rw-tp-practice">
          <div role="group" aria-label="Speed" className="rw-tp-group">
            <span className="rw-tp-label">Speed</span>
            <span className="rw-seg">
              {speeds.map((s) => (
                <button key={s} type="button" onClick={() => onSpeed(s)} disabled={!ready || recording || preparingSpeed} aria-pressed={speed === s}>
                  {Math.round(s * 100)}%
                </button>
              ))}
            </span>
            {/* The trainer plays between the keys' speeds (70%, 80%), so the speed is said here then. */}
            {!speeds.includes(speed) && <span className="rw-tp-speed-now">Now {Math.round(speed * 100)}%</span>}
            {onStartTrainer && (
              <button
                type="button"
                className="rw-toggle rw-tp-trainer-key"
                data-running={trainer ? "true" : "false"}
                onClick={() => setTrainerOpen((open) => !open)}
                aria-expanded={trainerOpen}
                aria-controls={trainerId}
                disabled={recording}
                title="Repeat the loop, a little faster every few passes"
              >
                Speed trainer
              </button>
            )}
          </div>

          <div role="group" aria-label="Clicks" className="rw-tp-group">
            <button type="button" className="rw-toggle" onClick={onCountIn} disabled={recording || !hasChart} aria-pressed={countIn} title="A bar of clicks before the music starts">
              Count-in
            </button>
            <span ref={countDots} className="rw-beats" data-kind="count" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} />
              ))}
            </span>
            <button type="button" className="rw-toggle" onClick={onMetronome} disabled={recording || !hasChart} aria-pressed={metronome} title="A click on every beat">
              Metronome
            </button>
            <span ref={beatDots} className="rw-beats" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} />
              ))}
            </span>
          </div>

          {loop && (
            <div className="rw-tp-group rw-tp-loop" data-loop-chip="true">
              <Icon name="loop" size={15} />
              <span>{loop.end != null ? `Repeating ${clock(loop.start)}–${clock(loop.end)}` : `Loop from ${clock(loop.start)}: set the end`}</span>
              <button type="button" className="rw-tp-x" onClick={onClearLoop} disabled={recording} aria-label="Clear the loop" title="Clear the loop (\)">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {onStartTrainer && (
        <div id={trainerId} className="rw-tp-row rw-tp-trainer" role="group" aria-label="Speed trainer" hidden={!trainerOpen}>
          {trainer ? (
            <>
              <span className="rw-tp-trainer-now">
                <span className="rw-tp-trainer-lamp" aria-hidden="true" />
                {trainerStatus(trainer.settings, trainer.run)}
              </span>
              <span className="rw-tp-trainer-plan">{trainerPlan(trainer.settings)}</span>
              <button type="button" className="rw-btn rw-tp-trainer-stop" onClick={onStopTrainer}>
                <Icon name="stop" size={12} />
                Stop trainer
              </button>
            </>
          ) : (
            <>
              <TrainerChoice label="Start" value={plan.start} options={TRAINER_CHOICES.start} format={(n) => `${n}%`} onChange={(start) => setPlan((p) => trainerSettings({ ...p, start }))} />
              <TrainerChoice label="Step" value={plan.step} options={TRAINER_CHOICES.step} format={(n) => `+${n}%`} onChange={(step) => setPlan((p) => trainerSettings({ ...p, step }))} />
              <TrainerChoice
                label="Passes each"
                value={plan.passes}
                options={TRAINER_CHOICES.passes}
                format={(n) => `${n}`}
                onChange={(passes) => setPlan((p) => trainerSettings({ ...p, passes }))}
              />
              <TrainerChoice
                label="Up to"
                value={plan.top}
                options={TRAINER_CHOICES.top.filter((n) => n >= plan.start)}
                format={(n) => `${n}%`}
                onChange={(top) => setPlan((p) => trainerSettings({ ...p, top }))}
              />
              <button type="button" className="rw-btn rw-btn-primary rw-tp-trainer-go" onClick={startTrainer} disabled={!ready || recording || starting}>
                {starting ? "Starting…" : "Start trainer"}
              </button>
              <span className="rw-tp-trainer-plan">Repeats the loop, then speeds up. It stops at your top speed.</span>
              {trainerError && (
                <span role="alert" className="rw-tp-trainer-error">
                  {trainerError}
                </span>
              )}
            </>
          )}
        </div>
      )}

      <div className="rw-tp-notice" role="status" aria-live="polite">
        {preparingSpeed ? "Getting slow playback ready…" : speedError || notice}
      </div>

      <div className="rw-mini" hidden={!away} data-recording={recording ? "true" : "false"}>
        <button type="button" className="rw-mini-play" onClick={onPlayPause} disabled={!ready || recording} aria-label={playing ? "Pause" : "Play"}>
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <span className="rw-mini-time">{clock(position)}</span>
        <span className="rw-mini-where">{recording ? `Recording ${clock(recordTime)}` : where ? `${where.section} · bar ${where.bar} of ${where.bars}` : `of ${clock(duration)}`}</span>
      </div>
    </div>
  );
}

// One of the trainer's settings: a label over a short list of choices.
function TrainerChoice({ label, value, options, format, onChange }) {
  return (
    <label className="rw-tp-trainer-field">
      <span className="rw-tp-label">{label}</span>
      <select className="rw-console-input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((n) => (
          <option key={n} value={n}>
            {format(n)}
          </option>
        ))}
      </select>
    </label>
  );
}

function light(dots, index) {
  if (!dots) return;
  [...dots.children].forEach((d, i) => (d.dataset.on = i === index ? "true" : i < index && dots.dataset.kind === "count" ? "past" : "false"));
}
