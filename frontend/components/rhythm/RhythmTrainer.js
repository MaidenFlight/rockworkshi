"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { Button } from "@/components/ui";
import Notation, { cursorPercent } from "./Notation";
import Results from "./Results";
import DelayCheck from "./DelayCheck";
import NameIt from "./NameIt";
import { Segmented, ON_OFF } from "./controls";
import { LEVELS, FIGURES, TPB, levelById, figureById, generateBars, generateBar, nearMiss } from "@/lib/rhythm/patterns";
import { RhythmEngine, audioSupported } from "@/lib/rhythm/engine";
import { Scorer, CLEAN_PASS, calibrate } from "@/lib/rhythm/scoring";
import s from "./rhythm.module.css";

const MIN_BPM = 40;
const MAX_BPM = 200;
const SPEED_STEP = 4;
const CAL_BPM = 90;
const SETTINGS_KEY = "rw-rhythm-settings";
const DELAY_KEY = "rw-rhythm-delay";
const BESTS_KEY = "rw-rhythm-bests";

const MODES = [
  { id: "play", label: "Play along", note: "Tap each note as the playhead crosses it. Turn the rhythm's sound off to read it on your own." },
  { id: "echo", label: "Call and response", note: "The trainer plays a bar, then you play it back in the next. Hide the notes to work by ear." },
  { id: "name", label: "Name the rhythm", note: "Hear a bar, then pick which of three it was." },
];

const DEFAULTS = {
  mode: "play",
  source: "levels",
  level: "l1",
  figure: "straight",
  bars: 1,
  bpm: 80,
  click: "all",
  hear: true,
  show: true,
  swing: false,
  counts: true,
  speedUp: false,
  fresh: false,
};

const CLICKS = [
  { value: "all", label: "Every beat" },
  { value: "backbeat", label: "2 and 4" },
  { value: "off", label: "Off" },
];

// Settings are a per-browser convenience, so a missing or broken store just means the defaults.
function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage: the page works without it.
  }
}

function cleanSettings(raw) {
  const v = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  return {
    mode: MODES.some((m) => m.id === v.mode) ? v.mode : DEFAULTS.mode,
    source: v.source === "figures" ? "figures" : "levels",
    level: levelById(v.level) ? v.level : DEFAULTS.level,
    figure: figureById(v.figure) ? v.figure : DEFAULTS.figure,
    bars: [1, 2, 4].includes(v.bars) ? v.bars : DEFAULTS.bars,
    bpm: Number.isFinite(v.bpm) ? Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v.bpm))) : DEFAULTS.bpm,
    click: CLICKS.some((c) => c.value === v.click) ? v.click : DEFAULTS.click,
    hear: v.hear !== false,
    show: v.show !== false,
    swing: v.swing === true,
    counts: v.counts !== false,
    speedUp: v.speedUp === true,
    fresh: v.fresh === true,
  };
}

// How many bars a mode uses: Name the rhythm is always one bar, call and response at most two.
function barsFor(st) {
  if (st.mode === "name") return 1;
  if (st.mode === "echo") return Math.min(st.bars, 2);
  return st.bars;
}

function makeBars(st, count, avoid = []) {
  if (st.source === "figures") return Array.from({ length: count }, () => figureById(st.figure).bar);
  return generateBars(levelById(st.level), count, Math.random, avoid);
}

function makeQuiz(st, prev) {
  if (st.source === "figures") {
    const pool = FIGURES.filter((f) => !prev || f.bar !== prev.options[prev.answer]);
    const answer = pool[Math.floor(Math.random() * pool.length)];
    const others = FIGURES.filter((f) => f.id !== answer.id).sort(() => Math.random() - 0.5).slice(0, 2);
    const set = [answer, ...others].sort(() => Math.random() - 0.5);
    return { options: set.map((f) => f.bar), names: set.map((f) => f.name), answer: set.indexOf(answer), picked: null, heard: false };
  }
  const level = levelById(st.level);
  const answerBar = generateBar(level, Math.random, prev ? [prev.options[prev.answer]] : null);
  const a = nearMiss(level, answerBar);
  const b = nearMiss(level, answerBar, Math.random, [a]);
  const set = [answerBar, a, b].sort(() => Math.random() - 0.5);
  return { options: set, names: null, answer: set.indexOf(answerBar), picked: null, heard: false };
}

function rhythmKey(st) {
  return `${st.source}|${st.level}|${st.figure}|${barsFor(st)}|${st.mode === "name"}`;
}

