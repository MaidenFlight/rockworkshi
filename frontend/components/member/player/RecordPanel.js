"use client";

import { useEffect, useRef, useState } from "react";
import { measure } from "@/lib/audio/meters";
import { drawPeaks } from "@/lib/audio/peaks";
import { requirementWords } from "@/lib/months";
import { isWeeklyAssessment } from "@/lib/takeRules";
import { keptWhen } from "@/lib/takeStore";
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
// commit, and your take once it's down. keep says where an unsent take is (StemPlayer's keepKey):
// undefined when this player doesn't keep takes, so it lasts as long as the page.
// task is the practice work it's for. A checkpoint's take is saved; a weekly assessment says what it asks
// for before recording (gaps: what the player still has to be set to), and its take is submitted on
// purpose, once verdict says it fits. Work set before there were weeks is sent as it always was.
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
  keep,
  task = null,
  verdict = null,
  gaps = [],
  briefing = false,
  speed = 1,
  onSetUp,
  onSetUpAndRecord,
  onRecordAsPractice,
  recordAs = "audio",
  onRecordAs,
  videoNote = null,
  camera = null,
  cameraError = "",
  onCameraOn,
  onCameraOff,
  videoTake = null,
  videoWarning = "",
  uploadStopped = false,
  onDownloadVideo,
  mics = [],
  micId = "",
  onChooseMic,
}) {
  const permission = useMicPermission();
  const listening = monitoring || recording;
  const assessment = isWeeklyAssessment(task);
  const checkpoint = task?.kind === "checkpoint";
  // The take the student has said they want to submit: asked once, and forgotten for a new take.
  const [confirmingFor, setConfirmingFor] = useState(null);
  const current = videoTake ?? take;
  const confirming = Boolean(current) && confirmingFor === current;
  const filming = recordAs === "video";
  const teacher = task?.teacher?.name?.split(" ")[0] || "your teacher";
  const uploading = sendProgress !== null ? `Uploading ${Math.round(sendProgress * 100)}%` : null;
  // What to do with a take, the same for a recording and a video.
  const firstKey = uploadStopped ? "Resume upload" : checkpoint ? "Save to checkpoint" : "Send to your teacher";
  const takeActions = current && !recording && (
    <>
      {onSend && (assessment || verdict?.ok === false) && (verdict?.ok ? <p className="rw-take-verdict" data-ok="true">This take can be submitted for the assessment.</p> : <p className="rw-take-verdict">{verdict?.text}</p>)}

      {confirming ? (
        <div className="rw-brief-ask" role="group" aria-label="Submit this take">
          <p>
            {takeName} goes to {teacher} for the Week {task.week} assessment. You can submit a better one later, and every one is kept.
          </p>
          <div className="rw-brief-keys">
            <button type="button" className="rw-btn rw-btn-primary" onClick={onSend} disabled={sendProgress !== null}>
              {uploading ?? (uploadStopped ? "Resume upload" : "Yes, submit it")}
            </button>
            <button type="button" className="rw-btn" onClick={() => setConfirmingFor(null)} disabled={sendProgress !== null}>
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      <div className="rw-take-actions">
        {onSend && !assessment && verdict?.ok !== false && (
          <button type="button" className="rw-btn rw-btn-primary" onClick={onSend} disabled={sendProgress !== null}>
            {uploading ?? firstKey}
          </button>
        )}
        {onSend && assessment && verdict?.ok && !confirming && (
          <button type="button" className="rw-btn rw-btn-primary" onClick={() => setConfirmingFor(current)}>
            {uploadStopped ? "Resume upload" : `Submit ${takeName} for the Week ${task.week} assessment`}
          </button>
        )}
        {videoTake ? (
          <button type="button" className="rw-btn" onClick={onDownloadVideo}>
            Download video
          </button>
        ) : (
          <button type="button" className="rw-btn" onClick={onDownload} disabled={exporting}>
            {exporting ? "Preparing…" : (take.speed ?? 1) !== 1 ? "Download take (.wav)" : "Download mix (.wav)"}
          </button>
        )}
        <button type="button" className="rw-btn rw-btn-quiet" onClick={onDelete}>
          Delete take
        </button>
      </div>
      {sendError && (
        <p role="alert" className="rw-studio-error">
          {sendError}
        </p>
      )}
      <TakeStatus keep={keep} canSend={Boolean(onSend)} sending={sendProgress !== null} verb={checkpoint ? "save" : assessment ? "submit" : "send"} />
    </>
  );

  // While only checking the mic, the deck's VU meter reads the mic's analyser directly.
  useEffect(() => {
    if (recording ? !filming : !monitoring) return;
    const scratch = new Float32Array(1024);
    let frame = requestAnimationFrame(function step() {
      const node = getMic()[0];
      if (node) micLevel.current = measure(node, scratch).rms;
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [monitoring, recording, filming, getMic, micLevel]);

  const countingIn = recording && playing && recordTime < 0.05;
  const state = recording
    ? countingIn
      ? { id: "count", text: "Count-in", icon: "record" }
      : { id: "rec", text: `Recording ${clock(recordTime, true)}`, icon: "record" }
    : monitoring
      ? { id: "check", text: "Checking your mic", icon: "mic" }
      : take && playing
        ? { id: "playback", text: "Playing back with your take", icon: "play" }
        : current
          ? { id: "take", text: videoTake ? "Video ready to watch" : "Take ready to hear", icon: "check" }
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
    <div className="rw-recorder">
      <div className="rw-rec-status" data-rec-state={state.id} role="status" aria-live="polite">
        <span className="rw-rec-pill">
          <Icon name={state.icon} size={13} />
          {state.text}
        </span>
        <span className="rw-rec-mic" data-tone={mic.tone}>
          {mic.text}
        </span>
      </div>

      {assessment && !recording && (
        <div className="rw-brief">
          <p className="rw-brief-title">Week {task.week} assessment{task.section ? `: ${task.section}` : ""}</p>
          <p className="rw-brief-asks">{requirementWords(task).join(" · ")}</p>
          {task.criteria?.length > 0 && <p className="rw-brief-marks">{teacher === "your teacher" ? "Your teacher" : teacher} will listen for: {task.criteria.join(", ").toLowerCase()}.</p>}
          {gaps.length === 0 ? (
            <p className="rw-brief-ready">The player is set for this take.</p>
          ) : briefing ? (
            <div className="rw-brief-ask" role="group" aria-label="Before you record">
              <p>The player isn&apos;t set for the assessment yet: it needs {gaps.join(" and ")}. You can still practise any way you like, but a take has to match to be submitted.</p>
              <div className="rw-brief-keys">
                <button type="button" className="rw-btn rw-btn-primary" onClick={onSetUpAndRecord} disabled={!ready}>
                  Set it and record
                </button>
                <button type="button" className="rw-btn" onClick={onRecordAsPractice} disabled={!ready}>
                  Record as practice
                </button>
              </div>
            </div>
          ) : (
            <div className="rw-brief-keys">
              <button type="button" className="rw-btn" onClick={onSetUp} disabled={!ready}>
                Set the player to this
              </button>
            </div>
          )}
        </div>
      )}

      {videoNote && <p className="rw-brief-note">{videoNote}</p>}
      {task?.media === "video" && task.audioAllowed && !videoNote && !recording && (
        <div className="rw-seg" role="group" aria-label="Record as">
          {["video", "audio"].map((f) => (
            <button key={f} type="button" aria-pressed={recordAs === f} onClick={() => onRecordAs(f)}>
              {f === "video" ? "Video" : "Audio"}
            </button>
          ))}
        </div>
      )}
      {filming && (
        <div className="rw-camera-box">
          {camera ? <LivePreview stream={camera} /> : <div className="rw-camera rw-camera-off">Your camera is off. It only comes on when you turn it on here.</div>}
          {videoWarning && (
            <p className="rw-studio-error" role="status">
              {videoWarning}
            </p>
          )}
          {cameraError && (
            <p className="rw-studio-error" role="alert">
              {cameraError}
            </p>
          )}
          {!recording && (
            <div className="rw-brief-keys">
              <button type="button" className="rw-btn" onClick={camera ? onCameraOff : onCameraOn} disabled={!ready}>
                {camera ? "Turn camera off" : "Turn camera on"}
              </button>
            </div>
          )}
        </div>
      )}

      <TapeDeck
        getPosition={getPosition}
        position={position}
        duration={duration}
        running={playing}
        recording={recording}
        listening={listening}
        level={micLevel}
        label={current && !recording ? takeName : nextTakeName}
      >
        <button type="button" className="rw-deck-key" onClick={recording ? onStop : onRecord} disabled={!ready || (filming && !camera && !recording)} style={deckKey(recording)}>
          <span style={{ display: "inline-flex", color: recording ? "var(--rw-ink)" : "var(--rw-orange)" }}>
            <Icon name={recording ? "stop" : "record"} size={14} />
          </span>
          {recording ? "Stop" : current ? "Record again" : "Record"}
        </button>
      </TapeDeck>

      <div className="rw-rec-level">
        {mics.length > 1 && !recording && (
          <label className="rw-mic-choice">
            <span className="rw-studio-label">Microphone</span>
            <select className="rw-console-input" value={micId} onChange={(e) => onChooseMic(e.target.value)}>
              <option value="">The browser&apos;s default</option>
              {mics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="rw-rec-level-head">
          <span className="rw-studio-label">Mic level</span>
          {!recording && !filming && (
            <button type="button" className="rw-toggle" onClick={monitoring ? onStopCheck : onCheckMic} disabled={!ready} aria-pressed={monitoring}>
              {monitoring ? "Stop checking" : "Check mic"}
            </button>
          )}
        </div>
        <Meter getNodes={getMic} active={listening} vertical={false} length={260} thickness={8} clipAt={0.99} clipLabel="Too loud" title="Mic level" fluid />
        <div className="rw-meter-scale" aria-hidden="true">
          {["-48", "-36", "-24", "-12", "0 dB"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="rw-studio-hint">
          {listening
            ? "Play your loudest part. Aim for the gold zone; if Too loud lights, back off the mic or turn its input down."
            : `Starts from the current position at ${task?.targetSpeed ? (speed < 1 ? `${Math.round(speed * 100)}%` : "full speed") : "full speed"}, and plays straight through any loop. Wear headphones so the mic only hears you.${filming ? " Recording stops by itself at 8 minutes." : ""}`}
        </p>
      </div>

      {take && !recording && (
        <div className="rw-take" data-take="true">
          <div className="rw-take-head">
            <span className="rw-studio-label">{takeName}</span>
            <span className="rw-take-meta">
              {clock(take.buffer.duration, true)} long · starts at {clock(Math.max(0, takeStart))}
              {(take.speed ?? 1) !== 1 ? ` · played at ${Math.round(take.speed * 100)}%` : ""}
            </span>
          </div>
          <TakeWave peaks={takePeaks} position={position} start={takeStart} length={take.buffer.duration * (take.speed ?? 1)} />

          <div className="rw-take-row">
            <button type="button" className="rw-btn rw-btn-primary" onClick={onPlayTake} disabled={!ready}>
              <Icon name={playing ? "pause" : "play"} size={14} />
              {playing ? "Pause" : "Play your take"}
            </button>
            <label className="rw-take-name">
              <span>Name</span>
              <input
                className="rw-console-input"
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

          {takeActions}
        </div>
      )}

      {videoTake && !recording && (
        <div className="rw-take" data-take="true">
          <div className="rw-take-head">
            <span className="rw-studio-label">{takeName}</span>
            <span className="rw-take-meta">
              {clock(videoTake.duration, true)} long · {Math.max(1, Math.round(videoTake.blob.size / 1024 / 1024))} MB
              {(videoTake.speed ?? 1) !== 1 ? ` · played at ${Math.round(videoTake.speed * 100)}%` : ""}
            </span>
          </div>
          <video className="rw-camera" controls playsInline preload="metadata" src={videoTake.url} aria-label={`Your video, ${takeName}`} />
          <label className="rw-take-name">
            <span>Name</span>
            <input className="rw-console-input" value={takeInput} placeholder={takeName} maxLength={30} onChange={(e) => onRename(e.target.value)} aria-label="Name this take" />
          </label>
          {takeActions}
        </div>
      )}
    </div>
  );
}

// What the camera sees, mirrored as a mirror would be. The recording itself isn't.
function LivePreview({ stream }) {
  const element = useRef(null);
  useEffect(() => {
    if (element.current) element.current.srcObject = stream;
  }, [stream]);
  return <video ref={element} className="rw-camera" data-live="true" autoPlay muted playsInline aria-label="Camera preview" />;
}

// Where the take is, in words, so it's never a guess whether leaving loses it. Sent and replied are
// shown on the practice work's page, where every send is listed.
function TakeStatus({ keep, canSend, sending, verb = "send" }) {
  const Verb = verb.charAt(0).toUpperCase() + verb.slice(1);
  let state = "page";
  let text = `Not safely kept. ${canSend ? `Until you ${verb} it, your take` : "Your take"} is only on this page, and leaving deletes it, so ${canSend ? `${verb} or ` : ""}download it first.`;
  if (sending) {
    state = "sending";
    text = "Uploading. Stay on this page until it's done.";
  } else if (keep?.state === "keeping") {
    state = "keeping";
    text = "Keeping it in this browser…";
  } else if (keep?.state === "kept") {
    state = "kept";
    text = `Kept in this browser since ${keptWhen(keep.at)}, and not sent yet. It's still here if you leave and come back${canSend ? `, until you ${verb} it or delete it` : ", until you delete it"}.`;
  } else if (keep?.state === "unkept") {
    state = "unkept";
    text = `Not safely kept. This browser won't store it, so it's lost if you leave. ${canSend ? `${Verb} or download` : "Download"} it first.`;
  }
  return (
    <p className="rw-take-status" data-state={state} role="status">
      <span aria-hidden="true" className="rw-take-status-lamp" />
      {text}
    </p>
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
