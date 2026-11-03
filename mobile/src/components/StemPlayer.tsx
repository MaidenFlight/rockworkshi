import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
  GainNode,
} from "react-native-audio-api";
import { colors } from "@/lib/theme";
import {
  Mix,
  MIX_MODES,
  Mode,
  createMasterBus,
  defaultMix,
  mixFromSettings,
  percentToGain,
  rampTo,
  stemLevels,
  takeLevel,
} from "@/lib/audio/mix";
import { DEFAULT_EFFECTS, Effects, createTakeEffects } from "@/lib/audio/takeEffects";
import { Icon } from "@/components/Icon";
import { MixerPanel } from "@/components/mixer/MixerPanel";
import { EffectsRack } from "@/components/mixer/EffectsRack";
import { MixPresets, PresetSettings } from "@/components/mixer/MixPresets";
import type { Session } from "@/lib/library";

// Same design as the website's player (frontend/components/member/StemPlayer.js):
// every stem always plays in sync and modes only change which are audible.

export type Track = { part: string; url: string };
type Take = { buffer: AudioBuffer; songTime: number }; // songTime = song position of the take's first sample
type Loop = { start: number; end: number | null }; // only repeats once end is set

const MODES: { id: Mode; label: string }[] = [
  { id: "full", label: "Whole song" },
  { id: "solo", label: "Isolated" },
  { id: "minus", label: "Without one" },
];

const SPEEDS = [0.5, 0.75, 0.9, 1];
const NUDGE_STEP_MS = 10;
const NUDGE_LIMIT_MS = 300;
const MIN_LOOP_S = 1;
// The next pass of a loop is scheduled this far before the loop end, so it starts on time
// even though the timer that checks only runs every 100 ms.
const LOOP_LOOKAHEAD_S = 0.3;