function sourceKey(st) {
  return st.source === "figures" ? `f:${st.figure}` : st.level;
}

// marks: { [pass]: { [bar]: { [eventIndex]: result } } }, kept for the last few passes only.
function withMarks(prev, targets) {
  const next = { ...prev };
  for (const t of targets) {
    const pass = { ...(next[t.pass] ?? {}) };
    pass[t.key.bar] = { ...(pass[t.key.bar] ?? {}), [t.key.index]: t.result };
    next[t.pass] = pass;
  }
  const keep = Object.keys(next)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 3);
  for (const k of Object.keys(next)) if (!keep.includes(Number(k))) delete next[k];
  return next;
}

const FLASH_TEXT = {
  on: "On time",
  "near-early": "A touch early",
  "near-late": "A touch late",
  "off-early": "Early",
  "off-late": "Late",
  extra: "Extra tap",
  wait: "Not yet",
  listen: "Listen first",
  tap: "Tap",
  idle: "Press Start first",
};

const noSubscribe = () => () => {};

// What this browser remembers, and the first random rhythm, are read at first render. Until the
// page has hydrated only the heading shows, so a server render (if the trainer is ever opened to
// everyone, like the tuner) can't disagree with the browser's.
export default function RhythmTrainer() {
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [initial] = useState(() => cleanSettings(readStore(SETTINGS_KEY, null)));
  const [settings, setSettings] = useState(initial);
  const [bars, setBars] = useState(() => (initial.mode === "name" ? null : makeBars(initial, barsFor(initial))));
  const [quiz, setQuiz] = useState(() => (initial.mode === "name" ? makeQuiz(initial, null) : null));
  const [quizScore, setQuizScore] = useState({ right: 0, total: 0, streak: 0 });
  const [run, setRun] = useState(null);
  const [live, setLive] = useState(null);
  const [shown, setShown] = useState(null);
  const [marks, setMarks] = useState({});
  const [last, setLast] = useState(null);
  const [bests, setBests] = useState(() => readStore(BESTS_KEY, {}) || {});
  const [delay, setDelay] = useState(() => {
    const d = Number(readStore(DELAY_KEY, 0));
    return Number.isFinite(d) ? Math.max(-0.15, Math.min(0.35, d)) : 0;
  });
  const [cal, setCal] = useState({ phase: "idle" });
  const [flash, setFlash] = useState(null);
  const [notice, setNotice] = useState(null);
  const [announce, setAnnounce] = useState("");
  const [midi, setMidi] = useState({ state: "off", count: 0 });
  const [midiSupported] = useState(() => typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function");

  const engineRef = useRef(null);
  const scorerRef = useRef(null);
  const runRef = useRef(null);
  const settingsRef = useRef(settings);
  const barsRef = useRef(bars);
  const quizRef = useRef(quiz);
  const delayRef = useRef(delay);
  const bestsRef = useRef(bests);
  const cursorRefs = useRef([]);
  const lightRefs = useRef([]);
  const reducedRef = useRef(false);
  const flashTimer = useRef(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);
  useEffect(() => {
    delayRef.current = delay;
  }, [delay]);
  useEffect(() => {
    bestsRef.current = bests;
  }, [bests]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => (reducedRef.current = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    writeStore(SETTINGS_KEY, settings);
  }, [settings]);

  const update = useCallback((patch) => setSettings((st) => ({ ...st, ...patch })), []);

  // ---- The run ----

  const stopFrames = useCallback(() => {
    const r = runRef.current;
    if (r?.raf) cancelAnimationFrame(r.raf);
    cursorRefs.current.forEach((el) => el?.removeAttribute("data-on"));
    lightRefs.current.forEach((el) => el?.removeAttribute("data-on"));
  }, []);

  const stopRun = useCallback(() => {
    engineRef.current?.stop();
    stopFrames();
    runRef.current = null;
    setRun(null);
    setLive(null);
    setShown(null);
    setCal((c) => (c.phase === "running" ? { phase: "idle" } : c));
  }, [stopFrames]);

  // A change to the mode or to what defines the rhythm stops any run; if the rhythm itself is now
  // different, a new one is made.
  const changeRhythm = useCallback(
    (patch) => {
      stopRun();
      const prev = settingsRef.current;
      const st = { ...prev, ...patch };
      settingsRef.current = st;
      setSettings(st);
      if (rhythmKey(st) === rhythmKey(prev)) return;
      if (st.mode === "name") setQuiz(makeQuiz(st, null));
      else setBars(makeBars(st, barsFor(st)));
      setLast(null);
      setMarks({});
    },
    [stopRun],
  );

  useEffect(
    () => () => {
      const r = runRef.current;
      if (r?.raf) cancelAnimationFrame(r.raf);
      clearTimeout(flashTimer.current);
      engineRef.current?.close();
    },
    [],
  );

  const publish = useCallback((passId, r) => {
    const scorer = scorerRef.current;
    const meta = r.passMeta.get(passId);
    if (!scorer || !meta) return;
    const summary = scorer.summary(passId);
    r.passMeta.delete(passId - 4);
    // A pass with no taps at all means nobody was playing (the loop ran on while they stopped),
    // so it doesn't replace the last real result.
    if (summary.on + summary.near + summary.off + summary.extra === 0) return;
    const key = `${meta.mode}|${meta.source}`;
    // A best is only worth keeping from half marks up; "New best" means beating an earlier one.
    const prevBest = bestsRef.current[key];
    const better =
      summary.notes > 0 &&
      summary.score >= 50 &&
      (!prevBest || summary.score > prevBest.score || (summary.score === prevBest.score && meta.bpm > prevBest.bpm));
    if (better) {
      const next = { ...bestsRef.current, [key]: { score: summary.score, bpm: meta.bpm } };
      bestsRef.current = next;
      setBests(next);
      writeStore(BESTS_KEY, next);
    }
    setLast({ summary, pass: passId, bars: meta.bars, bpm: meta.bpm, mode: meta.mode, newBest: better && Boolean(prevBest) });
    setAnnounce(
      `${meta.mode === "echo" ? "Round" : "Pass"} ${passId + 1}: ${summary.score} percent. ${summary.on} on time, ${summary.early} early, ${summary.late} late, ${summary.missed} missed.`,
    );
    scorer.prune(scorer.passes.get(passId)?.start - 30);
  }, []);

  const frame = useCallback(() => {
    const eng = engineRef.current;
    const r = runRef.current;
    if (!eng || !r) return;
    const now = eng.heard();
    const pos = eng.position(now);
    const seg = pos?.seg;

    const key = seg ? `${seg.index}:${pos.beatIndex}` : "";
    if (key !== r.liveKey) {
      r.liveKey = key;
      if (seg) {
        setLive({
          kind: seg.kind,
          beat: pos.beatIndex + 1,
          pass: seg.data?.pass ?? 0,
          bar: seg.data?.bar ?? -1,
          bars: seg.data?.bars?.length ?? 0,
          bpm: seg.bpm,
          raised: seg.data?.raised,
          fresh: seg.data?.fresh,
        });
        if (seg.data?.bars && seg.data.bars !== r.shownBars) {
          r.shownBars = seg.data.bars;
          setShown({ bars: seg.data.bars });
        }
      }
    }

    const moving = seg && seg.bar && ["play", "call", "response"].includes(seg.kind);
    cursorRefs.current.forEach((el, i) => {
      if (!el) return;
      if (moving && seg.data.bar === i) {
        const tick = reducedRef.current ? Math.floor(pos.tick / TPB) * TPB : pos.tick;
        el.style.left = `${cursorPercent(tick)}%`;
        el.setAttribute("data-on", "true");
      } else {
        el.removeAttribute("data-on");
      }
    });
    lightRefs.current.forEach((el, i) => {
      if (!el) return;
      if (seg && seg.kind !== "pause" && pos.beatIndex === i) el.setAttribute("data-on", seg.kind === "countin" ? "count" : "beat");
      else el.removeAttribute("data-on");
    });

    if (r.kind === "play" || r.kind === "echo") {
      const scorer = scorerRef.current;
      const corrected = now - delayRef.current;
      const missed = scorer.closeUpTo(corrected);
      if (missed.length) setMarks((m) => withMarks(m, missed));
      for (const id of [...r.completed]) {
        if (scorer.isDone(id, corrected)) {
          r.completed.delete(id);
          publish(id, r);
        }
      }
    }
  }, [publish]);

  // A plan hands the engine one segment at a time. It reads the latest settings each time, so a
  // change of click, sound or tempo lands on the next bar line.
  const makePlan = useCallback((kind, r) => {
    if (kind === "calib") {
      return (i) => {
        if (i === 0) return { kind: "countin", bpm: CAL_BPM, clicks: "all", data: {} };
        if (i <= 3) return { kind: "calib", bpm: CAL_BPM, clicks: "all", data: {} };
        return null;
      };
    }

    if (kind === "name") {
      const q = quizRef.current;
      const bar = q.options[q.answer];
      return (i) => {
        const st = settingsRef.current;
        if (i === 0) return { kind: "countin", bpm: st.bpm, clicks: "all", data: {} };
        if (i === 1) return { kind: "listen", bpm: st.bpm, bar, clicks: st.click, rhythm: true, swing: st.swing, data: {} };
        return null;
      };
    }

    const st0 = settingsRef.current;
    let current = barsRef.current;
    let pass = 0;
    let k = 0;
    let bpm = st0.bpm;

    if (kind === "echo") {
      let phase = "countin";
      return () => {
        const st = settingsRef.current;
        bpm = st.bpm;
        if (phase === "countin") {
          phase = "call";
          return { kind: "countin", bpm, clicks: "all", data: { pass, bars: current, bar: -1 } };
        }
        const calling = phase === "call";
        const spec = {
          kind: calling ? "call" : "response",
          bpm,
          bar: current[k],
          clicks: st.click,
          rhythm: calling,
          swing: st.swing,
          scored: !calling,
          data: { pass, bar: k, bars: current },
        };
        k += 1;
        if (k === current.length) {
          k = 0;
          if (calling) {
            phase = "response";
          } else {
            phase = "call";
            pass += 1;
            if (st.fresh && st.source === "levels") {
              current = makeBars(st, current.length, current);
              setBars(current);
            }
          }
        }
        return spec;
      };
    }

    // Play along: the rhythm loops. With speed-up or a new rhythm each pass, each pass ends on a
    // short pause and a fresh count-in, which is when the next one is decided.
    let phase = "countin";
    return () => {
      const st = settingsRef.current;
      const breaks = st.speedUp || (st.fresh && st.source === "levels");
      if (phase === "countin") {
        phase = "play";
        bpm = st.bpm;
        return { kind: "countin", bpm, clicks: "all", data: { pass, bars: current, bar: -1, raised: r.raised, fresh: r.fresh } };
      }
      if (phase === "pause") {
        phase = "decide";
        const beat = 60 / bpm;
        return { kind: "pause", bpm, beats: Math.max(1, Math.ceil(0.6 / beat)), clicks: "off", data: { pass, bars: current, bar: -1 } };
      }
      if (phase === "decide") {
        const scorer = scorerRef.current;
        const unplayed = scorer.targets.filter((t) => t.pass === pass && !t.result);
        const sum = scorer.finishPass(pass);
        if (unplayed.length) setMarks((m) => withMarks(m, unplayed));
        r.raised = false;
        r.fresh = false;
        // A clean pass climbs from the tempo it was played at; otherwise the slider decides.
        if (st.speedUp && sum.notes && sum.score >= CLEAN_PASS && bpm < MAX_BPM) {
          bpm = Math.min(MAX_BPM, bpm + SPEED_STEP);
          r.raised = true;
          settingsRef.current = { ...settingsRef.current, bpm };
          setSettings((x) => ({ ...x, bpm }));
        } else {
          bpm = st.bpm;
        }
        if (st.fresh && st.source === "levels") {
          current = makeBars(st, current.length, current);
          r.fresh = true;
          setBars(current);
        }
        pass += 1;
        phase = "play";
        return { kind: "countin", bpm, clicks: "all", data: { pass, bars: current, bar: -1, raised: r.raised, fresh: r.fresh } };
      }
      bpm = breaks ? bpm : st.bpm;
      const spec = {
        kind: "play",
        bpm,
        bar: current[k],
        clicks: st.click,
        rhythm: st.hear,
        swing: st.swing,
        scored: true,
        data: { pass, bar: k, bars: current },
      };
      k += 1;
      if (k === current.length) {
        k = 0;
        if (breaks) phase = "pause";
        else pass += 1;
      }
      return spec;
    };
  }, []);

  const onSegment = useCallback((seg, r) => {
    if (seg.scored && seg.bar) {
      scorerRef.current.addPass({
        id: seg.data.pass,
        start: seg.start,
        end: seg.end,
        targets: seg.notes.map((n) => ({ time: n.time, key: { bar: seg.data.bar, index: n.index } })),
      });
      const st = settingsRef.current;
      r.passMeta.set(seg.data.pass, { bars: seg.data.bars, bpm: seg.bpm, mode: r.kind, source: sourceKey(st) });
      if (seg.data.bar === seg.data.bars.length - 1) r.completed.add(seg.data.pass);
    }
    if (seg.kind === "calib") {
      for (let b = 0; b < seg.beats; b++) r.calClicks.push(seg.start + b * seg.beat);
    }
  }, []);

  const onRunEnd = useCallback(
    (info, r) => {
      stopFrames();
      if (runRef.current !== r) return;
      runRef.current = null;
      setRun(null);
      setLive(null);
      setShown(null);
      if (info?.interrupted) {
        setNotice(
          info.behind
            ? "The trainer stopped because the browser slowed it down, which happens when the page is in the background. Keep it in front while you play."
            : "The sound stopped: the browser paused audio, often because the screen locked or another app took over.",
        );
        setCal((c) => (c.phase === "running" ? { phase: "idle" } : c));
        return;
      }
      if (r.kind === "name") setQuiz((q) => (q ? { ...q, heard: true } : q));
      if (r.kind === "calib") {
        const result = calibrate(r.calClicks, r.calTaps);
        if (result.ok) {
          const d = Math.max(-0.15, Math.min(0.35, result.offset));
          setDelay(d);
          writeStore(DELAY_KEY, d);
        }
        setCal({ phase: "done", result });
      }
    },
    [stopFrames],
  );

  const startRun = useCallback(
    (kind) => {
      setNotice(null);
      if (!audioSupported()) {
        setNotice("This browser can't play sound from a web page, so the trainer can't run here.");
        return;
      }
      if (kind === "name" && !quizRef.current) return;
      if (kind !== "name" && kind !== "calib" && !barsRef.current) return;
      const eng = engineRef.current ?? new RhythmEngine();
      engineRef.current = eng;
      eng.ensure();
      eng.stop();
      stopFrames();
      scorerRef.current = new Scorer();
      const r = { kind, completed: new Set(), passMeta: new Map(), calClicks: [], calTaps: [], liveKey: null, shownBars: null };
      runRef.current = r;
      setMarks({});
      setFlash(null);
      setShown(null);
      setRun({ kind });
      eng.start({ next: makePlan(kind, r), onSegment: (seg) => onSegment(seg, r), onEnd: (info) => onRunEnd(info, r) });
      // The playhead, lights and scoring follow the audio clock on every frame, without
      // re-rendering; React only hears about a new beat, a tap or a finished pass.
      const loop = () => {
        if (runRef.current !== r) return;
        frame();
        r.raf = requestAnimationFrame(loop);
      };
      r.raf = requestAnimationFrame(loop);
    },
    [frame, makePlan, onRunEnd, onSegment, stopFrames],
  );

  const showFlash = useCallback((kind) => {
    clearTimeout(flashTimer.current);
    setFlash({ kind, id: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), 650);
  }, []);

  const onTap = useCallback(
    (timeStamp) => {
      const eng = engineRef.current;
      const r = runRef.current;
      if (!eng || !r) {
        showFlash("idle");
        return;
      }
      const heard = eng.heard(timeStamp);
      if (r.kind === "calib") {
        r.calTaps.push(heard);
        setCal((c) => ({ ...c, taps: (c.taps ?? 0) + 1 }));
        showFlash("tap");
        return;
      }
      if (r.kind === "name") return;
      const res = scorerRef.current.tap(heard - delayRef.current);
      if (res?.target) {
        setMarks((m) => withMarks(m, [res.target]));
        showFlash(res.result.dir ? `${res.result.kind}-${res.result.dir}` : res.result.kind);
      } else if (res && res.extra !== undefined) {
        showFlash("extra");
      } else {
        const seg = eng.position(heard)?.seg;
        showFlash(seg?.kind === "call" ? "listen" : "wait");
      }
    },
    [showFlash],
  );

  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const primary = useCallback(() => {
    if (runRef.current) {
      stopRun();
      return;
    }
    startRun(settingsRef.current.mode);
  }, [startRun, stopRun]);

  // Keys: while a run wants taps, Space and any letter or digit tap; Esc stops. When nothing is
  // focused, Space starts. Typing in a field is never taken over.
  useEffect(() => {
    function onKey(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const tag = t?.tagName;
      if ((tag === "INPUT" && t.type !== "range") || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      const r = runRef.current;
      if (e.key === "Escape" && r) {
        stopRun();
        return;
      }
      const tapKey = e.key === " " || /^[a-z0-9]$/i.test(e.key);
      if (r && (r.kind === "play" || r.kind === "echo" || r.kind === "calib")) {
        if (tapKey) {
          e.preventDefault();
          onTapRef.current(e.timeStamp);
        }
        return;
      }
      if (!r && e.key === " " && (t === document.body || t === null)) {
        e.preventDefault();
        primary();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary, stopRun]);

  async function connectMidi() {
    try {
      const access = await navigator.requestMIDIAccess();
      const attach = () => {
        let count = 0;
        access.inputs.forEach((input) => {
          count += 1;
          input.onmidimessage = (m) => {
            const [status, , velocity] = m.data;
            if ((status & 0xf0) === 0x90 && velocity > 0) onTapRef.current(m.timeStamp);
          };
        });
        setMidi({ state: "on", count });
      };
      attach();
      access.onstatechange = attach;
    } catch {
      setMidi({ state: "denied", count: 0 });
    }
  }

  // ---- Name the rhythm ----

  function pick(i) {
    if (!quiz || quiz.picked !== null || !quiz.heard) return;
    const right = i === quiz.answer;
    setQuiz({ ...quiz, picked: i });
    setQuizScore((q) => ({ right: q.right + (right ? 1 : 0), total: q.total + 1, streak: right ? q.streak + 1 : 0 }));
    setAnnounce(right ? "Right." : `Not that one. It was ${String.fromCharCode(65 + quiz.answer)}.`);
  }

  function nextQuiz() {
    stopRun();
    setQuiz((q) => makeQuiz(settingsRef.current, q));
  }

  // ---- Delay check ----

  function startCal() {
    stopRun();
    setCal({ phase: "running", taps: 0 });
    startRun("calib");
  }

  // ---- Derived ----

  const mode = settings.mode;
  const modeInfo = MODES.find((m) => m.id === mode);
  const level = levelById(settings.level);
  const figure = figureById(settings.figure);
  const running = Boolean(run);
  const runKind = run?.kind;
  const displayBars = shown?.bars ?? bars;
  const roundWord = mode === "echo" ? "round" : "pass";
  const hideNotes = mode === "echo" && !settings.show && running && runKind === "echo";
  const shownPass = running && runKind !== "calib" ? live?.pass : last?.pass;
  const shownMarks = shownPass !== undefined && shownPass !== null && (running || last?.bars === displayBars) ? marks[shownPass] : null;
  const best = bests[`${mode}|${sourceKey(settings)}`];
  const anyMarks = shownMarks && Object.keys(shownMarks).length > 0;

  const status = useMemo(() => {
    if (!live) {
      if (runKind) return { label: "Starting", sub: "" };
      if (mode === "name") {
        if (!quiz?.heard) return { label: "Ready", sub: "Press Play to hear it" };
        if (quiz.picked === null) return { label: "Your pick", sub: "Which one was it?" };
        return { label: quiz.picked === quiz.answer ? "Right" : "Not that one", sub: "" };
      }
      return { label: "Ready", sub: "Press Start or the space bar" };
    }
    const bar = live.bars > 1 && live.bar >= 0 ? `Bar ${live.bar + 1} of ${live.bars}` : "";
    switch (live.kind) {
      case "countin":
        return { label: "Count-in", sub: live.raised ? `Tempo up to ${live.bpm}` : live.fresh ? "New rhythm: read it now" : "Ready on 1" };
      case "play":
        return { label: "Play", sub: [`Pass ${live.pass + 1}`, bar].filter(Boolean).join(" · ") };
      case "call":
        return { label: "Listen", sub: bar || "Then play it back" };
      case "response":
        return { label: "Your turn", sub: bar || "Play it back" };
      case "pause":
        return { label: "Get ready", sub: "" };
      case "listen":
        return { label: "Listen", sub: "" };
      case "calib":
        return { label: "Tap with the click", sub: "" };
      default:
        return { label: "", sub: "" };
    }
  }, [live, runKind, mode, quiz]);

  const primaryLabel = running && runKind !== "calib" ? "Stop" : mode === "name" ? (quiz?.heard ? "Play again" : "Play it") : "Start";
  const showPad = mode !== "name";

  const heading = (
    <>
      <Link href="/tools" className="rw-back">
        <Icon name="arrow-left" size={14} /> Music tools
      </Link>
      <h1 className={s.title}>Rhythm Trainer</h1>
      <p className={s.lead}>Read a rhythm, hear it, then tap it back. Every note is graded early, late or on time.</p>
    </>
  );

  if (!hydrated) return <div className={s.page}>{heading}</div>;

  return (
    <div className={s.page}>
      {heading}

      <div className={s.modes} role="group" aria-label="Ways to practise">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            className={s.modeTab}
            onClick={() => {
              if (mode !== m.id) changeRhythm({ mode: m.id });
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className={s.modeNote}>{modeInfo.note}</p>

      <div className={s.layout}>
        <div className={s.paperCol}>
          <section className={s.paper} aria-labelledby="rt-rhythm-title">
            <Segmented
              label="Rhythms"
              value={settings.source}
              onChange={(v) => changeRhythm({ source: v })}
              options={[
                { value: "levels", label: "Levels" },
                { value: "figures", label: "Rock figures" },
              ]}
            />
            <div className={s.chips} role="group" aria-label={settings.source === "levels" ? "Level" : "Figure"}>
              {settings.source === "levels"
                ? LEVELS.map((l) => (
                    <button key={l.id} type="button" className={s.chip} aria-pressed={settings.level === l.id} onClick={() => changeRhythm({ level: l.id })}>
                      <span className={s.chipN}>{l.n}</span>
                      {l.short}
                    </button>
                  ))
                : FIGURES.map((f) => (
                    <button key={f.id} type="button" className={s.chip} aria-pressed={settings.figure === f.id} onClick={() => changeRhythm({ figure: f.id })}>
                      {f.name}
                    </button>
                  ))}
            </div>

            <div className={s.paperHead}>
              <h2 id="rt-rhythm-title" className={s.h2}>
                {settings.source === "levels" ? `Level ${level.n}: ${level.name}` : figure.name}
              </h2>
              <p className={s.blurb}>{settings.source === "levels" ? level.blurb : figure.blurb}</p>
            </div>

            {mode === "name" ? (
              quiz && (
                <NameIt
                  quiz={quiz}
                  score={quizScore}
                  counts={settings.counts}
                  onPick={pick}
                  onNext={nextQuiz}
                  running={running}
                />
              )
            ) : (
              <>
                {settings.swing && <p className={s.swingMark}>Swing: play each pair of eighths long-short</p>}
                {displayBars && (
                  <div className={s.staff} data-hidden={hideNotes ? "true" : undefined}>
                    <Notation bars={displayBars} marks={hideNotes ? null : shownMarks} counts={settings.counts} hidden={hideNotes} cursorRefs={cursorRefs} />
                    {hideNotes && <p className={s.hiddenNote}>{live?.kind === "response" ? "Your turn: play back what you heard." : "Listen…"}</p>}
                  </div>
                )}
                {anyMarks && !hideNotes && (
                  <p className={s.legend} aria-hidden="true">
                    <span className={s.legendOn}>●</span> on time <span className={s.legendDir}>‹</span> early <span className={s.legendDir}>›</span> late{" "}
                    <span className={s.legendMiss}>×</span> missed
                  </p>
                )}
                <div className={s.paperRow}>
                  <Segmented
                    label="Bars"
                    value={barsFor(settings)}
                    onChange={(v) => changeRhythm({ bars: v })}
                    options={[
                      { value: 1, label: "1" },
                      { value: 2, label: "2" },
                      { value: 4, label: "4", disabled: mode === "echo" },
                    ]}
                  />
                  <Segmented label="Counts" value={settings.counts} onChange={(v) => update({ counts: v })} options={ON_OFF} />
                  {settings.source === "levels" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className={s.paperButton}
                      onClick={() => {
                        stopRun();
                        setBars((b) => makeBars(settingsRef.current, barsFor(settingsRef.current), b ?? []));
                        setLast(null);
                        setMarks({});
                      }}
                    >
                      New rhythm
                    </Button>
                  )}
                </div>
              </>
            )}
          </section>

          {mode !== "name" && (
            <Results
              last={last && last.mode === mode ? last : null}
              best={best}
              marks={last ? marks[last.pass] : null}
              reveal={mode === "echo" && !settings.show}
              counts={settings.counts}
              roundWord={roundWord}
            />
          )}
        </div>

        <section className={s.console} aria-label="Trainer controls">
          <div className={s.status}>
            <div className={s.statusText}>
              <p className={s.statusLabel}>{status.label}</p>
              <p className={s.statusSub}>{status.sub || " "}</p>
            </div>
            <div className={s.lights} aria-hidden="true">
              {[1, 2, 3, 4].map((n, i) => (
                <span
                  key={n}
                  className={s.light}
                  ref={(el) => {
                    lightRefs.current[i] = el;
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className={s.tempo}>
            <span className={s.consoleLabel} id="rt-tempo-label">
              Tempo
            </span>
            <div className={s.tempoRow}>
              <button type="button" className={s.nudge} aria-label="Slower" onClick={() => update({ bpm: Math.max(MIN_BPM, settings.bpm - 1) })}>
                −
              </button>
              <p className={s.tempoValue}>
                {settings.bpm}
                <span className={s.tempoUnit}>BPM</span>
              </p>
              <button type="button" className={s.nudge} aria-label="Faster" onClick={() => update({ bpm: Math.min(MAX_BPM, settings.bpm + 1) })}>
                +
              </button>
            </div>
            <input
              type="range"
              className={s.slider}
              min={MIN_BPM}
              max={MAX_BPM}
              value={settings.bpm}
              aria-labelledby="rt-tempo-label"
              aria-valuetext={`${settings.bpm} beats per minute`}
              onChange={(e) => update({ bpm: Number(e.target.value) })}
            />
          </div>

          <button type="button" className={s.start} data-on={running && runKind !== "calib" ? "true" : undefined} onClick={primary} disabled={runKind === "calib"}>
            <Icon name={running && runKind !== "calib" ? "stop" : "play"} size={18} />
            {primaryLabel}
          </button>

          {showPad && (
            <div className={s.padWrap}>
              <button
                type="button"
                className={s.pad}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  onTap(e.timeStamp);
                }}
                onKeyDown={(e) => {
                  // Space is handled on the window; Enter on the focused pad taps too.
                  if (e.key === "Enter" && !e.repeat) {
                    e.preventDefault();
                    onTap(e.timeStamp);
                  }
                }}
                aria-label="Tap pad"
              >
                {/* Keyed by the tap, so the flash restarts each time without remounting the pad. */}
                <span className={s.padRing} data-flash={flash?.kind} key={`r${flash?.id ?? 0}`} aria-hidden="true" />
                <span className={s.padWord}>Tap</span>
                <span className={s.padFlash} data-flash={flash?.kind} key={`f${flash?.id ?? 0}`} aria-hidden="true">
                  {flash ? FLASH_TEXT[flash.kind] : " "}
                </span>
              </button>
              <p className={s.padHint}>Tap the pad, or press Space or any letter key. Esc stops.</p>
            </div>
          )}

          <div className={s.options}>
            <Segmented tone="console" label="Click" value={settings.click} onChange={(v) => update({ click: v })} options={CLICKS} />
            {mode === "play" && (
              <Segmented
                tone="console"
                label="Hear the rhythm"
                value={settings.hear}
                onChange={(v) => update({ hear: v })}
                options={ON_OFF}
                hint={settings.hear ? null : "Only the click plays. Read it and play it yourself."}
              />
            )}
            {mode === "echo" && <Segmented tone="console" label="Show the notes" value={settings.show} onChange={(v) => update({ show: v })} options={ON_OFF} />}
            <Segmented
              tone="console"
              label="Feel"
              value={settings.swing}
              onChange={(v) => update({ swing: v })}
              options={[
                { value: false, label: "Straight" },
                { value: true, label: "Swing" },
              ]}
            />
            {mode === "play" && (
              <Segmented
                tone="console"
                label="After a clean pass"
                value={settings.speedUp}
                onChange={(v) => update({ speedUp: v })}
                options={[
                  { value: false, label: "Same tempo" },
                  { value: true, label: `+${SPEED_STEP} BPM` },
                ]}
              />
            )}
            {mode !== "name" && settings.source === "levels" && (
              <Segmented
                tone="console"
                label={mode === "echo" ? "Each round" : "Each pass"}
                value={settings.fresh}
                onChange={(v) => update({ fresh: v })}
                options={[
                  { value: false, label: "Same rhythm" },
                  { value: true, label: "New rhythm" },
                ]}
              />
            )}
          </div>

          {showPad && (
            <div className={s.extras}>
              <DelayCheck
                delay={delay}
                cal={cal}
                running={running && runKind !== "calib"}
                onStart={startCal}
                onStop={stopRun}
                onReset={() => {
                  setDelay(0);
                  writeStore(DELAY_KEY, 0);
                }}
                onClose={() => setCal({ phase: "idle" })}
              />
              {midiSupported && (
                <div className={s.delayRow}>
                  <p className={s.delayText}>
                    {midi.state === "on"
                      ? `MIDI: ${midi.count} ${midi.count === 1 ? "device" : "devices"}. Any pad or key taps.`
                      : midi.state === "denied"
                        ? "MIDI was blocked in this browser."
                        : "Got a drum kit or keyboard with MIDI?"}
                  </p>
                  {midi.state !== "on" && (
                    <button type="button" className={s.consoleLink} onClick={connectMidi}>
                      Use MIDI
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {notice && (
            <p className={s.notice} role="status">
              {notice}
            </p>
          )}
        </section>
      </div>

      <p className={s.srOnly} aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
