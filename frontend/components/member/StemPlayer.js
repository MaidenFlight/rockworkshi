"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MIX_MODES,
  createMasterBus,
  defaultMix,
  mixFromSettings,
  percentToGain,
  rampTo,
  stemLevels,
  takeLevel,
} from "@/lib/audio/mix";
import { DEFAULT_EFFECTS, createTakeEffects } from "@/lib/audio/takeEffects";
import MixerPanel from "./mixer/MixerPanel";
import EffectsRack from "./mixer/EffectsRack";
import MixPresets from "./mixer/MixPresets";
import { btn, chip, eyebrow, section } from "./mixer/styles";

// Every mode plays all the stems in sync and only changes which are audible,
// so switching mode mid-song never stops or jumps.
const MODES = [
  { id: "full", label: "Whole song" },
  { id: "solo", label: "Isolated track" },
  { id: "minus", label: "Without one part" },
];

const NUDGE_LIMIT_MS = 300;

// Captures raw mic samples inside the audio engine, stamped with the AudioContext clock,
// so a take lines up with the band. MediaRecorder can't say when it really started.
const RECORDER_WORKLET = `
class RwRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = (e) => { this.recording = e.data === "start"; };
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (this.recording && channel) this.port.postMessage({ time: currentTime, samples: channel.slice(0) });
    return true;
  }
}
registerProcessor("rw-recorder", RwRecorder);
`;

