"use client";

import { useRef, useState } from "react";
import Icon from "@/components/member/Icon";
import { useVisual } from "@/components/metronome/visual";
import { TEMPO_MAX, TEMPO_MIN, canSwing, meterOf, partById, setSwing, setTempo, songLength } from "@/lib/drums/beat";
import s from "./beats.module.css";

function lampOf(state) {
  if (state.status === "starting") return { lamp: "wait", text: "Starting" };
  if (state.status === "running") {
    if (state.countIn) return { lamp: "count", text: "Count-in" };
    if (state.recording) return { lamp: "rec", text: "Recording" };
    return { lamp: "play", text: "Playing" };
  }
  if (state.recording) return { lamp: "rec", text: "Ready to record" };
  if (state.ended) return { lamp: "done", text: "Song finished" };
  return { lamp: "stop", text: "Stopped" };
}

// The tempo you type: checked when you press Enter or leave the box.
function TempoField({ m }) {
  const tempo = m.beat.tempo;
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n)) setError(`Type a tempo from ${TEMPO_MIN} to ${TEMPO_MAX}.`);
    else if (n < TEMPO_MIN || n > TEMPO_MAX) {
      setError(`${TEMPO_MIN} to ${TEMPO_MAX} only, so it's set to ${n < TEMPO_MIN ? TEMPO_MIN : TEMPO_MAX}.`);
      m.edit((b) => setTempo(b, n), "tempo");
    } else {
      setError(null);
      m.edit((b) => setTempo(b, n), "tempo");
    }
    setDraft(null);
  };
  return (
    <div className={s.tempo}>
      <label className={s.tempoLabel} htmlFor="bm-tempo">
        Tempo
      </label>
      <div className={s.tempoRow}>
        <button type="button" className={s.nudge} aria-label="Slower by 1" onClick={() => m.edit((b) => setTempo(b, b.tempo - 1), "tempo")} disabled={tempo <= TEMPO_MIN}>
          −
        </button>
        <input
          id="bm-tempo"
          className={s.tempoValue}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft ?? String(tempo)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "bm-tempo-error" : "bm-tempo-unit"}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(null);
              setError(null);
            }
          }}
        />
        <button type="button" className={s.nudge} aria-label="Faster by 1" onClick={() => m.edit((b) => setTempo(b, b.tempo + 1), "tempo")} disabled={tempo >= TEMPO_MAX}>
          +
        </button>
        <button type="button" className={s.tapKey} onClick={m.tap}>
          Tap
        </button>
      </div>
      <span id="bm-tempo-unit" className={s.tempoUnit}>
        {meterOf(m.beat).pulse === "dotted" ? "BPM, counting dotted quarters" : "BPM"}
        {m.tapInfo && (m.tapInfo.bpm ? ` · tapped ${m.tapInfo.bpm}` : " · keep tapping")}
      </span>
      {error && (
        <span id="bm-tempo-error" className={s.fieldErrorDark} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default function Transport({ m, midi }) {
  const { engineState, beat } = m;
  const lamp = lampOf(engineState);
  const running = engineState.status === "running" || engineState.status === "starting";
  const readout = useRef(null);
  const songBars = songLength(beat);
  const meter = meterOf(beat);
  const swingOk = canSwing(meter);

  // Where the music is, from the audio clock: the part and the bar (and the bar of the song).
  useVisual((snap) => {
    const el = readout.current;
    if (!el) return;
    let text = "";
    if (snap) {
      if (snap.countIn) text = `Get ready: beat ${Math.floor(snap.step / meter.division) + 1}`;
      else {
        const part = partById(m.beat, snap.part);
        text = snap.songBar !== null && snap.songBar !== undefined ? `Bar ${snap.songBar + 1} of ${songBars} · ${part?.name || ""}` : `${part?.name || ""} · bar ${snap.bar + 1}`;
      }
    }
    if (el.textContent !== text) el.textContent = text;
  });

  return (
    <div className={s.transport}>
      <div className={s.statusRow}>
        <span className={s.lamp} data-lamp={lamp.lamp}>
          {lamp.text}
        </span>
        <span ref={readout} className={s.readout} />
        {midi.state.status === "on" && midi.state.devices.length > 0 && (
          <span className={s.lamp} data-lamp="midi" data-flash="midi" title={midi.state.devices.map((d) => d.name).join(", ")}>
            MIDI
          </span>
        )}
        <div className={s.statusKeys}>
          <button type="button" className={s.iconKey} onClick={m.undo} disabled={!m.canUndo} aria-keyshortcuts="Control+Z">
            Undo
          </button>
          <button type="button" className={s.iconKey} onClick={m.redo} disabled={!m.canRedo} aria-keyshortcuts="Control+Shift+Z">
            Redo
          </button>
        </div>
      </div>

      <div className={s.transportRow}>
        <div className={s.keys} data-transport-keys="">
          <button type="button" className={s.play} data-on={running ? "true" : undefined} onClick={m.toggle} aria-keyshortcuts="Space">
            <Icon name={running ? "stop" : "play"} size={20} />
            {running ? "Stop" : "Play"}
          </button>
          <button type="button" className={s.rec} aria-pressed={engineState.recording} onClick={m.toggleRecord}>
            <span className={s.recLamp} aria-hidden="true" />
            Record
          </button>
          <button
            type="button"
            className={s.clickKey}
            aria-pressed={m.prefs.click}
            aria-label="Metronome click"
            onClick={() => m.setPrefs({ click: !m.prefs.click })}
          >
            <Icon name="metronome" size={18} />
            <span className={s.clickText} aria-hidden="true">
              Click
            </span>
          </button>
        </div>

        <div className={s.modeBox}>
          <div className={s.modes} role="radiogroup" aria-label="What Play plays">
            <button type="button" role="radio" aria-checked={m.playMode === "part"} className={s.modeKey} onClick={() => m.chooseMode("part")}>
              <span className={s.modeName}>Loop part</span>
              <span className={s.modeDetail}>{m.selected.name}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={m.playMode === "song"}
              className={s.modeKey}
              onClick={() => m.chooseMode("song")}
              disabled={!songBars}
            >
              <span className={s.modeName}>Song</span>
              <span className={s.modeDetail}>{songBars ? `${songBars} bars` : "Nothing in it yet"}</span>
            </button>
          </div>
          {m.playMode === "song" && (
            <label className={s.darkCheck}>
              <input type="checkbox" checked={m.loopSong} onChange={(e) => m.setLoopSong(e.target.checked)} />
              Go round again at the end
            </label>
          )}
        </div>
      </div>

      <div className={s.feelRow}>
        <TempoField m={m} />
        <div className={s.swing} data-disabled={swingOk ? undefined : "true"}>
          <label className={s.tempoLabel} htmlFor="bm-swing">
            Swing
          </label>
          <div className={s.swingRow}>
            <input
              id="bm-swing"
              className={s.slider}
              type="range"
              min="0"
              max="100"
              step="1"
              value={swingOk ? beat.swing : 0}
              disabled={!swingOk}
              aria-valuetext={swingOk ? `${beat.swing} percent` : "Not used in this meter"}
              onChange={(e) => m.edit((b) => setSwing(b, Number(e.target.value)), "swing")}
            />
            <span className={s.swingValue}>{swingOk ? `${beat.swing}%` : "—"}</span>
          </div>
          <span className={s.tempoUnit}>
            {!swingOk ? "Built into the triplet grid of this meter" : beat.swing === 0 ? "Straight" : beat.swing >= 60 && beat.swing <= 72 ? "About a triplet feel" : `Swinging the ${beat.swingUnit === 16 ? "sixteenths" : "eighths"}`}
          </span>
        </div>
      </div>
    </div>
  );
}
