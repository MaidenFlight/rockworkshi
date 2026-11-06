"use client";

import { useEffect, useRef, useState } from "react";
import { measure } from "@/lib/audio/meters";
import { drawPeaks } from "@/lib/audio/peaks";
import Icon from "../Icon";
import TapeDeck, { deckKey } from "../TapeDeck";
import Meter from "./Meter";

const NUDGE_LIMIT_MS = 300;

function clock(s, tenths = false) {
  const t = Math.max(0, s || 0);
  const whole = Math.floor(t);
  const base = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  return tenths ? `${base}.${Math.floor((t - whole) * 10)}` : base;
}

// Whether the browser will let this page use the mic, as far as it says. Not every browser does.
function useMicPermission() {
  const [state, setState] = useState("unknown");
  useEffect(() => {
    let status = null;
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "microphone" })
      .then((s) => {
        if (cancelled) return;
        status = s;
        setState(s.state);
        s.onchange = () => setState(s.state);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);
  return state;
}

// Recording around the tape deck: what state you're in, the mic, a level check before you
// commit, and your take once it's down.
export default function RecordPanel({
  ready,
  playing,
  recording,
  monitoring,
  take,
  takePeaks,
  takeStart,
  position,
  duration,
  recordTime,
  getPosition,
  getMic,
  micLevel,
  micLabel,
  micError,
  onRecord,
  onStop,
  onCheckMic,
  onStopCheck,
  nudgeMs,
  onNudge,
  onSend,
  sendProgress,
  sendError,
  onDownload,
  exporting,
  onDelete,
  takeName,
  takeInput,
  nextTakeName,
  onRename,
  onPlayTake,
}) {
  const permission = useMicPermission();
  const listening = monitoring || recording;

  // While only checking the mic, the deck's VU meter reads the mic's analyser directly.
  useEffect(() => {
    if (!monitoring || recording) return;
    const scratch = new Float32Array(1024);
    let frame = requestAnimationFrame(function step() {
      const node = getMic()[0];
      if (node) micLevel.current = measure(node, scratch).rms;
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [monitoring, recording, getMic, micLevel]);

  const countingIn = recording && playing && recordTime < 0.05;
  const state = recording
    ? countingIn
      ? { id: "count", text: "Count-in", icon: "record" }
      : { id: "rec", text: `Recording ${clock(recordTime, true)}`, icon: "record" }
    : monitoring
      ? { id: "check", text: "Checking your mic", icon: "mic" }
      : take && playing
        ? { id: "playback", text: "Playing back with your take", icon: "play" }
        : take
          ? { id: "take", text: "Take ready to hear", icon: "check" }
          : { id: "ready", text: "Ready to record", icon: "mic" };

  const mic = micError
    ? { tone: "bad", text: micError }
    : permission === "denied"
      ? { tone: "bad", text: "The mic is blocked for this site. Allow it in your browser's site settings, then try again." }
      : micLabel
        ? { tone: "ok", text: `Mic: ${micLabel}` }
        : permission === "granted"
          ? { tone: "ok", text: "Mic allowed. It opens when you record or check it." }
          : { tone: "ask", text: "Your browser will ask to use the mic the first time you record or check it." };

  return (
    <div className="rw-record">
      <div className="rw-rec-status" data-rec-state={state.id} role="status" aria-live="polite">
        <span className="rw-rec-pill">
          <Icon name={state.icon} size={13} />
          {state.text}
        </span>
        <span className="rw-rec-mic" data-tone={mic.tone}>
          {mic.text}
        </span>
      </div>

      <TapeDeck
        getPosition={getPosition}
        position={position}
        duration={duration}
        running={playing}
        recording={recording}
        listening={listening}
        level={micLevel}
        label={take && !recording ? takeName : nextTakeName}
      >
        <button type="button" className="rw-deck-key" onClick={recording ? onStop : onRecord} disabled={!ready} style={deckKey(recording)}>
          <span style={{ display: "inline-flex", color: recording ? "var(--rw-ink)" : "var(--rw-orange)" }}>
            <Icon name={recording ? "stop" : "record"} size={14} />
          </span>
          {recording ? "Stop" : take ? "Record again" : "Record"}
        </button>
      </TapeDeck>

      <div className="rw-rec-level">
        <div className="rw-rec-level-head">
          <span className="rw-studio-label">Mic level</span>
          {!recording && (
            <button type="button" className="rw-toggle" onClick={monitoring ? onStopCheck : onCheckMic} disabled={!ready} aria-pressed={monitoring}>
              {monitoring ? "Stop checking" : "Check mic"}
            </button>
          )}
        </div>
        <Meter getNodes={getMic} active={listening} vertical={false} length={260} thickness={8} clipAt={0.99} clipLabel="Too loud" title="Mic level" />
        <div className="rw-meter-scale" aria-hidden="true">
          {["-48", "-36", "-24", "-12", "0 dB"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="rw-studio-hint">
          {listening
            ? "Play your loudest part. Aim for the gold zone; if Too loud lights, back off the mic or turn its input down."
            : "Starts from the current position at full speed, and plays straight through any loop. Wear headphones so the mic only hears you."}
        </p>
      </div>

      {take && !recording && (
        <div className="rw-take" data-take="true">
          <div className="rw-take-head">
            <span className="rw-studio-label">{takeName}</span>
            <span className="rw-take-meta">
              {clock(take.buffer.duration, true)} long · starts at {clock(Math.max(0, takeStart))}
            </span>
          </div>
          <TakeWave peaks={takePeaks} position={position} start={takeStart} length={take.buffer.duration} />

          <div className="rw-take-row">
            <button type="button" className="rw-btn rw-btn-primary" onClick={onPlayTake} disabled={!ready}>
              <Icon name={playing ? "pause" : "play"} size={14} />
              {playing ? "Pause" : "Play your take"}
            </button>
            <label className="rw-take-name">
              <span>Name</span>
              <input
                className="rw-field"
                value={takeInput}
                placeholder={takeName}
                maxLength={30}
                onChange={(e) => onRename(e.target.value)}
                aria-label="Name this take"
              />
            </label>
          </div>

          <label className="rw-nudge">
            <span className="rw-nudge-head">
              <span>Line up your take</span>
              <output>{nudgeMs > 0 ? `${nudgeMs} ms earlier` : nudgeMs < 0 ? `${-nudgeMs} ms later` : "as recorded"}</output>
            </span>
            <input type="range" className="rw-range" min={-NUDGE_LIMIT_MS} max={NUDGE_LIMIT_MS} step={5} value={nudgeMs} onChange={(e) => onNudge(Number(e.target.value))} />
          </label>

          <div className="rw-take-actions">
            {onSend && (
              <button type="button" className="rw-btn rw-btn-primary" onClick={onSend} disabled={sendProgress !== null}>
                {sendProgress !== null ? `Sending ${Math.round(sendProgress * 100)}%` : "Send to your teacher"}
              </button>
            )}
            <button type="button" className="rw-btn" onClick={onDownload} disabled={exporting}>
              {exporting ? "Preparing…" : "Download mix (.wav)"}
            </button>
            <button type="button" className="rw-btn rw-btn-quiet" onClick={onDelete}>
              Delete take
            </button>
          </div>
          {sendError && (
            <p role="alert" className="rw-studio-error">
              {sendError}
            </p>
          )}
          <p className="rw-studio-hint">
            {onSend ? "Until you send it, your take" : "Your take"} stays on this device. Leaving the page deletes it, so download it first if you want to keep it.
          </p>
        </div>
      )}
    </div>
  );
}

// The take's own waveform, with a marker where the song is in it.
function TakeWave({ peaks, position, start, length }) {
  const canvas = useRef(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(el.clientWidth * ratio));
      el.height = Math.max(1, Math.round(el.clientHeight * ratio));
      drawPeaks(el, peaks, { color: getComputedStyle(el).color, span: length });
    };
    draw();
    const watch = new ResizeObserver(draw);
    watch.observe(el);
    return () => watch.disconnect();
  }, [peaks, length]);
  const at = (position - start) / length;
  return (
    <div className="rw-take-wave">
      <canvas ref={canvas} data-take-wave={peaks ? "drawn" : "empty"} />
      {at >= 0 && at <= 1 && <span aria-hidden="true" className="rw-take-head-line" style={{ left: `${at * 100}%` }} />}
    </div>
  );
}