function fmtT(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Time between the band leaving the speakers and the mic's copy of what you played reaching us.
// Browsers that don't report it give 0, and the nudge slider covers the rest.
function roundTripLatency(ctx, stream) {
  const output = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  const input = stream.getAudioTracks()[0]?.getSettings().latency || 0;
  return output + input;
}

// 16-bit PCM WAV, which every player opens.
function toWav(buffer) {
  const channels = buffer.numberOfChannels;
  const bytes = buffer.length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, bytes, true);
  const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

// review = { url, songTime, label } plays someone else's take (a teacher reviewing a student)
// instead of recording one. songTime is where its first sample sits in the song.
// songId turns on saved mixes for the signed-in student. mixLevel (from the API) sets headroom.
// resume is the student's saved session for this song: the player opens there, paused.
// onSaveSession(session, { keepalive }) is called now and then while practising, and on
// pause and leave; it returns a promise.
export default function StemPlayer({
  tracks,
  myPart,
  title = "Song",
  review = null,
  partLabel = "yours",
  songId = null,
  mixLevel = null,
  resume = null,
  onSaveSession = null,
}) {
  const parts = useMemo(() => tracks.map((t) => t.part), [tracks]);
  const reviewUrl = review?.url;
  const reviewTime = review?.songTime ?? 0;
  const saved = resume?.mixer;
  const startPosition = review ? 0 : (resume?.position ?? 0);

  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [loadedCount, setLoadedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startPosition);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState(MIX_MODES.includes(saved?.mode) ? saved.mode : "full");
  const [focus, setFocus] = useState(
    parts.includes(saved?.focus) ? saved.focus : parts.includes(myPart) ? myPart : parts[0]
  );

  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState(null); // { buffer, songTime } songTime = song position of the take's first sample
  const [nudgeMs, setNudgeMs] = useState(0); // positive moves the take earlier
  const [micError, setMicError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mix, setMix] = useState(() => (saved ? mixFromSettings(saved, parts) : defaultMix(parts)));
  const [fx, setFx] = useState(saved?.effects ? { ...DEFAULT_EFFECTS, ...saved.effects } : DEFAULT_EFFECTS);

  // stems -> per-stem gain -> master bus; take -> effects -> take gain -> master bus.
  const ctxRef = useRef(null);
  const busRef = useRef(null); // { input, master } from createMasterBus
  const buffersRef = useRef({}); // part -> decoded AudioBuffer
  const gainsRef = useRef({}); // part -> GainNode, one volume knob per stem
  const fxRef = useRef(null); // the take's effects chain
  const takeGainRef = useRef(null);
  const sourcesRef = useRef([]); // the AudioBufferSourceNodes currently playing
  const startedAtRef = useRef(0); // AudioContext time at which song position 0 played
  const offsetRef = useRef(startPosition); // song position to resume from while paused

  // Read inside startAt and the playhead loop, which would otherwise see stale state.
  const takeRef = useRef(null);
  const nudgeRef = useRef(0);
  const recordingRef = useRef(false);
  const micRef = useRef(null); // { stream, source, worklet }
  const chunksRef = useRef([]);
  const playingRef = useRef(false);

  // ---------- Resume state ----------
  // Saved every 15 s while playing, a few seconds after a settings change, on pause, and
  // when leaving. Never per playhead tick, and only when something actually changed.
  const latestRef = useRef(null); // the state a save would send, refreshed after every render
  const lastSavedRef = useRef(null);
  const onSaveRef = useRef(onSaveSession);
  useEffect(() => {
    latestRef.current = { mix, mode, focus, fx, ready: status === "ready" };
    onSaveRef.current = onSaveSession;
    playingRef.current = playing;
  });

  function positionNow() {
    const ctx = ctxRef.current;
    if (!playingRef.current || !ctx) return offsetRef.current;
    return Math.max(0, ctx.currentTime - startedAtRef.current);
  }

  function saveSession({ keepalive = false } = {}) {
    const latest = latestRef.current;
    if (!onSaveRef.current || !latest?.ready || recordingRef.current) return;
    const session = {
      position: Math.round(positionNow() * 10) / 10,
      mixer: { mode: latest.mode, focus: latest.focus, ...latest.mix, effects: latest.fx },
    };
    const json = JSON.stringify(session);
    if (json === lastSavedRef.current) return;
    lastSavedRef.current = json;
    onSaveRef.current(session, { keepalive }).catch(() => {
      lastSavedRef.current = null; // try again at the next save point
    });
  }

  // Declared before the audio graph so its cleanup runs first, while the clock still reads.
  useEffect(() => {
    const onHide = () => saveSession({ keepalive: true });
    const onVisibility = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      onHide();
    };
    // saveSession only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => saveSession(), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Settings changes are saved once they've settled, not on every slider step.
  const settledRef = useRef(false);
  useEffect(() => {
    if (!settledRef.current) {
      settledRef.current = true; // nothing to save for the state we opened with
      return;
    }
    const id = setTimeout(() => saveSession(), 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mix, mode, focus, fx]);

  // Download and decode every stem once. Decoded audio stays in memory so play/seek is instant.
  useEffect(() => {
    let cancelled = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const bus = createMasterBus(ctx, mixLevel);
    busRef.current = bus;
    gainsRef.current = {};
    for (const t of tracks) {
      const gain = ctx.createGain();
      gain.connect(bus.input);
      gainsRef.current[t.part] = gain;
    }
    const chain = createTakeEffects(ctx);
    fxRef.current = chain;
    takeGainRef.current = ctx.createGain();
    chain.output.connect(takeGainRef.current);
    takeGainRef.current.connect(bus.input);

    const decodeUrl = async (url, label) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
      return ctx.decodeAudioData(await res.arrayBuffer());
    };

    Promise.all([
      Promise.all(
        tracks.map(async (t) => {
          const buffer = await decodeUrl(t.url, t.part);
          if (!cancelled) setLoadedCount((n) => n + 1);
          return [t.part, buffer];
        })
      ),
      reviewUrl ? decodeUrl(reviewUrl, "take") : null,
    ])
      .then(([entries, reviewBuffer]) => {
        if (cancelled) return;
        buffersRef.current = Object.fromEntries(entries);
        const length = Math.max(...entries.map(([, b]) => b.duration));
        setDuration(length);
        // A session saved at the very end starts again from the top.
        if (offsetRef.current >= length - 1) {
          offsetRef.current = 0;
          setPosition(0);
        }
        if (reviewBuffer) {
          takeRef.current = { buffer: reviewBuffer, songTime: reviewTime };
          setTake(takeRef.current);
          // Start where the take does, not at the top of the song.
          offsetRef.current = Math.max(0, reviewTime);
          setPosition(offsetRef.current);
        }
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Could not load stems:", err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      stopSources();
      micRef.current?.stream.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      ctx.close();
    };
  }, [tracks, reviewUrl, reviewTime, mixLevel]);

  // Mode, volume, mute and solo all land here as smoothed gain changes on the running
  // graph, so none of them restarts playback or moves the stems off their shared clock.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !busRef.current) return;
    const levels = stemLevels(mix, mode, focus, parts);
    for (const part of parts) {
      const gain = gainsRef.current[part];
      if (gain) rampTo(ctx, gain.gain, levels[part].gain);
    }
    rampTo(ctx, takeGainRef.current.gain, takeLevel(mix));
    rampTo(ctx, busRef.current.master.gain, percentToGain(mix.master));
  }, [mix, mode, focus, parts]);

  useEffect(() => {
    fxRef.current?.apply(fx);
  }, [fx]);

  // Move the playhead while playing, and stop at the end.
  useEffect(() => {
    if (!playing) return;
    let raf;
    function tick() {
      const t = ctxRef.current.currentTime - startedAtRef.current;
      if (t >= duration) {
        if (recordingRef.current) stopRecording();
        else stopSources();
        offsetRef.current = 0;
        setPosition(0);
        setPlaying(false);
        return;
      }
      setPosition(Math.max(0, t));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // stopRecording only reads refs, so it doesn't need to restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  function stopSources() {
    for (const src of sourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
    }
    sourcesRef.current = [];
  }

  // A source node plays once, so every play or seek makes fresh ones.
  // They're scheduled slightly ahead so all stems start on the same sample.
  function startAt(offset) {
    const ctx = ctxRef.current;
    stopSources();
    const when = ctx.currentTime + 0.05;
    sourcesRef.current = parts.map((part) => {
      const src = ctx.createBufferSource();
      src.buffer = buffersRef.current[part];
      src.connect(gainsRef.current[part]);
      src.start(when, offset);
      return src;
    });

    // The take starts wherever it was recorded, which may be before or after this point.
    const current = takeRef.current;
    if (current && !recordingRef.current) {
      const src = ctx.createBufferSource();
      src.buffer = current.buffer;
      src.connect(fxRef.current.input);
      const takeStart = current.songTime - nudgeRef.current / 1000;
      if (offset >= takeStart) src.start(when, offset - takeStart);
      else src.start(when + (takeStart - offset));
      sourcesRef.current.push(src);
    }

    startedAtRef.current = when - offset;
  }

  function currentPosition() {
    if (!playing) return offsetRef.current;
    return Math.min(duration, Math.max(0, ctxRef.current.currentTime - startedAtRef.current));
  }

  async function play() {
    // Browsers keep audio suspended until the user clicks something.
    await ctxRef.current.resume();
    startAt(offsetRef.current);
    setPlaying(true);
  }

  function pause() {
    offsetRef.current = currentPosition();
    stopSources();
    setPosition(offsetRef.current);
    setPlaying(false);
    playingRef.current = false;
    saveSession();
  }

  function seek(t) {
    offsetRef.current = t;
    setPosition(t);
    if (playing) startAt(t);
  }

  function skip(delta) {
    seek(Math.min(duration, Math.max(0, currentPosition() + delta)));
  }

  // Asks for the mic once, then keeps the recorder wired up for later takes.
  async function ensureMic() {
    if (micRef.current) return micRef.current;
    const ctx = ctxRef.current;
    // Echo cancellation and noise suppression are tuned for calls and mangle instruments.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const moduleUrl = URL.createObjectURL(new Blob([RECORDER_WORKLET], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "rw-recorder");
    worklet.port.onmessage = (e) => {
      if (recordingRef.current) chunksRef.current.push(e.data);
    };
    // The worklet only runs while connected to the output. The muted gain keeps the mic out of your ears.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(worklet).connect(mute).connect(ctx.destination);
    micRef.current = { stream, worklet };
    return micRef.current;
  }

  async function startRecording() {
    setMicError("");
    let mic;
    try {
      await ctxRef.current.resume();
      mic = await ensureMic();
    } catch (err) {
      console.error("Microphone unavailable:", err);
      setMicError(
        err.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
          : "No microphone found."
      );
      return;
    }
    stopSources();
    chunksRef.current = [];
    recordingRef.current = true;
    mic.worklet.port.postMessage("start");
    startAt(offsetRef.current);
    setRecording(true);
    setPlaying(true);
  }

  function stopRecording() {
    const ctx = ctxRef.current;
    const mic = micRef.current;
    recordingRef.current = false;
    mic.worklet.port.postMessage("stop");
    offsetRef.current = currentPosition();
    stopSources();
    setPosition(offsetRef.current);
    setRecording(false);
    setPlaying(false);

    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length) return;
    const length = chunks.reduce((n, c) => n + c.samples.length, 0);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let i = 0;
    for (const c of chunks) {
      data.set(c.samples, i);
      i += c.samples.length;
    }
    // chunks[0].time is when the first mic sample arrived. Minus the latency, that's when you played it.
    const songTime = chunks[0].time - startedAtRef.current - roundTripLatency(ctx, mic.stream);
    takeRef.current = { buffer, songTime };
    setTake(takeRef.current);
    setMix((m) => ({ ...m, takeMuted: false }));
  }

  function changeNudge(ms) {
    nudgeRef.current = ms;
    setNudgeMs(ms);
    if (playing) startAt(currentPosition());
  }

  function deleteTake() {
    takeRef.current = null;
    setTake(null);
    nudgeRef.current = 0;
    setNudgeMs(0);
    if (playing) startAt(currentPosition());
  }

  // Renders the mix as heard (volumes, mode, mute, solo, master, the take's effects and the
  // clipping protection) into one file, faster than real time.
  async function downloadMix() {
    setExporting(true);
    try {
      const rate = ctxRef.current.sampleRate;
      const offline = new OfflineAudioContext(2, Math.ceil(duration * rate), rate);
      const bus = createMasterBus(offline, mixLevel);
      bus.master.gain.value = percentToGain(mix.master);

      const levels = stemLevels(mix, mode, focus, parts);
      for (const part of parts) {
        if (!levels[part].audible) continue;
        const gain = offline.createGain();
        gain.gain.value = levels[part].gain;
        gain.connect(bus.input);
        const src = offline.createBufferSource();
        src.buffer = buffersRef.current[part];
        src.connect(gain);
        src.start(0);
      }

      if (takeLevel(mix) > 0) {
        const chain = createTakeEffects(offline, fx);
        const takeGain = offline.createGain();
        takeGain.gain.value = takeLevel(mix);
        chain.output.connect(takeGain);
        takeGain.connect(bus.input);
        const takeStart = take.songTime - nudgeMs / 1000;
        const src = offline.createBufferSource();
        src.buffer = take.buffer;
        src.connect(chain.input);
        if (takeStart >= 0) src.start(takeStart);
        else src.start(0, -takeStart);
      }

      const url = URL.createObjectURL(toWav(await offline.startRendering()));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title} - my take.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setExporting(false);
    }
  }

  if (status === "error") {
    return <div style={panel}>The tracks couldn&apos;t be loaded. Refresh the page to try again.</div>;
  }

  const levels = stemLevels(mix, mode, focus, parts);
  const ready = status === "ready";

  function applyPreset(s) {
    setMix(mixFromSettings(s, parts));
    if (MIX_MODES.includes(s.mode)) setMode(s.mode);
    if (parts.includes(s.focus)) setFocus(s.focus);
    if (s.effects) setFx({ ...DEFAULT_EFFECTS, ...s.effects });
  }

  return (
    <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)" }}>
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--rw-border)" }}>
        <div style={eyebrow}>Play</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} style={chip(mode === m.id)} aria-pressed={mode === m.id}>
              {m.label}
            </button>
          ))}
        </div>

        {mode !== "full" && (
          <>
            <div style={{ ...eyebrow, marginTop: 16 }}>{mode === "solo" ? "Only this part" : "Leave out"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {parts.map((p) => (
                <button key={p} onClick={() => setFocus(p)} style={chip(focus === p)} aria-pressed={focus === p}>
                  {p}
                  {p === myPart ? ` (${partLabel})` : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={section}>
        <div style={eyebrow}>Mixer</div>
        <MixerPanel
          parts={parts}
          mix={mix}
          levels={levels}
          onChange={setMix}
          takeLabel={take ? review?.label || "Your take" : null}
          onReset={() => setMix(defaultMix(parts))}
        />
      </div>

      <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--rw-border)" }}>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={position}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!ready || recording}
          aria-label="Song position"
          style={{ width: "100%", accentColor: "var(--rw-orange)" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={() => skip(-5)} disabled={!ready || recording} style={btn}>
            &#8630; 5s
          </button>
          <button
            onClick={playing ? pause : play}
            disabled={!ready || recording}
            style={{ ...btn, minWidth: 96, background: "var(--rw-orange)", border: "1px solid var(--rw-orange)", color: "#fff" }}
          >
            {!ready ? `Loading ${loadedCount}/${parts.length}` : playing ? "Pause" : "Play"}
          </button>
          <button onClick={() => skip(5)} disabled={!ready || recording} style={btn}>
            5s &#8631;
          </button>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--rw-body)", fontVariantNumeric: "tabular-nums" }}>
            {fmtT(position)} / {fmtT(duration)}
          </span>
        </div>
      </div>

      {review ? (
        <div style={{ padding: "18px 22px" }}>
          <label style={{ fontSize: 13, color: "var(--rw-body)", display: "block" }}>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Line up the take</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--rw-meta)" }}>
                {nudgeMs > 0 ? `${nudgeMs} ms earlier` : nudgeMs < 0 ? `${-nudgeMs} ms later` : "as sent"}
              </span>
            </span>
            <input
              type="range"
              min={-NUDGE_LIMIT_MS}
              max={NUDGE_LIMIT_MS}
              step={5}
              value={nudgeMs}
              onChange={(e) => changeNudge(Number(e.target.value))}
              disabled={!take}
              style={{ width: "100%", accentColor: "var(--rw-orange)", marginTop: 6 }}
            />
          </label>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--rw-meta)", lineHeight: 1.5 }}>
            The take plays where it was recorded in the song. Phones can be a little off, so nudge it if it sounds
            early or late before judging the timing.
          </p>
        </div>
      ) : (
        <div style={{ padding: "18px 22px" }}>
          <div style={eyebrow}>Record yourself</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!ready}
              style={{
                ...btn,
                minWidth: 120,
                background: recording ? "var(--rw-ink)" : "#fff",
                color: recording ? "#fff" : "var(--rw-orange)",
                border: `1px solid ${recording ? "var(--rw-ink)" : "var(--rw-orange)"}`,
              }}
            >
              {recording ? "■ Stop" : take ? "● Record again" : "● Record"}
            </button>
            <span style={{ fontSize: 13, color: "var(--rw-meta)", lineHeight: 1.5, flex: "1 1 240px" }}>
              {recording
                ? "Recording. The band plays in the mode you picked."
                : "Starts from the current position. Wear headphones so the mic only hears you."}
            </span>
          </div>
          {micError && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>{micError}</p>}

          {take && !recording && (
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <label style={{ fontSize: 13, color: "var(--rw-body)" }}>
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Line up your take</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--rw-meta)" }}>
                    {nudgeMs > 0 ? `${nudgeMs} ms earlier` : nudgeMs < 0 ? `${-nudgeMs} ms later` : "as recorded"}
                  </span>
                </span>
                <input
                  type="range"
                  min={-NUDGE_LIMIT_MS}
                  max={NUDGE_LIMIT_MS}
                  step={5}
                  value={nudgeMs}
                  onChange={(e) => changeNudge(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--rw-orange)", marginTop: 6 }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={downloadMix} disabled={exporting} style={btn}>
                  {exporting ? "Preparing…" : "Download mix (.wav)"}
                </button>
                <button onClick={deleteTake} style={{ ...btn, color: "var(--rw-meta)" }}>
                  Delete take
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--rw-meta)" }}>
                Your take stays on this device. Leaving the page deletes it, so download it first if you want to keep it.
              </p>
            </div>
          )}
        </div>
      )}

      {take && !review && (
        <div style={{ ...section, borderTop: "1px solid var(--rw-border)", borderBottom: 0 }}>
          <EffectsRack fx={fx} onChange={setFx} />
        </div>
      )}

      {songId && !review && (
        <div style={{ ...section, borderTop: "1px solid var(--rw-border)", borderBottom: 0 }}>
          <div style={eyebrow}>Saved mixes</div>
          <MixPresets
            songId={songId}
            getSettings={() => ({ mode, focus, ...mix, effects: fx })}
            onApply={applyPreset}
          />
        </div>
      )}
    </div>
  );
}

const panel = {
  padding: 28,
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
  color: "var(--rw-body)",
};
