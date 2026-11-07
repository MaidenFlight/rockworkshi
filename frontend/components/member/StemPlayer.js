"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { analyser } from "@/lib/audio/meters";
import { peaksInTurn, peaksOf } from "@/lib/audio/peaks";
import { createStretchVoice } from "@/lib/audio/stretch";
import { DEFAULT_EFFECTS, createTakeEffects } from "@/lib/audio/takeEffects";
import ChordChart from "./ChordChart";
import Icon from "./Icon";
import MixerPanel from "./mixer/MixerPanel";
import PartBalance from "./mixer/PartBalance";
import EffectsRack from "./mixer/EffectsRack";
import MixPresets from "./mixer/MixPresets";
import RecordPanel from "./player/RecordPanel";
import StudioTabs from "./player/StudioTabs";
import Timeline, { bandModes, partColor } from "./player/Timeline";
import Transport from "./player/Transport";
import { PlayClock } from "./player/clock";

// Every mode plays all the stems in sync and only changes which are audible, so switching mode
// mid-song never stops or jumps. A player with every stem names its modes for the part in focus
// (bandModes); a student's are named for their instrument (studentModes below).

const NUDGE_LIMIT_MS = 300;
const SPEEDS = [0.5, 0.75, 0.9, 1];
const MIN_LOOP_S = 1;
// The next pass of a loop is scheduled this far before the loop end, so it starts on time.
const LOOP_LOOKAHEAD_S = 0.4;
// Clicks are scheduled this far ahead, more than the loop's lookahead so a pass never loses its last beat.
const METRONOME_LOOKAHEAD_S = 0.5;
// Arrow left goes back to the start of the bar if it's this far in, else to the bar before.
const BAR_RESTART_S = 0.6;
// How often the page re-renders with the song position while playing. Anything that glides (the
// playhead, chart cursors, meters, reels) follows the audio clock on its own every frame. Rendering
// the whole player every frame would starve the router, so links stopped working mid-song.
const POSITION_EVERY_MS = 66;