function fmtT(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export type TakeToSave = { samples: Float32Array; sampleRate: number; offset: number };

type Props = {
  tracks: Track[];
  myPart: string | null;
  // A section to loop from the start, e.g. the part a teacher assigned.
  initialLoop?: { start: number; end: number } | null;
  // Offered after recording when the song was opened from an assignment.
  onSaveTake?: (take: TakeToSave) => Promise<void>;
  // Turns on saved mixes for the signed-in student.
  songId?: string;
  // From the API: how loud the stems sum. Sets the headroom.
  mixLevel?: number | null;
  // The student's saved session for this song: the player opens there, paused.
  // An assignment's initialLoop wins over the saved loop and position.
  resume?: Session | null;
  // Called now and then while practising, and on pause, leave and backgrounding.
  onSaveSession?: (session: Session) => Promise<unknown>;
};

export function StemPlayer({
  tracks,
  myPart,
  initialLoop = null,
  onSaveTake,
  songId,
  mixLevel = null,
  resume = null,
  onSaveSession,
}: Props) {
  const parts = useMemo(() => tracks.map((t) => t.part), [tracks]);
  const saved = resume?.mixer;
  const startLoop: Loop | null = initialLoop ?? resume?.loop ?? null;
  const startPosition = initialLoop?.start ?? resume?.position ?? 0;
  const startSpeed = resume?.speed && SPEEDS.includes(resume.speed) ? resume.speed : 1;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedCount, setLoadedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startPosition);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<Mode>(saved && MIX_MODES.includes(saved.mode) ? saved.mode : "full");
  const [focus, setFocus] = useState(
    saved?.focus && parts.includes(saved.focus) ? saved.focus : myPart && parts.includes(myPart) ? myPart : parts[0]
  );
  const [barWidth, setBarWidth] = useState(1);
  const [speed, setSpeed] = useState(startSpeed);
  const [loop, setLoop] = useState<Loop | null>(startLoop);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const [nudgeMs, setNudgeMs] = useState(0); // positive moves the take earlier
  const [micError, setMicError] = useState("");
  const [mix, setMix] = useState<Mix>(() => (saved ? mixFromSettings(saved, parts) : defaultMix(parts)));
  const [fx, setFx] = useState<Effects>(saved?.effects ? { ...DEFAULT_EFFECTS, ...saved.effects } : DEFAULT_EFFECTS);

  // stems -> per-stem gain -> master bus; take -> effects -> take gain -> master bus.
  const ctxRef = useRef<AudioContext | null>(null);
  const busRef = useRef<ReturnType<typeof createMasterBus> | null>(null);
  const fxRef = useRef<ReturnType<typeof createTakeEffects> | null>(null);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const gainsRef = useRef<Record<string, GainNode>>({});
  const takeGainRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const endingRef = useRef<AudioBufferSourceNode[]>([]); // replaced sources still playing until their stop time
  // Context time at which song position 0 played (or would have, at the current speed).
  // Song position = (context time - startedAt) * speed.
  const startedAtRef = useRef(0);
  const offsetRef = useRef(startPosition); // song position to resume from while paused

  // Read inside callbacks that would otherwise see stale state.
  const playingRef = useRef(false);
  const speedRef = useRef(startSpeed);
  const loopRef = useRef<Loop | null>(startLoop);
  const takeRef = useRef<Take | null>(null);
  const nudgeRef = useRef(0);
  const recordingRef = useRef(false);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const chunkRateRef = useRef(0);
  const sessionStartRef = useRef(Infinity); // context time the recorder session started

  // ---------- Resume state ----------
  // Saved every 15 s while playing, a few seconds after a settings change, on pause, when
  // leaving the song and when the app goes to the background. Never per playhead tick,
  // and only when something actually changed.
  const latestRef = useRef<{ mix: Mix; mode: Mode; focus: string; fx: Effects; ready: boolean } | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const onSaveRef = useRef(onSaveSession);
  useEffect(() => {
    latestRef.current = { mix, mode, focus, fx, ready: status === "ready" };
    onSaveRef.current = onSaveSession;
  });

  function positionNow() {
    const ctx = ctxRef.current;
    if (!playingRef.current || !ctx) return offsetRef.current;
    return Math.max(0, (ctx.currentTime - startedAtRef.current) * speedRef.current);
  }

  function saveSession() {
    const latest = latestRef.current;
    if (!onSaveRef.current || !latest?.ready || recordingRef.current) return;
    const session: Session = {
      position: Math.round(positionNow() * 10) / 10,
      speed: speedRef.current,
      loop: loopRef.current,
      mixer: { mode: latest.mode, focus: latest.focus, ...latest.mix, effects: latest.fx },
    };
    const json = JSON.stringify(session);
    if (json === lastSavedRef.current) return;
    lastSavedRef.current = json;
    onSaveRef.current(session).catch(() => {
      lastSavedRef.current = null; // try again at the next save point
    });
  }

  // Declared before the audio graph so its cleanup runs first, while the clock still reads.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") saveSession();
    });
    return () => {
      sub.remove();
      saveSession();
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

  // Download and decode every stem once.
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

    Promise.all(
      tracks.map(async (t) => {
        const buffer = await ctx.decodeAudioData(t.url);
        if (!cancelled) setLoadedCount((n) => n + 1);
        return [t.part, buffer] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        buffersRef.current = Object.fromEntries(entries);
        const length = Math.max(...entries.map(([, b]) => b.duration));
        setDuration(length);
        // A session saved at the very end starts again from the top.
        if (offsetRef.current >= length - 1) {
          offsetRef.current = 0;
          setPosition(0);
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
      if (recordingRef.current) recorderRef.current?.stop();
      recorderRef.current?.clearOnAudioReady();
      ctx.close();
    };
  }, [tracks, mixLevel]);

  // Mode, volume, mute and solo all land here as smoothed gain changes on the running
  // graph, so none of them restarts playback, breaks a loop or changes the speed.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !busRef.current || !takeGainRef.current) return;
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

  // Move the playhead while playing, repeat the loop, and stop at the end.
  // 10 updates a second is plenty for a time label.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const ctx = ctxRef.current!;
      const current = loopRef.current;
      if (current?.end != null && !recordingRef.current) {
        const loopEndsAt = startedAtRef.current + current.end / speedRef.current;
        if (loopEndsAt - ctx.currentTime < LOOP_LOOKAHEAD_S) {
          startAt(current.start, Math.max(loopEndsAt, ctx.currentTime + 0.05));
        }
      }

      const t = (ctx.currentTime - startedAtRef.current) * speedRef.current;
      if (t >= duration) {
        if (recordingRef.current) stopRecording();
        else stopSources();
        offsetRef.current = 0;
        setPosition(0);
        setPlayingBoth(false);
        return;
      }
      setPosition(Math.max(0, t));
    }, 100);
    return () => clearInterval(id);
    // startAt and stopRecording only read refs, so they don't need to restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  function setPlayingBoth(value: boolean) {
    playingRef.current = value;
    setPlaying(value);
  }

  function stopSources(at = 0) {
    for (const src of [...endingRef.current, ...sourcesRef.current]) {
      try {
        src.stop(at);
      } catch {
        // Never started.
      }
    }
    endingRef.current = [];
    sourcesRef.current = [];
  }

  // A source node plays once, so every play, seek or loop pass makes fresh ones,
  // scheduled slightly ahead so all stems start on the same sample.
  // The old ones stop exactly when the new ones start, so there's no gap.
  function startAt(offset: number, when = ctxRef.current!.currentTime + 0.05) {
    const ctx = ctxRef.current!;
    const rate = speedRef.current;
    for (const src of [...endingRef.current, ...sourcesRef.current]) src.stop(when);
    endingRef.current = sourcesRef.current;

    // Pitch correction keeps slowed-down music in tune. Only needed off full speed.
    const makeSource = (buffer: AudioBuffer, output: GainNode) => {
      const src = ctx.createBufferSource({ pitchCorrection: rate !== 1 });
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(output);
      return src;
    };

    sourcesRef.current = parts.map((part) => {
      const src = makeSource(buffersRef.current[part], gainsRef.current[part]);
      src.start(when, offset);
      return src;
    });

    const current = takeRef.current;
    if (current && !recordingRef.current) {
      const src = makeSource(current.buffer, fxRef.current!.input);
      const takeStart = current.songTime - nudgeRef.current / 1000;
      if (offset >= takeStart) src.start(when, offset - takeStart);
      else src.start(when + (takeStart - offset) / rate);
      sourcesRef.current.push(src);
    }

    startedAtRef.current = when - offset / rate;
  }

  function currentPosition() {
    if (!playingRef.current) return offsetRef.current;
    const t = (ctxRef.current!.currentTime - startedAtRef.current) * speedRef.current;
    return Math.min(duration, Math.max(0, t));
  }

  async function play() {
    await ctxRef.current!.resume();
    // Pressing play after the loop's end goes back to its start.
    const current = loopRef.current;
    if (current?.end != null && offsetRef.current >= current.end) offsetRef.current = current.start;
    startAt(offsetRef.current);
    setPlayingBoth(true);
  }

  function pause() {
    offsetRef.current = currentPosition();
    stopSources();
    setPosition(offsetRef.current);
    setPlayingBoth(false);
    saveSession();
  }

  function seek(t: number) {
    offsetRef.current = t;
    setPosition(t);
    if (playingRef.current) startAt(t);
  }

  function skip(delta: number) {
    seek(Math.min(duration, Math.max(0, currentPosition() + delta)));
  }

  function changeSpeed(value: number) {
    const t = currentPosition(); // read at the old speed
    speedRef.current = value;
    setSpeed(value);
    if (playingRef.current) startAt(t);
  }

  function updateLoop(next: Loop | null) {
    loopRef.current = next;
    setLoop(next);
  }

  function markLoopStart() {
    const t = currentPosition();
    const end = loopRef.current?.end;
    updateLoop({ start: t, end: end != null && end >= t + MIN_LOOP_S ? end : null });
  }

  // Marking the end while playing jumps straight back to the start, like any A–B repeat.
  function markLoopEnd() {
    updateLoop({ start: loopRef.current?.start ?? 0, end: currentPosition() });
  }

  // The recorder reports times from the start of its own session, not the playback clock.
  // Each callback arrives a little after its audio was captured, so
  // now - (when + length) is the session start plus that delay; the smallest one is closest.
  function ensureRecorder() {
    if (recorderRef.current) return recorderRef.current;
    const ctx = ctxRef.current!;
    const recorder = new AudioRecorder();
    recorder.onAudioReady({ sampleRate: ctx.sampleRate, bufferLength: 1024, channelCount: 1 }, (e) => {
      if (!recordingRef.current) return;
      const samples = new Float32Array(e.buffer.getChannelData(0));
      chunksRef.current.push(samples);
      chunkRateRef.current = e.buffer.sampleRate;
      const sessionStart = ctx.currentTime - (e.when + e.numFrames / e.buffer.sampleRate);
      if (sessionStart < sessionStartRef.current) sessionStartRef.current = sessionStart;
    });
    recorderRef.current = recorder;
    return recorder;
  }

  async function startRecording() {
    setMicError("");
    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== "Granted") {
      setMicError("Microphone access is off. Turn it on for Rock Works in your phone's settings.");
      return;
    }
    await ctxRef.current!.resume();
    const recorder = ensureRecorder();
    offsetRef.current = currentPosition(); // record from where the song is now, if it's playing
    stopSources();
    // A take is lined up with the song in real time, so it's always recorded at full speed.
    speedRef.current = 1;
    setSpeed(1);
    chunksRef.current = [];
    sessionStartRef.current = Infinity;
    recordingRef.current = true;
    const result = await recorder.start();
    if (result.status === "error") {
      recordingRef.current = false;
      setMicError(`Couldn't start recording: ${result.message}`);
      return;
    }
    startAt(offsetRef.current);
    setRecording(true);
    setPlayingBoth(true);
  }

  async function stopRecording() {
    const ctx = ctxRef.current!;
    recordingRef.current = false;
    offsetRef.current = currentPosition();
    stopSources();
    setPosition(offsetRef.current);
    setRecording(false);
    setPlayingBoth(false);
    await recorderRef.current?.stop();

    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length || !Number.isFinite(sessionStartRef.current)) return;
    const length = chunks.reduce((n, c) => n + c.length, 0);
    const buffer = ctx.createBuffer(1, length, chunkRateRef.current);
    let i = 0;
    for (const c of chunks) {
      buffer.copyToChannel(c as Float32Array<ArrayBuffer>, 0, i);
      i += c.length;
    }
    // Speaker and mic delays aren't reported on Android, so the nudge buttons cover them.
    takeRef.current = { buffer, songTime: sessionStartRef.current - startedAtRef.current };
    setTake(takeRef.current);
    setMix((m) => ({ ...m, takeMuted: false }));
    setSaveState("idle");
  }

  function changeNudge(deltaMs: number) {
    const ms = Math.max(-NUDGE_LIMIT_MS, Math.min(NUDGE_LIMIT_MS, nudgeRef.current + deltaMs));
    nudgeRef.current = ms;
    setNudgeMs(ms);
    setSaveState("idle"); // a saved copy would have the old timing
    if (playingRef.current) startAt(currentPosition());
  }

  function deleteTake() {
    takeRef.current = null;
    setTake(null);
    nudgeRef.current = 0;
    setNudgeMs(0);
    setSaveState("idle");
    if (playingRef.current) startAt(currentPosition());
  }

  async function saveTake() {
    const current = takeRef.current;
    if (!current || !onSaveTake) return;
    setSaveState("saving");
    try {
      await onSaveTake({
        samples: current.buffer.getChannelData(0),
        sampleRate: current.buffer.sampleRate,
        offset: current.songTime - nudgeRef.current / 1000, // the nudge is baked in
      });
      setSaveState("saved");
    } catch (err) {
      console.error("Could not save take:", err);
      setSaveState("error");
    }
  }

  if (status === "error") {
    return (
      <View style={styles.panel}>
        <Text style={styles.meta}>The tracks couldn&apos;t be loaded. Go back and open the song again.</Text>
      </View>
    );
  }

  const ready = status === "ready";
  const levels = stemLevels(mix, mode, focus, parts);

  function applyPreset(preset: PresetSettings) {
    setMix(mixFromSettings(preset, parts));
    if (MIX_MODES.includes(preset.mode)) setMode(preset.mode);
    if (preset.focus && parts.includes(preset.focus)) setFocus(preset.focus);
    if (preset.effects) setFx({ ...DEFAULT_EFFECTS, ...preset.effects });
  }
  const progress = duration ? position / duration : 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Play</Text>
      <View style={styles.row}>
        {MODES.map((m) => (
          <Chip key={m.id} label={m.label} active={mode === m.id} onPress={() => setMode(m.id)} />
        ))}
      </View>

      {mode !== "full" && (
        <>
          <Text style={[styles.heading, styles.gapTop]}>{mode === "solo" ? "Only this part" : "Leave out"}</Text>
          <View style={styles.row}>
            {parts.map((p) => (
              <Chip key={p} label={p === myPart ? `${p} (yours)` : p} active={focus === p} onPress={() => setFocus(p)} />
            ))}
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.heading}>Mixer</Text>
        <MixerPanel
          parts={parts}
          mix={mix}
          levels={levels}
          onChange={setMix}
          takeLabel={take ? "Your take" : null}
          onReset={() => setMix(defaultMix(parts))}
        />
      </View>

      <View style={styles.section}>
        <Pressable
          onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={(e) => ready && !recording && seek((e.nativeEvent.locationX / barWidth) * duration)}
          style={styles.track}
          hitSlop={12}
        >
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          {loop && duration > 0 && (
            <View
              style={[
                styles.loopBand,
                {
                  left: `${(loop.start / duration) * 100}%`,
                  width: loop.end != null ? `${((loop.end - loop.start) / duration) * 100}%` : 3,
                },
              ]}
            />
          )}
        </Pressable>
        <View style={[styles.row, styles.transport]}>
          <SmallButton label="−5s" onPress={() => skip(-5)} disabled={!ready || recording} />
          <Pressable
            onPress={playing ? pause : play}
            disabled={!ready || recording}
            style={[styles.playButton, (!ready || recording) && styles.disabled]}
          >
            {ready ? (
              <Text style={styles.playText}>{playing ? "Pause" : "Play"}</Text>
            ) : (
              <View style={styles.row}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.playText}>
                  {loadedCount}/{parts.length}
                </Text>
              </View>
            )}
          </Pressable>
          <SmallButton label="+5s" onPress={() => skip(5)} disabled={!ready || recording} />
          <Text style={styles.time}>
            {fmtT(position)} / {fmtT(duration)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Practice</Text>
        <Text style={styles.label}>Speed</Text>
        <View style={styles.row}>
          {SPEEDS.map((s) => (
            <Chip
              key={s}
              label={`${Math.round(s * 100)}%`}
              active={speed === s}
              onPress={() => changeSpeed(s)}
              disabled={!ready || recording}
            />
          ))}
        </View>

        <Text style={[styles.label, styles.gapTop]}>Loop a section</Text>
        <View style={styles.row}>
          <SmallButton
            label={loop ? `Start ${fmtT(loop.start)}` : "Set start"}
            onPress={markLoopStart}
            disabled={!ready || recording}
          />
          <SmallButton
            label={loop?.end != null ? `End ${fmtT(loop.end)}` : "Set end"}
            onPress={markLoopEnd}
            disabled={!ready || recording || position < (loop?.start ?? 0) + MIN_LOOP_S}
          />
          {loop && <SmallButton label="Clear" onPress={() => updateLoop(null)} disabled={recording} />}
        </View>
        <Text style={[styles.meta, styles.gapTop]}>
          {loop?.end != null
            ? `Repeating ${fmtT(loop.start)}–${fmtT(loop.end)}.`
            : "While the song plays, tap Set start, then Set end. That part repeats until you clear it."}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Record yourself</Text>
        <Pressable
          onPress={recording ? stopRecording : startRecording}
          disabled={!ready}
          style={[styles.recordButton, recording && styles.recordButtonActive, !ready && styles.disabled]}
        >
          <View style={styles.recordLabel}>
            <Icon name={recording ? "stop" : "record"} size={18} color={recording ? colors.white : colors.flareInk} />
            <Text style={[styles.recordText, recording && styles.recordTextActive]}>
              {recording ? "Stop" : take ? "Record again" : "Record"}
            </Text>
          </View>
        </Pressable>
        <Text style={[styles.meta, styles.gapTop]}>
          {recording
            ? "Recording. The band plays in the mode you picked."
            : "Starts from the current position at full speed, and plays straight through any loop. Wear wired headphones so the mic only hears you."}
        </Text>
        {micError ? <Text style={styles.error}>{micError}</Text> : null}

        {take && !recording && (
          <View style={styles.gapTop}>
            <Text style={styles.label}>Line up your take</Text>
            <View style={[styles.row, styles.nudgeRow]}>
              <SmallButton label={`−${NUDGE_STEP_MS} ms`} onPress={() => changeNudge(-NUDGE_STEP_MS)} />
              <Text style={styles.nudgeValue}>
                {nudgeMs > 0 ? `${nudgeMs} ms earlier` : nudgeMs < 0 ? `${-nudgeMs} ms later` : "as recorded"}
              </Text>
              <SmallButton label={`+${NUDGE_STEP_MS} ms`} onPress={() => changeNudge(NUDGE_STEP_MS)} />
            </View>
            <SmallButton label="Delete take" onPress={deleteTake} />
            {onSaveTake ? (
              <View style={styles.gapTop}>
                <Pressable
                  onPress={saveTake}
                  disabled={saveState === "saving" || saveState === "saved"}
                  style={[styles.saveButton, saveState === "saved" && styles.saveButtonDone]}
                >
                  <Text style={[styles.saveText, saveState === "saved" && styles.saveTextDone]}>
                    {saveState === "saving"
                      ? "Saving…"
                      : saveState === "saved"
                        ? "Saved for your assignment"
                        : "Save take for your assignment"}
                  </Text>
                </Pressable>
                <Text style={[styles.meta, styles.gapTop]}>
                  {saveState === "saved"
                    ? "Go back to the assignment to send it to your teacher."
                    : saveState === "error"
                      ? "The take couldn't be saved. Try again."
                      : "Saved on this phone until you send it. Saving again replaces the last one."}
                </Text>
              </View>
            ) : (
              <Text style={[styles.meta, styles.gapTop]}>Your take stays on this phone and is gone when you leave the song.</Text>
            )}
          </View>
        )}
      </View>

      {take && !recording && (
        <View style={styles.section}>
          <EffectsRack fx={fx} onChange={setFx} />
        </View>
      )}

      {songId && (
        <View style={styles.section}>
          <Text style={styles.heading}>Saved mixes</Text>
          <MixPresets songId={songId} getSettings={() => ({ ...mix, mode, focus, effects: fx })} onApply={applyPreset} />
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && styles.disabled]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.smallButton, disabled && styles.disabled]} hitSlop={6}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, padding: 16 },
  section: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 16 },
  heading: { color: colors.ink, fontSize: 15, fontWeight: "700", marginBottom: 10 },
  gapTop: { marginTop: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { borderColor: colors.flareAction, backgroundColor: colors.flareWash },
  chipText: { fontWeight: "700", fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.flareInk },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  trackFill: { height: "100%", backgroundColor: colors.flareAction, pointerEvents: "none" },
  // pointerEvents none keeps taps on the bar itself, so locationX is measured from its left edge.
  loopBand: { position: "absolute", top: 0, bottom: 0, backgroundColor: colors.lagoon, opacity: 0.45, pointerEvents: "none" },
  transport: { marginTop: 14 },
  playButton: { backgroundColor: colors.flareAction, borderRadius: 3, paddingVertical: 12, paddingHorizontal: 20, minWidth: 96, alignItems: "center" },
  playText: { fontWeight: "700", fontSize: 15, color: colors.white },
  time: { marginLeft: "auto", color: colors.body, fontVariant: ["tabular-nums"] },
  smallButton: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignSelf: "flex-start" },
  smallButtonText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
  recordButton: { borderWidth: 1.5, borderColor: colors.flareAction, borderRadius: 3, paddingVertical: 12, alignItems: "center", backgroundColor: colors.white },
  recordButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  recordLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  recordText: { fontWeight: "700", fontSize: 15, color: colors.flareInk },
  recordTextActive: { color: colors.white },
  saveButton: {
    backgroundColor: colors.lagoon,
    borderWidth: 1.5,
    borderColor: colors.lagoon,
    borderRadius: 3,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonDone: { backgroundColor: colors.white },
  saveText: { fontWeight: "700", fontSize: 15, color: colors.white },
  saveTextDone: { color: colors.lagoon },
  label: { fontWeight: "700", color: colors.ink, marginBottom: 8 },
  nudgeRow: { marginBottom: 12 },
  nudgeValue: { flex: 1, textAlign: "center", color: colors.body, fontVariant: ["tabular-nums"] },
  meta: { color: colors.meta, fontSize: 13, lineHeight: 19 },
  error: { color: colors.flareInk, marginTop: 8 },
  disabled: { opacity: 0.5 },
});
