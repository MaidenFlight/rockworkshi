"use client";

import { useId, useState } from "react";
import Icon from "@/components/member/Icon";
import { TEMPO_MAX, TEMPO_MIN, cycleAccent, maxTempo, setTempo } from "@/lib/metronome/config";
import { NOTES, pulseNote } from "@/lib/metronome/rhythm";
import { builderStages } from "@/lib/metronome/training";
import BeatCells from "./BeatCells";
import NoteValue, { PULSE_SYMBOL } from "./NoteValue";
import { useVisual } from "./visual";
import s from "./metronome.module.css";

export function clock(seconds) {
  const t = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

// The slow-moving part of a snapshot: things that change once a bar or once a second. These go
// through React state; the per-beat lights don't.
function coarse(snap) {
  if (!snap || snap.waiting) return null;
  return {
    running: Boolean(snap.running),
    bar: snap.bar ?? null,
    countIn: Boolean(snap.countIn),
    countInBar: snap.countInBar ?? null,
    countInBars: snap.countInBars ?? 0,
    second: Math.floor(snap.elapsed ?? 0),
    left: snap.timerLeft == null ? null : Math.ceil(snap.timerLeft),
    phase: snap.phase ?? null,
    tempo: snap.tempo ?? null,
    stage: snap.builder ? snap.builder.stage : null,
    stages: snap.builder ? snap.builder.stages.length : null,
    builderLeft: snap.builder ? snap.builder.barsLeft : null,
    nextTempo: snap.builder ? snap.builder.nextTempo : null,
    holding: snap.builder ? snap.builder.holding : false,
    silentLeft: snap.silent ? snap.silent.barsLeft : null,
    silentPos: snap.silent ? snap.silent.pos : null,
  };
}

const sameCoarse = (a, b) => (a === b ? true : Boolean(a && b) && Object.keys(a).every((k) => a[k] === b[k]));

export function useLive() {
  const [live, setLive] = useState(null);
  useVisual((snap) => {
    const next = coarse(snap);
    setLive((prev) => (sameCoarse(prev, next) ? prev : next));
  });
  return live;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What the state lamp says, from the engine's state and the latest snapshot.
function describeState(engineState, live) {
  const { status } = engineState;
  if (status === "starting") return { text: "Starting", lamp: "wait" };
  if (status === "running") {
    if (!live) return { text: "Starting", lamp: "wait" };
    if (live.countIn) return { text: `Count-in ${live.countInBar} of ${live.countInBars}`, lamp: "count" };
    if (live.phase === "rest") return { text: "Silent bar", lamp: "rest" };
    return { text: "Playing", lamp: "play" };
  }
  if (status === "interrupted") return { text: "Interrupted", lamp: "alert" };
  if (status === "error") return { text: "No sound", lamp: "alert" };
  if (engineState.ended === "target") return { text: "Finished at the target", lamp: "done" };
  if (engineState.ended === "timer") return { text: "Time's up", lamp: "done" };
  return { text: "Stopped", lamp: "off" };
}

export default function Console({ m, size, onToggleFocus, onEditTraining }) {
  const { config, engineState, muted, prefs } = m;
  const live = useLive();
  const hintId = useId();
  const tempoHelpId = useId();
  const status = engineState.status;
  const active = status === "running" || status === "starting";
  const state = describeState(engineState, live);
  const builderOn = config.training.mode === "builder";
  const note = pulseNote(config.meter);
  const shownTempo = builderOn ? (status === "running" && live?.tempo ? live.tempo : config.training.builder.start) : config.tempo;
  const top = maxTempo(config);
  const timer = config.practice.timerMinutes;
  const polyOn = config.advanced.poly.on;

  const nudge = (delta) => m.change((c) => setTempo(c, c.tempo + delta));
  const commit = (value) => m.change((c) => setTempo(c, value));

  return (
    <div className={s.console} data-size={size}>
      <div className={s.statusRow}>
        <span className={s.lamp} data-lamp={state.lamp}>
          {state.text}
        </span>
        <span className={s.readout}>
          <span>{live && !live.countIn && live.bar !== null ? `Bar ${live.bar + 1}` : "Bar –"}</span>
          <span className={s.readoutTime}>{clock(live?.second ?? 0)}</span>
          {timer > 0 && (
            <span className={s.readoutTimer}>
              {engineState.timerDone ? "Time's up, still playing" : live?.left != null ? `${clock(live.left)} left` : `${timer}-minute timer`}
            </span>
          )}
        </span>
        {engineState.pending === "bar" && <span className={s.pending}>Your change starts at the next bar</span>}
        <span className={s.statusKeys}>
          {prefs.visualOnly ? (
            <span className={s.chip}>Visual only</span>
          ) : (
            <button type="button" className={s.iconKey} aria-pressed={muted} onClick={() => m.setMuted(!muted)} title="Mute">
              <Icon name={muted ? "sound-off" : "sound-on"} size={18} />
              <span className={s.iconKeyText}>Mute</span>
            </button>
          )}
          <button type="button" className={s.iconKey} onClick={onToggleFocus} title={size === "focus" ? "Exit focus view" : "Focus view"}>
            <Icon name={size === "focus" ? "collapse" : "expand"} size={18} />
            <span className={s.iconKeyText}>{size === "focus" ? "Exit focus" : "Focus"}</span>
          </button>
        </span>
      </div>

      <div className={s.tempo}>
        <div className={s.tempoLine}>
          <span className={s.tempoNote}>
            <NoteValue {...PULSE_SYMBOL[note]} height={size === "focus" ? 64 : 40} />
            <span aria-hidden="true">=</span>
          </span>
          <TempoInput
            value={shownTempo}
            max={top}
            disabled={builderOn}
            noteName={NOTES[note].plural}
            describedBy={tempoHelpId}
            onCommit={commit}
            onNudge={nudge}
          />
          <span className={s.tempoUnit}>
            <span className={s.tempoBpm}>BPM</span>
            <span className={s.tempoNoteName}>{NOTES[note].plural} per minute</span>
          </span>
        </div>
        <div className={s.nudges}>
          {[-5, -1].map((d) => (
            <button key={d} type="button" className={s.nudge} onClick={() => nudge(d)} disabled={builderOn || config.tempo <= TEMPO_MIN} aria-label={`${-d} BPM slower`}>
              −{-d}
            </button>
          ))}
          <input
            type="range"
            className={s.slider}
            min={TEMPO_MIN}
            max={top}
            step={1}
            value={Math.min(shownTempo, top)}
            disabled={builderOn}
            onChange={(e) => commit(Number(e.target.value))}
            aria-label="Tempo"
            aria-valuetext={`${shownTempo} ${NOTES[note].plural} per minute`}
          />
          {[1, 5].map((d) => (
            <button key={d} type="button" className={s.nudge} onClick={() => nudge(d)} disabled={builderOn || config.tempo >= top} aria-label={`${d} BPM faster`}>
              +{d}
            </button>
          ))}
        </div>
        <p className={s.tempoHelp} id={tempoHelpId}>
          {builderOn ? (
            <>
              The tempo builder is setting the tempo.{" "}
              <button type="button" className={s.inlineLink} onClick={onEditTraining}>
                Change it in Training
              </button>
            </>
          ) : active ? (
            polyOn ? "A new tempo starts at the next bar, so both layers stay together." : "A new tempo starts on the next beat."
          ) : top < TEMPO_MAX ? (
            `Up to ${top} with this subdivision.`
          ) : (
            `${TEMPO_MIN} to ${TEMPO_MAX}. Type a number, use the buttons, or tap.`
          )}
        </p>
        {m.notice && (
          <p className={s.notice} role="status">
            {m.notice}
          </p>
        )}
      </div>

      <BeatCells config={config} onCycle={(i) => m.change((c) => cycleAccent(c, i))} hintId={hintId} size={size} />
      <p className={s.cellHint} id={hintId}>
        Press a beat to change it: Strong, Normal, Silent. Silent beats keep their place in time.
      </p>

      {config.training.mode !== "off" && <TrainingStrip config={config} live={status === "running" ? live : null} />}

      {(status === "error" || status === "interrupted") && engineState.error && (
        <p className={s.alert} role="alert">
          {engineState.error}
        </p>
      )}
      {status === "idle" && engineState.error && (
        <p className={s.alert} role="alert">
          {engineState.error}
        </p>
      )}
      {status === "running" && engineState.slipped && (
        <p className={s.softAlert} role="status">
          The browser paused this page for a moment, so a few clicks were skipped. The beat stayed in time.
        </p>
      )}

      <div className={s.transport}>
        {status === "interrupted" ? (
          <>
            <button type="button" className={s.play} onClick={m.resume}>
              <Icon name="play" size={20} />
              Resume
            </button>
            <button type="button" className={s.tap} onClick={m.stop}>
              Stop
            </button>
          </>
        ) : (
          <>
            <button type="button" className={s.play} data-on={active ? "true" : undefined} onClick={active ? m.stop : m.start} aria-keyshortcuts="Space">
              <Icon name={active ? "stop" : "play"} size={20} />
              {active ? "Stop" : "Start"}
            </button>
            <button type="button" className={s.tap} onClick={m.tap} disabled={builderOn} aria-keyshortcuts="T" aria-describedby={`${hintId}-tap`}>
              Tap
            </button>
          </>
        )}
      </div>
      <p className={s.tapLine} id={`${hintId}-tap`}>
        {m.tapInfo
          ? m.tapInfo.bpm
            ? `${m.tapInfo.bpm} from ${m.tapInfo.taps} taps. Keep tapping to refine it.`
            : "Keep tapping in time…"
          : "Tap along on a song to find its tempo."}
        <span className={s.keysHint}> Keys: Space starts and stops, T taps.</span>
      </p>
    </div>
  );
}

// The big tempo number, typed into directly. It checks the number when you leave the field or
// press Enter; arrow keys step by 1 (Shift: 5).
function TempoInput({ value, max, disabled, noteName, describedBy, onCommit, onNudge }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const errorId = useId();

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (!/^\d{1,3}$/.test(text)) {
      setError(`Type a tempo from ${TEMPO_MIN} to ${max}.`);
      return;
    }
    const n = Number(text);
    if (n < TEMPO_MIN) setError(`${TEMPO_MIN} is the slowest, so the tempo is ${TEMPO_MIN}.`);
    else if (n > max) setError(max < TEMPO_MAX ? `${max} is the fastest with this subdivision, so the tempo is ${max}.` : `${TEMPO_MAX} is the fastest, so the tempo is ${TEMPO_MAX}.`);
    else setError("");
    onCommit(Math.min(max, Math.max(TEMPO_MIN, n)));
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setDraft(null);
      setError("");
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setDraft(null);
      setError("");
      onNudge((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 5 : 1));
    }
  }

  return (
    <span className={s.tempoField}>
      <label className={s.srOnly} htmlFor={`${errorId}-in`}>
        Tempo, in {noteName} per minute
      </label>
      <input
        id={`${errorId}-in`}
        className={s.tempoValue}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        autoComplete="off"
        value={draft ?? String(value)}
        style={{ width: `${Math.max(2, (draft ?? String(value)).length) + 0.2}ch` }}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value.replace(/\D/g, ""));
          setError("");
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(" ")}
      />
      {error && (
        <span className={s.fieldError} id={errorId} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

// The training mode's live state, inside the console where it can be seen while playing.
function TrainingStrip({ config, live }) {
  if (config.training.mode === "builder") {
    const b = config.training.builder;
    const stages = builderStages(b);
    let detail;
    if (live?.countIn) {
      detail = `Stage 1, at ${stages[0]}, starts after the count-in`;
    } else if (!live || live.stage === null) {
      detail = `${b.start} to ${b.target} in ${plural(stages.length, "stage")}, ${plural(b.bars, "bar")} each`;
    } else if (live.holding) {
      detail = `At the target, ${live.tempo}. Holding it.`;
    } else if (live.nextTempo === null) {
      detail = `At the target, ${live.tempo}. Stops in ${plural(live.builderLeft, "bar")}.`;
    } else {
      detail = `${live.nextTempo} in ${plural(live.builderLeft, "bar")}`;
    }
    const current = live && live.stage !== null ? live.stage : -1;
    return (
      <div className={s.strip}>
        <span className={s.stripName}>Tempo builder</span>
        <span className={s.stripState}>{live?.countIn ? "Count-in" : current >= 0 ? `Stage ${current + 1} of ${stages.length}` : "Ready"}</span>
        <span className={s.stripDetail}>{detail}</span>
        <ol className={s.ladder} aria-label="Stages">
          {stages.map((t, i) => (
            <li key={`${i}-${t}`} data-state={i === current ? "now" : i < current ? "done" : undefined}>
              {t}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const sl = config.training.silent;
  const length = sl.play + sl.rest;
  let detail;
  if (live?.countIn) detail = "The cycle starts after the count-in";
  else if (!live || live.silentPos === null) detail = `${plural(sl.play, "bar")} with the click, then ${plural(sl.rest, "bar")} silent`;
  else if (live.phase === "rest") detail = `${plural(live.silentLeft, "silent bar")} left. Keep the beat going.`;
  else detail = live.silentLeft === 1 ? "Silent from the next bar" : `${plural(live.silentLeft, "bar")} with the click`;
  return (
    <div className={s.strip}>
      <span className={s.stripName}>Silent bars</span>
      <span className={s.stripState}>
        {live?.countIn ? "Count-in" : live && live.silentPos !== null ? (live.phase === "rest" ? "Silent" : "Click on") : "Ready"}
      </span>
      <span className={s.stripDetail}>{detail}</span>
      <ol className={s.cycle} aria-label="The cycle of bars">
        {Array.from({ length }, (_, i) => (
          <li key={i} data-kind={i < sl.play ? "play" : "rest"} data-state={live && live.silentPos === i ? "now" : undefined}>
            <span className={s.srOnly}>{i < sl.play ? "Click" : "Silent"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