function remembered(key) {
  try {
    return window.localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

function remember(key, on) {
  try {
    window.localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // Only a convenience: it just won't be remembered.
  }
}

// The view chosen last time, else Simple: anyone who hasn't opened the studio yet starts with the
// transport and the chart, and "Open studio mixer" is right there when they want the rest.
function firstView() {
  try {
    const stored = window.localStorage.getItem("rw-player-view");
    if (stored === "simple" || stored === "studio") return stored;
  } catch {
    // No storage: fall through to the default.
  }
  return "simple";
}

// The upload limit in the API (MAX_RECORDING_BYTES).
const MAX_RECORDING_BYTES = 40 * 1024 * 1024;

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
// initialLoop = { start, end } opens looping that section (a teacher's assignment). It wins
// over the saved loop and position.
// onSendTake({ blob, offset, duration }, onProgress) offers sending a take to a teacher.
// chart is the song's chord chart, if it has one.
// scope "instrument" is a student's player (see /songs/:id/tracks): tracks are their own stem
// (role "own") and one backing band of every other part (role "backing", with a `makeup` gain that
// undoes the turn-down it was mixed with). It plays in three modes named for their instrument, with
// two faders instead of a strip per part. available says which of their stem, backing band and chart
// the song has. Staff get scope "all": every stem, with the full mixer. So does the student demo, which
// also names its instrument: that shows "Your instrument" and keeps the chart to that student's.
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
  initialLoop = null,
  onSendTake = null,
  chart = null,
  scope = "all",
  instrument = null,
  available = null,
}) {
  const parts = useMemo(() => tracks.map((t) => t.part), [tracks]);
  const student = scope === "instrument" && Boolean(instrument);
  const ownPart = student ? (tracks.find((t) => t.role === "own")?.part ?? null) : null;
  const hasBacking = student && tracks.some((t) => t.role === "backing");
  // Turns each track back up by what it was turned down by when it was mixed (1 for a plain stem).
  const makeup = useMemo(() => Object.fromEntries(tracks.map((t) => [t.part, t.makeup ?? 1])), [tracks]);
  const noun = student ? instrument.toLowerCase() : "";
  // A student's three modes: the whole song, everything but their part, and their part alone.
  // A mode the song can't play yet (no stem for their instrument, or no backing band) is off, and says why.
  const studentModes = student
    ? [
        { id: "full", label: "Whole song", ready: hasBacking },
        { id: "minus", label: `Band without ${noun}`, ready: hasBacking && Boolean(ownPart) },
        { id: "solo", label: `${instrument} only`, ready: Boolean(ownPart) },
      ]
    : null;
  const reviewUrl = review?.url;
  const reviewTime = review?.songTime ?? 0;
  const saved = resume?.mixer;
  const startPosition = review ? 0 : (initialLoop?.start ?? resume?.position ?? 0);
  const startSpeed = !review && SPEEDS.includes(resume?.speed) ? resume.speed : 1;
  const startLoop = review ? null : (initialLoop ?? resume?.loop ?? null);

  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [loadedCount, setLoadedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startPosition);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState(() => {
    const wanted = MIX_MODES.includes(saved?.mode) ? saved.mode : "full";
    if (!studentModes) return wanted;
    const ready = (id) => studentModes.find((m) => m.id === id).ready;
    return ready(wanted) ? wanted : (["full", "solo", "minus"].find(ready) ?? "full");
  });
  // A student's focus is always their own part: the modes only ever add or take away the band.
  const [focus, setFocus] = useState(() =>
    student ? (ownPart ?? parts[0]) : parts.includes(saved?.focus) ? saved.focus : parts.includes(myPart) ? myPart : parts[0]
  );

  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState(null); // { buffer, songTime } songTime = song position of the take's first sample
  const [takeCount, setTakeCount] = useState(0); // takes recorded on this visit, so each gets the next number
  const [takeName, setTakeName] = useState("");
  const [nudgeMs, setNudgeMs] = useState(0); // positive moves the take earlier
  const [micError, setMicError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [speed, setSpeed] = useState(startSpeed);
  const [loop, setLoop] = useState(startLoop); // { start, end } only repeats once end is set
  const [preparingSpeed, setPreparingSpeed] = useState(false);
  const [speedError, setSpeedError] = useState("");
  const [sendProgress, setSendProgress] = useState(null); // set while sending
  const [sendError, setSendError] = useState("");
  const [countIn, setCountIn] = useState(() => remembered("rw-count-in"));
  const [metronome, setMetronome] = useState(() => remembered("rw-metronome"));
  // Simple leaves the part lanes and the studio (mixer, recorder, effects) out until asked for.
  // A teacher reviewing a take needs the studio, so a review always opens in it. Practice work opens
  // like any song: "Record your take" in the transport opens the recorder when it's wanted.
  const [view, setView] = useState(() => (review ? "studio" : firstView()));
  const [intro, setIntro] = useState(() => !review && !remembered("rw-player-intro"));
  // Simple is built around the chart; a song without one keeps its lanes and studio.
  const simple = view === "simple" && Boolean(chart);
  const [mix, setMix] = useState(() => (saved ? mixFromSettings(saved, parts) : defaultMix(parts)));
  const [fx, setFx] = useState(saved?.effects ? { ...DEFAULT_EFFECTS, ...saved.effects } : DEFAULT_EFFECTS);
  const [peaks, setPeaks] = useState({}); // part -> waveform outline, worked out after loading
  const [monitoring, setMonitoring] = useState(false); // the mic is open for a level check, not recording
  const [micLabel, setMicLabel] = useState("");
  const [recordFrom, setRecordFrom] = useState(0); // the song position the recording started from
  // The studio column, for "Open studio mixer" to name and "Record your take" to open on the recorder.
  const studioId = useId();
  const studioRef = useRef(null);
  const studioTabsRef = useRef(null);

  // stems -> per-stem gain -> master bus; take -> effects -> take gain -> master bus.
  const ctxRef = useRef(null);
  const busRef = useRef(null); // { input, master } from createMasterBus
  const buffersRef = useRef({}); // part -> decoded AudioBuffer
  const gainsRef = useRef({}); // part -> GainNode, one volume knob per stem
  const fxRef = useRef(null); // the take's effects chain
  const takeGainRef = useRef(null);
  const sourcesRef = useRef([]); // the AudioBufferSourceNodes currently playing
  const endingRef = useRef([]); // the previous pass of a loop, still sounding until the next begins
  const stemsVoiceRef = useRef(null); // the stems' stretcher, made the first time a song is slowed
  const takeVoiceRef = useRef(null);
  // AudioContext time at which song position 0 played (or would have, at the current speed).
  // Song position = (context time - startedAt) * speed.
  const startedAtRef = useRef(0);
  const speedRef = useRef(startSpeed);
  const loopRef = useRef(startLoop);
  const offsetRef = useRef(startPosition); // song position to resume from while paused

  // Read inside startAt and the playhead loop, which would otherwise see stale state.
  const takeRef = useRef(null);
  const nudgeRef = useRef(0);
  const recordingRef = useRef(false);
  const micRef = useRef(null); // { stream, source, worklet }
  const micLevelRef = useRef(0); // the mic's latest RMS while recording, for the tape deck's meter
  // Analysers in the real signal path, for the meters: after each stem's fader, after the take's,
  // on the master after the clipper (left and right), and on the mic before anything else.
  const metersRef = useRef({ parts: {}, master: [], take: null, mic: null });
  const countInBeatRef = useRef(0); // seconds per beat of the count-in under way
  const chunksRef = useRef([]);
  const playingRef = useRef(false);

  // Count-in and metronome clicks, scheduled on the same clock as the song.
  const clicksRef = useRef([]); // { osc, when }
  const countInUntilRef = useRef(0); // context time the count-in ends; the song holds still until then
  const passStartRef = useRef(0); // context time the current pass of the song began
  const scheduledRef = useRef(new Set()); // beats already given a click in this pass
  const metronomeRef = useRef(metronome);
  const countInRef = useRef(countIn);
  const beatsRef = useRef([]);
  const keysRef = useRef(null); // the keyboard shortcuts' actions, kept current

  // Bars, sections and beats from the chord chart, for the arrow keys, loops and clicks.
  const barTimes = useMemo(() => chart?.sections.flatMap((s) => s.bars.map((b) => b.time)) ?? [], [chart]);
  const sectionTimes = useMemo(() => chart?.sections.map((s) => s.bars[0].time) ?? [], [chart]);
  const beats = useMemo(() => {
    if (!chart) return [];
    const starts = [...barTimes, chart.end];
    const out = [];
    for (let i = 0; i + 1 < starts.length; i++) {
      const length = starts[i + 1] - starts[i];
      for (let b = 0; b < 4; b++) out.push({ time: starts[i] + (length * b) / 4, accent: b === 0 });
    }
    return out;
  }, [chart, barTimes]);

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
    beatsRef.current = beats;
    keysRef.current = {
      ready: status === "ready",
      recording,
      toggle: () => (recordingRef.current ? stopRecording() : playingRef.current ? pause() : play()),
      step: stepBar,
      seek,
      loopStart: markLoopStart,
      loopEnd: () => canEndLoop() && markLoopEnd(),
      clearLoop: () => updateLoop(null),
    };
  });

  // Keyboard shortcuts, as in tab players: Space plays and pauses, the arrows move by bar (by
  // section with Shift), Home goes to the start, [ and ] set the loop, \ clears it.
  // Typing in a field never triggers them, sliders keep their own arrow keys, and Space still
  // presses an ordinary focused button.
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      const tag = el?.tagName;
      if (el?.isContentEditable || tag === "TEXTAREA" || tag === "SELECT") return;
      const slider = tag === "INPUT" && el.type === "range";
      if (tag === "INPUT" && !slider) return;
      const keys = keysRef.current;
      if (!keys?.ready) return;
      const onButton = (tag === "BUTTON" || tag === "A") && !el.closest("[data-start]");
      if (e.key === " ") {
        if (onButton) return;
        e.preventDefault();
        keys.toggle();
        return;
      }
      if (keys.recording) return;
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !slider) {
        e.preventDefault();
        keys.step(e.key === "ArrowRight" ? 1 : -1, e.shiftKey);
      } else if (e.key === "Home" && !slider) {
        e.preventDefault();
        keys.seek(0);
      } else if (e.key === "[") {
        e.preventDefault();
        keys.loopStart();
      } else if (e.key === "]") {
        e.preventDefault();
        keys.loopEnd();
      } else if (e.key === "\\") {
        e.preventDefault();
        keys.clearLoop();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function countingIn() {
    return Boolean(ctxRef.current) && ctxRef.current.currentTime < countInUntilRef.current;
  }

  // Which click of the count-in is sounding (0-3), or -1 when there's no count-in under way.
  function countInBeat() {
    const ctx = ctxRef.current;
    if (!ctx || !countingIn() || !countInBeatRef.current) return -1;
    const left = countInUntilRef.current - ctx.currentTime;
    return Math.max(0, Math.min(3, 3 - Math.floor(left / countInBeatRef.current)));
  }

  // Which beat of its bar the song is on (0-3), from the chart's beats, or -1.
  function beatNow() {
    const t = positionNow();
    const list = beatsRef.current;
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].time <= t + 0.02) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? -1 : found % 4;
  }

  function positionNow() {
    const ctx = ctxRef.current;
    if (!playingRef.current || !ctx || countingIn()) return offsetRef.current;
    return Math.max(0, (ctx.currentTime - startedAtRef.current) * speedRef.current);
  }

  function saveSession({ keepalive = false } = {}) {
    const latest = latestRef.current;
    if (!onSaveRef.current || !latest?.ready || recordingRef.current) return;
    const session = {
      position: Math.round(positionNow() * 10) / 10,
      speed: speedRef.current,
      loop: loopRef.current,
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
  }, [mix, mode, focus, fx, speed, loop]);

  // Download and decode every stem once. Decoded audio stays in memory so play/seek is instant.
  useEffect(() => {
    let cancelled = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const bus = createMasterBus(ctx, mixLevel);
    busRef.current = bus;
    gainsRef.current = {};
    const meters = { parts: {}, master: [], take: null, mic: null };
    for (const t of tracks) {
      const gain = ctx.createGain();
      gain.connect(bus.input);
      gainsRef.current[t.part] = gain;
      meters.parts[t.part] = analyser(ctx);
      gain.connect(meters.parts[t.part]);
    }
    const chain = createTakeEffects(ctx);
    fxRef.current = chain;
    takeGainRef.current = ctx.createGain();
    chain.output.connect(takeGainRef.current);
    takeGainRef.current.connect(bus.input);
    meters.take = analyser(ctx);
    takeGainRef.current.connect(meters.take);
    const split = ctx.createChannelSplitter(2);
    bus.output.connect(split);
    meters.master = [analyser(ctx), analyser(ctx)];
    split.connect(meters.master[0], 0);
    split.connect(meters.master[1], 1);
    metersRef.current = meters;
    let stopPeaks = () => {};

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
        stopPeaks = peaksInTurn(entries, (part, outline) => setPeaks((all) => ({ ...all, [part]: outline })));
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
      stopPeaks();
      stopSources();
      stemsVoiceRef.current = null;
      takeVoiceRef.current = null;
      micRef.current?.stream.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      ctx.close();
    };
    // stopSources only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, reviewUrl, reviewTime, mixLevel]);

  // Mode, volume, mute and solo all land here as smoothed gain changes on the running
  // graph, so none of them restarts playback or moves the stems off their shared clock.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !busRef.current) return;
    const levels = stemLevels(mix, mode, focus, parts);
    for (const part of parts) {
      const gain = gainsRef.current[part];
      if (gain) rampTo(ctx, gain.gain, levels[part].gain * makeup[part]);
    }
    rampTo(ctx, takeGainRef.current.gain, takeLevel(mix));
    rampTo(ctx, busRef.current.master.gain, percentToGain(mix.master));
  }, [mix, mode, focus, parts, makeup]);

  useEffect(() => {
    fxRef.current?.apply(fx);
  }, [fx]);

  // Move the playhead while playing, repeat the loop, and stop at the end.
  useEffect(() => {
    if (!playing) return;
    let raf;
    let shown = 0;
    function tick(now) {
      const ctx = ctxRef.current;
      const current = loopRef.current;
      if (countingIn()) {
        // The song hasn't started yet: hold still until the count-in ends.
        raf = requestAnimationFrame(tick);
        return;
      }
      if (metronomeRef.current) scheduleBeats(current);
      if (current?.end != null && !recordingRef.current) {
        const loopEndsAt = startedAtRef.current + current.end / speedRef.current;
        if (loopEndsAt - ctx.currentTime < LOOP_LOOKAHEAD_S) {
          startAt(current.start, Math.max(loopEndsAt, ctx.currentTime + startLead()));
        }
      }
      const t = (ctx.currentTime - startedAtRef.current) * speedRef.current;
      if (t >= duration) {
        if (recordingRef.current) stopRecording();
        else stopSources();
        offsetRef.current = 0;
        setPosition(0);
        setPlaying(false);
        return;
      }
      if (now - shown >= POSITION_EVERY_MS) {
        shown = now;
        setPosition(Math.max(0, t));
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // stopRecording and startAt only read refs, so they don't need to restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  function allVoices() {
    return [stemsVoiceRef.current, takeVoiceRef.current].filter(Boolean);
  }

  // One click: higher on the first beat of the bar. Straight to the speakers, past the mixer.
  function scheduleClick(when, accent) {
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1100;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.07);
    const click = { osc, when };
    clicksRef.current.push(click);
    osc.onended = () => {
      clicksRef.current = clicksRef.current.filter((c) => c !== click);
      gain.disconnect();
    };
  }

  // Silences clicks due at or after a time, or all of them.
  function stopClicks(from = -Infinity) {
    for (const click of clicksRef.current) {
      if (click.when < from - 0.001) continue;
      try {
        click.osc.stop();
      } catch {
        // Already finished.
      }
    }
    clicksRef.current = clicksRef.current.filter((c) => c.when < from - 0.001);
  }

  // Gives the beats coming up in the next moment their click, once each, in time with the song
  // at any speed. Beats past a loop's end belong to the next pass, which schedules its own.
  function scheduleBeats(loopNow) {
    const ctx = ctxRef.current;
    const rate = speedRef.current;
    const from = (Math.max(ctx.currentTime, passStartRef.current) - startedAtRef.current) * rate;
    const until = (ctx.currentTime + METRONOME_LOOKAHEAD_S - startedAtRef.current) * rate;
    const limit = loopNow?.end != null && !recordingRef.current ? loopNow.end : Infinity;
    beatsRef.current.forEach((beat, i) => {
      if (beat.time < from - 0.0001 || beat.time >= until || beat.time >= limit - 0.0001 || scheduledRef.current.has(i)) return;
      scheduledRef.current.add(i);
      scheduleClick(startedAtRef.current + beat.time / rate, beat.accent);
    });
  }

  function stopSources() {
    stopClicks();
    countInUntilRef.current = 0;
    for (const src of [...endingRef.current, ...sourcesRef.current]) {
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
    }
    sourcesRef.current = [];
    endingRef.current = [];
    allVoices().forEach((v) => v.stop());
  }

  // How far ahead a start can be scheduled to be clean. The stretcher needs a little longer.
  function startLead() {
    const voice = stemsVoiceRef.current;
    return speedRef.current !== 1 && voice ? Math.max(0.05, voice.latency) : 0.05;
  }

  // A source node plays once, so every play, seek or loop pass makes fresh ones, scheduled
  // slightly ahead so all stems start on the same sample. What was playing stops exactly when
  // this starts, so a loop has no gap. Off full speed the stretch voices play instead.
  function startAt(offset, when = ctxRef.current.currentTime + startLead()) {
    const ctx = ctxRef.current;
    const rate = speedRef.current;
    // Clicks already due on the old timeline after this point no longer fit.
    stopClicks(when);
    passStartRef.current = when;
    scheduledRef.current = new Set();
    for (const src of [...endingRef.current, ...sourcesRef.current]) src.stop(when);
    endingRef.current = sourcesRef.current;
    sourcesRef.current = [];

    // The take starts wherever it was recorded, which may be before or after this point.
    const current = recordingRef.current ? null : takeRef.current;
    const takeStart = current ? current.songTime - nudgeRef.current / 1000 : 0;

    if (rate === 1) {
      allVoices().forEach((v) => v.stop(when));
      sourcesRef.current = parts.map((part) => {
        const src = ctx.createBufferSource();
        src.buffer = buffersRef.current[part];
        src.connect(gainsRef.current[part]);
        src.start(when, offset);
        return src;
      });
      if (current) {
        const src = ctx.createBufferSource();
        src.buffer = current.buffer;
        src.connect(fxRef.current.input);
        if (offset >= takeStart) src.start(when, offset - takeStart);
        else src.start(when + (takeStart - offset));
        sourcesRef.current.push(src);
      }
    } else {
      stemsVoiceRef.current.play(when, offset, rate);
      const takeVoice = takeVoiceRef.current;
      if (takeVoice && takeVoice.buffer === current?.buffer) {
        if (offset >= takeStart) takeVoice.play(when, offset - takeStart, rate);
        else takeVoice.play(when + (takeStart - offset) / rate, 0, rate);
      } else takeVoice?.stop(when);
    }

    startedAtRef.current = when - offset / rate;
  }

  // Makes the stretchers for the stems and take, if they don't have one yet.
  async function prepareVoices() {
    const ctx = ctxRef.current;
    if (!stemsVoiceRef.current) {
      stemsVoiceRef.current = await createStretchVoice(
        ctx,
        parts.map((part) => ({ buffer: buffersRef.current[part], output: gainsRef.current[part] }))
      );
    }
    const current = takeRef.current;
    if (current && takeVoiceRef.current?.buffer !== current.buffer) {
      takeVoiceRef.current?.dispose();
      takeVoiceRef.current = await createStretchVoice(ctx, [{ buffer: current.buffer, output: fxRef.current.input }]);
    }
  }

  // Gets the voices ready for a slower speed. The music carries on as it was in the meantime.
  // Returns false, and says so, if this browser can't do it.
  async function readyForSlowSpeed() {
    setPreparingSpeed(true);
    try {
      await prepareVoices();
      setSpeedError("");
      return true;
    } catch (err) {
      console.error("Could not prepare slow playback:", err);
      setSpeedError("Slow playback isn't available in this browser, so the song plays at full speed.");
      return false;
    } finally {
      setPreparingSpeed(false);
    }
  }

  async function changeSpeed(value) {
    if (value !== 1 && !(await readyForSlowSpeed())) return;
    const t = currentPosition(); // read at the old speed
    speedRef.current = value;
    setSpeed(value);
    if (playingRef.current) startAt(t);
  }

  // Plays from a position, after a bar of clicks if the count-in is on. The song holds still
  // through the count-in, so the cursor and recording only start with the music.
  function startWithCountIn(offset) {
    const ctx = ctxRef.current;
    let when = ctx.currentTime + startLead();
    const counting = countInRef.current && barTimes.length > 0;
    if (counting) {
      const i = Math.max(0, barTimes.findLastIndex((t) => t <= offset + 0.001));
      const beat = ((barTimes[i + 1] ?? chart.end) - barTimes[i]) / 4 / speedRef.current;
      for (let b = 0; b < 4; b++) scheduleClick(when + b * beat, b === 0);
      countInBeatRef.current = beat;
      when += 4 * beat;
    }
    startAt(offset, when);
    countInUntilRef.current = counting ? when : 0;
  }

  // The bar a position is in, from the chord chart. Loops set there snap to whole bars.
  function barStartAt(t) {
    const i = barTimes.findLastIndex((b) => b <= t + 0.001);
    return i < 0 ? 0 : barTimes[i];
  }

  function barEndAt(t) {
    return barTimes.find((b) => b > t + 0.001) ?? chart?.end ?? duration;
  }

  // Next or previous bar (or section). Back from partway into one goes to its start first.
  function stepBar(direction, bySection) {
    const list = bySection ? sectionTimes : barTimes;
    if (!list.length) {
      skip(direction * 5);
      return;
    }
    const t = currentPosition();
    if (direction > 0) {
      const next = list.find((b) => b > t + 0.05);
      if (next !== undefined) seek(next);
      return;
    }
    const i = list.findLastIndex((b) => b <= t + 0.05);
    if (i < 0) seek(0);
    else if (t - list[i] > BAR_RESTART_S) seek(list[i]);
    else seek(i > 0 ? list[i - 1] : 0);
  }

  function updateLoop(next) {
    loopRef.current = next;
    setLoop(next);
  }

  function markLoopStart() {
    const t = chart ? barStartAt(currentPosition()) : currentPosition();
    const end = loopRef.current?.end;
    updateLoop({ start: t, end: end != null && end >= t + MIN_LOOP_S ? end : null });
  }

  function loopEndCandidate() {
    return chart ? barEndAt(currentPosition()) : currentPosition();
  }

  function canEndLoop() {
    return loopEndCandidate() >= (loopRef.current?.start ?? 0) + MIN_LOOP_S;
  }

  function toggleCountIn() {
    countInRef.current = !countIn;
    setCountIn(!countIn);
    remember("rw-count-in", !countIn);
  }

  function toggleMetronome() {
    metronomeRef.current = !metronome;
    setMetronome(!metronome);
    remember("rw-metronome", !metronome);
    if (metronome) stopClicks(ctxRef.current?.currentTime ?? 0);
  }

  function chooseView(next) {
    setView(next);
    try {
      window.localStorage.setItem("rw-player-view", next);
    } catch {
      // Only a convenience: it just won't be remembered.
    }
  }

  // "Record your take" in the transport: shows the studio on its recorder and brings the record key into
  // view with focus on it. The view this browser remembers is left as it was chosen.
  function openRecorder() {
    setView("studio");
    studioTabsRef.current?.choose("recorder");
    requestAnimationFrame(() => {
      const key = studioRef.current?.querySelector(".rw-deck-key");
      if (!key) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      key.scrollIntoView({ block: "center", behavior: still ? "instant" : "smooth" });
      key.focus({ preventScroll: true });
    });
  }

  function dismissIntro() {
    setIntro(false);
    remember("rw-player-intro", true);
  }

  function loopSection(start, end) {
    updateLoop({ start, end });
    seek(start);
  }

  // With a chart the loop ends at the end of this bar, so it plays out first; without one it
  // ends here and jumps straight back, like any A–B repeat.
  function markLoopEnd() {
    updateLoop({ start: loopRef.current?.start ?? 0, end: loopEndCandidate() });
  }

  function currentPosition() {
    if (!playing || countingIn()) return offsetRef.current;
    return Math.min(duration, Math.max(0, (ctxRef.current.currentTime - startedAtRef.current) * speedRef.current));
  }

  async function play() {
    // Browsers keep audio suspended until the user clicks something.
    await ctxRef.current.resume();
    // A saved slow speed, or a new take heard at this speed for the first time.
    if (speedRef.current !== 1 && !(await readyForSlowSpeed())) {
      speedRef.current = 1;
      setSpeed(1);
    }
    // Pressing play after the loop's end goes back to its start.
    const current = loopRef.current;
    if (current?.end != null && offsetRef.current >= current.end) offsetRef.current = current.start;
    startWithCountIn(offsetRef.current);
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
    metersRef.current.mic = analyser(ctx);
    source.connect(metersRef.current.mic);
    setMicLabel(stream.getAudioTracks()[0]?.label || "");
    const worklet = new AudioWorkletNode(ctx, "rw-recorder");
    worklet.port.onmessage = (e) => {
      if (!recordingRef.current) return;
      chunksRef.current.push(e.data);
      const { samples } = e.data;
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      micLevelRef.current = Math.sqrt(sum / samples.length);
    };
    // The worklet only runs while connected to the output. The muted gain keeps the mic out of your ears.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(worklet).connect(mute).connect(ctx.destination);
    micRef.current = { stream, worklet };
    return micRef.current;
  }

  function micProblem(err) {
    console.error("Microphone unavailable:", err);
    setMicError(
      err.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
        : "No microphone found."
    );
  }

  // Opens the mic just to watch its level, before recording anything.
  async function checkMic() {
    setMicError("");
    try {
      await ctxRef.current.resume();
      await ensureMic();
      setMonitoring(true);
    } catch (err) {
      micProblem(err);
    }
  }

  async function startRecording() {
    setMicError("");
    let mic;
    try {
      await ctxRef.current.resume();
      mic = await ensureMic();
    } catch (err) {
      micProblem(err);
      return;
    }
    stopSources();
    // A take lines up with the song in real time, so it's always recorded at full speed.
    speedRef.current = 1;
    setSpeed(1);
    chunksRef.current = [];
    recordingRef.current = true;
    setRecordFrom(offsetRef.current);
    mic.worklet.port.postMessage("start");
    startWithCountIn(offsetRef.current);
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
    setTakeCount((n) => n + 1);
    setTakeName("");
    setMix((m) => ({ ...m, takeMuted: false }));
  }

  // A take is called by its number until it's given a name.
  const takeTitle = takeName.trim() || `Take ${takeCount}`;

  // Plays the song from just before the take comes in, so you hear yourself with the band.
  function playTake() {
    if (playingRef.current) {
      pause();
      return;
    }
    const from = Math.max(0, (takeRef.current?.songTime ?? 0) - nudgeRef.current / 1000 - 1);
    offsetRef.current = from;
    setPosition(from);
    play();
  }

  function changeNudge(ms) {
    const t = currentPosition();
    nudgeRef.current = ms;
    setNudgeMs(ms);
    if (playing) startAt(t);
  }

  function deleteTake() {
    const t = currentPosition();
    takeRef.current = null;
    setTake(null);
    nudgeRef.current = 0;
    setNudgeMs(0);
    if (playing) startAt(t);
  }

  async function sendTake() {
    const blob = toWav(take.buffer);
    setSendError("");
    if (blob.size > MAX_RECORDING_BYTES) {
      setSendError("This take is too long to send. Recordings can be up to about 7 minutes.");
      return;
    }
    setSendProgress(0);
    try {
      await onSendTake({ blob, offset: take.songTime - nudgeMs / 1000, duration: take.buffer.duration }, setSendProgress);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSendProgress(null);
    }
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
        gain.gain.value = levels[part].gain * makeup[part];
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
      a.download = `${title} - ${takeTitle}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setExporting(false);
    }
  }

  // ---------- What the interface reads ----------
  // Steady functions for the parts of the page that follow the audio clock or the meters every
  // frame, so they don't restart on each render.
  const liveRef = useRef(null);
  useEffect(() => {
    liveRef.current = { positionNow, countInBeat, beatNow };
  });
  const getPosition = useCallback(() => liveRef.current?.positionNow() ?? 0, []);
  const getCountInBeat = useCallback(() => liveRef.current?.countInBeat() ?? -1, []);
  const getBeat = useCallback(() => liveRef.current?.beatNow() ?? -1, []);
  const partMeters = useMemo(() => Object.fromEntries(parts.map((p) => [p, () => [metersRef.current.parts[p]]])), [parts]);
  const getMaster = useCallback(() => metersRef.current.master, []);
  const getTake = useCallback(() => [metersRef.current.take], []);
  const getMic = useCallback(() => (metersRef.current.mic ? [metersRef.current.mic] : []), []);
  const clock = useMemo(() => ({ getPosition, playing }), [getPosition, playing]);

  const levels = useMemo(() => stemLevels(mix, mode, focus, parts), [mix, mode, focus, parts]);
  // Why each part is or isn't heard, in the order that explains it best.
  const states = useMemo(() => {
    const anySolo = parts.some((p) => mix.stems[p]?.soloed);
    return Object.fromEntries(
      parts.map((p) => {
        const s = mix.stems[p];
        const inMode = mode === "solo" ? p === focus : mode === "minus" ? p !== focus : true;
        return [p, s?.muted ? "muted" : !inMode ? "off" : anySolo && !s?.soloed ? "silent" : s?.soloed ? "solo" : "playing"];
      })
    );
  }, [mix, mode, focus, parts]);
  const takePeaks = useMemo(() => (take ? peaksOf(take.buffer) : null), [take]);
  const takeStart = take ? take.songTime - nudgeMs / 1000 : 0;
  const takeLabel = take ? review?.label || "Your take" : null;
  const lanes = useMemo(() => {
    const list = parts.map((p) => ({
      id: p,
      label: student ? (p === ownPart ? `Your ${noun}` : "Backing band") : p === myPart ? `${p} (${partLabel})` : p,
      color: partColor(p),
      state: states[p],
      peaks: peaks[p] ?? null,
      getMeter: partMeters[p],
    }));
    if (take) list.push({ id: "take", label: takeLabel, color: partColor("take"), state: mix.takeMuted ? "muted" : "playing", peaks: takePeaks, offset: takeStart, getMeter: getTake });
    return list;
  }, [parts, student, ownPart, noun, myPart, partLabel, states, peaks, partMeters, take, takeLabel, mix.takeMuted, takePeaks, takeStart, getTake]);

  if (status === "error") {
    return <div style={panel}>The tracks couldn&apos;t be loaded. Refresh the page to try again.</div>;
  }

  const ready = status === "ready";

  // "Whole song" means every part, so it also clears any solo or mute left in the mixer.
  // Those are saved with the session, so one can come back from an earlier visit.
  function playAllParts() {
    setMode("full");
    setMix((m) => ({
      ...m,
      stems: Object.fromEntries(Object.entries(m.stems).map(([part, stem]) => [part, { ...stem, muted: false, soloed: false }])),
    }));
  }

  // Students have no mute or solo (the server keeps them off), so nothing can be held back unseen.
  const heldBack = !student && parts.some((p) => mix.stems[p]?.soloed || mix.stems[p]?.muted);
  const playingParts = parts.filter((p) => levels[p].audible);

  function applyPreset(s) {
    setMix(mixFromSettings(s, parts));
    const modeReady = !studentModes || studentModes.some((m) => m.id === s.mode && m.ready);
    if (MIX_MODES.includes(s.mode) && modeReady) setMode(s.mode);
    if (!student && parts.includes(s.focus)) setFocus(s.focus);
    if (s.effects) setFx({ ...DEFAULT_EFFECTS, ...s.effects });
  }

  // Why a student's mode is off, when one is: said once, beside the modes.
  const modeNote = !student
    ? null
    : !ownPart
      ? `This recording has no separate ${noun} track, so it plays as the whole song.`
      : !hasBacking
        ? `The backing band for this song is still being prepared, so for now you can play your ${noun} on its own.`
        : null;

  // Where the song is, by the chart: section, and bar within it.
  let where = null;
  if (chart && position < chart.end) {
    const s = chart.sections.findLastIndex((sec) => sec.bars[0].time <= position + 0.001);
    if (s >= 0) {
      const bars = chart.sections[s].bars;
      where = { section: chart.sections[s].name, bar: bars.findLastIndex((b) => b.time <= position + 0.001) + 1, bars: bars.length };
    }
  }

  // One line on what to try next, for someone new to practising like this. Practice work ends in a
  // take for the teacher, and takes always record at full speed, so slowing down is only ever the way
  // there: it says so, rather than a speed ladder that reads against the teacher's "at full speed".
  const nextSpeed = SPEEDS.find((s) => s > speed);
  const forTeacher = Boolean(onSendTake);
  const coach = !ready
    ? null
    : recording
      ? "Keep going to the end of the part, then press Stop."
      : take
        ? `Listen back with your take, nudge it into time if it sounds early or late, then ${onSendTake ? "send it to your teacher" : "download it"}.`
        : forTeacher && speed < 1
          ? "Start slowly, then record your final take at 100%."
          : loop?.end != null
            ? nextSpeed
              ? `Repeat this loop until it feels easy, then step up to ${Math.round(nextSpeed * 100)}%.`
              : forTeacher
                ? "You're at full speed. When it feels solid, record your take."
                : "You're looping at full speed. When it's solid, clear the loop and play the whole song."
            : speed < 1
              ? `When ${Math.round(speed * 100)}% feels easy, try ${Math.round(nextSpeed * 100)}%.`
              : !playing && position < 1
                ? "Press Play, or Space, and follow along. Stuck on a part? Drag across its bars on the Loop strip to repeat it."
                : "Tricky bar? Drag across it on the Loop strip above to repeat it, and slow it down with Speed.";

  const bandHeader = (
    <div className="rw-tl-header">
      {student ? (
        <div role="group" aria-label="What plays" className="rw-tp-group">
          <span className="rw-tp-label">Play</span>
          <span className="rw-seg">
            {studentModes.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id} disabled={!m.ready}>
                {m.label}
              </button>
            ))}
          </span>
        </div>
      ) : (
        <div role="group" aria-label="Band" className="rw-tp-group">
          <span className="rw-tp-label">Band</span>
          <span className="rw-seg">
            {bandModes(focus).map((m) => (
              <button key={m.id} type="button" onClick={() => (m.id === "full" ? playAllParts() : setMode(m.id))} aria-pressed={mode === m.id}>
                {m.label}
              </button>
            ))}
          </span>
        </div>
      )}
      {modeNote && (
        <p role="note" className="rw-tl-note rw-tl-note-quiet">
          {modeNote}
        </p>
      )}
      {!student && mode !== "full" && (
        <div role="group" aria-label={mode === "solo" ? "Only this part" : "Leave out"} className="rw-tp-group">
          <span className="rw-tp-label">{mode === "solo" ? "Only" : "Leave out"}</span>
          {parts.map((p) => (
            <button key={p} type="button" onClick={() => setFocus(p)} aria-pressed={focus === p} className="rw-focus-chip" style={{ "--lane": partColor(p) }}>
              {p}
              {p === myPart ? ` (${partLabel})` : ""}
            </button>
          ))}
        </div>
      )}
      {!review && (
        <div role="group" aria-label="Loop a section" className="rw-tp-group rw-tl-loopkeys">
          <span className="rw-tp-label">Loop</span>
          <button type="button" className="rw-btn rw-btn-small" onClick={markLoopStart} disabled={!ready || recording} title="Loop from the start of this bar ([)">
            {loop ? `Start ${fmtT(loop.start)}` : "Set start"}
          </button>
          <button
            type="button"
            className="rw-btn rw-btn-small"
            onClick={markLoopEnd}
            disabled={!ready || recording || (chart ? barEndAt(position) : position) < (loop?.start ?? 0) + MIN_LOOP_S}
            title="End the loop at the end of this bar (])"
          >
            {loop?.end != null ? `End ${fmtT(loop.end)}` : "Set end"}
          </button>
          {loop && (
            <button type="button" className="rw-btn rw-btn-small" onClick={() => updateLoop(null)} disabled={recording}>
              Clear
            </button>
          )}
        </div>
      )}
      {!review && chart && (
        <button
          type="button"
          className="rw-btn rw-tl-view"
          onClick={() => chooseView(simple ? "studio" : "simple")}
          aria-expanded={!simple}
          aria-controls={studioId}
          title="Each part's lane, the mixer, the recorder and effects"
        >
          <Icon name="sliders" size={16} />
          {simple ? "Open studio mixer" : "Close studio mixer"}
        </button>
      )}
      {heldBack && (
        <div role="status" className="rw-tl-note">
          <span>
            Solo or mute is on in the mixer, so {playingParts.length ? `only ${playingParts.join(", ")} ${playingParts.length === 1 ? "is" : "are"} playing` : "nothing is playing"}.
          </span>
          <button type="button" className="rw-btn rw-btn-small" onClick={playAllParts}>
            Play all parts
          </button>
        </div>
      )}
    </div>
  );

  const shortcuts = (
    <details className="rw-shortcuts">
      <summary>Keyboard shortcuts</summary>
      <p>
        <kbd style={kbd}>Space</kbd> play or pause · <kbd style={kbd}>←</kbd> <kbd style={kbd}>→</kbd> {chart ? "previous or next bar (with Shift, section)" : "back or forward 5 seconds"} ·{" "}
        <kbd style={kbd}>Home</kbd> start · <kbd style={kbd}>[</kbd> <kbd style={kbd}>]</kbd> loop start and end · <kbd style={kbd}>\</kbd> clear the loop
      </p>
    </details>
  );

  const mixerTab = {
    id: "mixer",
    label: "Mixer",
    content: (
      <>
        {student ? (
          <PartBalance
            instrument={instrument}
            ownPart={ownPart}
            mix={mix}
            mode={mode}
            levels={levels}
            onChange={setMix}
            takeLabel={takeLabel}
            onReset={() => setMix(defaultMix(parts))}
            meters={partMeters}
            getMaster={getMaster}
            getTake={getTake}
            active={playing}
          />
        ) : (
          <MixerPanel
            parts={parts}
            mix={mix}
            levels={levels}
            states={states}
            onChange={setMix}
            takeLabel={takeLabel}
            onReset={() => setMix(defaultMix(parts))}
            meters={partMeters}
            getMaster={getMaster}
            getTake={getTake}
            active={playing}
          />
        )}
        {songId && !review && (
          <div className="rw-studio-block">
            <MixPresets songId={songId} getSettings={() => ({ mode, focus, ...mix, effects: fx })} onApply={applyPreset} example={student ? "Quiet band" : undefined} />
          </div>
        )}
      </>
    ),
  };

  const studioTabs = review
    ? [
        mixerTab,
        {
          id: "take",
          label: "The take",
          content: (
            <div className="rw-recorder">
              <label className="rw-nudge">
                <span className="rw-nudge-head">
                  <span>Line up the take</span>
                  <output>{nudgeMs > 0 ? `${nudgeMs} ms earlier` : nudgeMs < 0 ? `${-nudgeMs} ms later` : "as sent"}</output>
                </span>
                <input type="range" className="rw-range" min={-NUDGE_LIMIT_MS} max={NUDGE_LIMIT_MS} step={5} value={nudgeMs} onChange={(e) => changeNudge(Number(e.target.value))} disabled={!take} />
              </label>
              <p className="rw-studio-hint">The take plays where it was recorded in the song. Phones can be a little off, so nudge it if it sounds early or late before judging the timing.</p>
            </div>
          ),
        },
      ]
    : [
        mixerTab,
        {
          id: "recorder",
          label: "Recorder",
          badge: recording ? <span className="rw-rec-dot" aria-label="recording" /> : null,
          content: (
            <RecordPanel
              ready={ready}
              playing={playing}
              recording={recording}
              monitoring={monitoring}
              take={take}
              takePeaks={takePeaks}
              takeStart={takeStart}
              position={position}
              duration={duration}
              recordTime={recording ? Math.max(0, position - recordFrom) : 0}
              getPosition={getPosition}
              getMic={getMic}
              micLevel={micLevelRef}
              micLabel={micLabel}
              micError={micError}
              onRecord={startRecording}
              onStop={stopRecording}
              onCheckMic={checkMic}
              onStopCheck={() => setMonitoring(false)}
              nudgeMs={nudgeMs}
              onNudge={changeNudge}
              onSend={onSendTake ? sendTake : null}
              sendProgress={sendProgress}
              sendError={sendError}
              onDownload={downloadMix}
              exporting={exporting}
              onDelete={deleteTake}
              takeName={takeTitle}
              takeInput={takeName}
              nextTakeName={`Take ${takeCount + 1}`}
              onRename={setTakeName}
              onPlayTake={playTake}
            />
          ),
        },
        {
          id: "effects",
          label: "Effects",
          disabled: !take,
          hint: "Record a take to put effects on it",
          content: take ? <EffectsRack fx={fx} onChange={setFx} getTake={getTake} active={playing} /> : null,
        },
      ];

  return (
    <PlayClock.Provider value={clock}>
    <div className="rw-player" data-review={review ? "true" : undefined} data-view={view}>
      {instrument && (
        <p className="rw-player-instrument" style={{ "--lane": partColor(myPart) }}>
          <span aria-hidden="true" className="rw-part-swatch" />
          Your instrument: <strong>{instrument}</strong>
        </p>
      )}
      {intro && simple && (
        <section className="rw-intro" aria-labelledby="player-intro">
          <h2 id="player-intro" className="rw-intro-title">
            New to the player?
          </h2>
          <ol className="rw-intro-steps">
            <li>Press Play, or Space, and follow along. {chart ? "The chart shows the chord to play now." : ""}</li>
            <li>Too fast? Pick a lower Speed.</li>
            <li>To repeat a tricky part, drag across its bars on the Loop strip{chart ? ", or press Loop beside a section in the chart" : ""}.</li>
          </ol>
          <p className="rw-intro-more">
            {student
              ? `Play, beside the timeline, switches between the whole song, the band without your ${noun}, and your ${noun} alone. Open studio mixer balances your ${noun} against the band, and Record your take opens the recorder.`
              : "Open studio mixer shows each part's lane and the mixer, and Record your take opens the recorder."}
          </p>
          <button type="button" className="rw-btn rw-intro-ok" onClick={dismissIntro}>
            Got it
          </button>
        </section>
      )}
      <Transport
        ready={ready}
        loadedCount={loadedCount}
        total={parts.length}
        playing={playing}
        recording={recording}
        review={Boolean(review)}
        onPlayPause={playing ? pause : play}
        onStep={(direction) => stepBar(direction, false)}
        hasChart={Boolean(chart)}
        position={position}
        duration={duration}
        where={where}
        speed={speed}
        speeds={SPEEDS}
        onSpeed={changeSpeed}
        preparingSpeed={preparingSpeed}
        speedError={speedError}
        countIn={countIn}
        onCountIn={toggleCountIn}
        metronome={metronome}
        onMetronome={toggleMetronome}
        getBeat={getBeat}
        getCountInBeat={getCountInBeat}
        loop={loop}
        onClearLoop={() => updateLoop(null)}
        recordTime={recording ? Math.max(0, position - recordFrom) : 0}
        getMaster={getMaster}
        onOpenRecorder={review ? null : openRecorder}
      />

      <Timeline
        duration={duration}
        chart={chart}
        lanes={simple ? [] : lanes}
        loop={loop}
        snap={{ start: (t) => (chart ? barStartAt(t) : t), end: (t) => (chart ? barEndAt(t) : t) }}
        onLoop={loopSection}
        getPosition={getPosition}
        playing={playing}
        position={position}
        onSeek={seek}
        disabled={!ready || recording}
        header={bandHeader}
        footer={
          <div className="rw-tl-footer">
            {!chart && !review && coach && <p className="rw-coach">{coach}</p>}
            {shortcuts}
          </div>
        }
      />

      <div className="rw-player-cols" data-chart={chart && !review && !simple ? "true" : "false"}>
        {chart && !review && (
          <section className="rw-practice" aria-label="Play along">
            <ChordChart
              chart={chart}
              position={position}
              myPart={myPart}
              instrument={instrument || null}
              partAvailable={available?.chart ?? true}
              loop={loop}
              disabled={!ready || recording}
              onSeek={seek}
              onLoopSection={loopSection}
              coach={coach}
            />
          </section>
        )}
        {/* Hidden rather than removed, so a recording or mic check keeps its panel. */}
        <aside id={studioId} ref={studioRef} className="rw-studio" aria-label="Studio" hidden={simple}>
          <StudioTabs ref={studioTabsRef} tabs={studioTabs} />
        </aside>
      </div>
    </div>
    </PlayClock.Provider>
  );
}

const kbd = {
  display: "inline-block",
  minWidth: 18,
  padding: "0 5px",
  border: "1px solid var(--rw-line)",
  borderBottomWidth: 2,
  borderRadius: "var(--rw-radius-sm)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: "18px",
  textAlign: "center",
};

const panel = {
  padding: 28,
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
  color: "var(--rw-body)",
};
