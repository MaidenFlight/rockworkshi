"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DrumEngine } from "@/lib/drums/engine";
import { loadKit, kitProgress, onKitChange } from "@/lib/drums/samples";
import { LEVEL } from "@/lib/drums/kit";
import { cleanName, partById, sameMusic, sanitizeBeat, setNote, setTempo } from "@/lib/drums/beat";
import { starterBeat } from "@/lib/drums/grooves";
import { SHARE_PARAM, decodeBeat } from "@/lib/drums/share";
import { DEFAULT_PREFS, MAX_SAVED, browserStorage, makeSavedId, openBeatStore, sanitizePrefs, scopeFor } from "@/lib/drums/storage";
import { createTapTempo } from "@/lib/metronome/tap";

const IDLE = { status: "idle", error: null, recording: false, mode: null, countIn: false, ended: false };
const UNDO_LIMIT = 100;
const noSubscribe = () => () => {};
const idleState = () => IDLE;
const readSearch = () => window.location.search;
const noSearch = () => "";
const readyCount = () => kitProgress().ready;
const noneReady = () => 0;

function initial() {
  return { beat: starterBeat(), past: [], future: [], group: null, touched: false, restored: false };
}

// Every change to the beat goes through here, so Undo and Redo see all of them. Changes that
// share a `group` (one drag across the grid, one recording pass) undo together.
function reduce(state, action) {
  switch (action.type) {
    case "edit": {
      const next = action.fn(state.beat);
      if (next === state.beat) return state;
      const merge = action.group && action.group === state.group;
      return {
        ...state,
        beat: next,
        past: merge ? state.past : [...state.past, state.beat].slice(-UNDO_LIMIT),
        future: [],
        group: action.group || null,
        touched: true,
      };
    }
    case "load":
      return { ...state, beat: action.beat, past: [...state.past, state.beat].slice(-UNDO_LIMIT), future: [], group: null, touched: true };
    case "restore":
      if (state.touched || state.restored) return state;
      return { ...state, beat: action.beat, restored: true };
    case "undo": {
      if (!state.past.length) return state;
      const beat = state.past[state.past.length - 1];
      return { ...state, beat, past: state.past.slice(0, -1), future: [state.beat, ...state.future], group: null, touched: true };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [beat, ...future] = state.future;
      return { ...state, beat, past: [...state.past, state.beat], future, group: null, touched: true };
    }
    case "endGroup":
      return state.group ? { ...state, group: null } : state;
    default:
      return state;
  }
}

// Everything the beat maker page needs: the beat with Undo, the engine and its state, the parts
// and the song, saving in this browser, a shared link if the page was opened from one, and tap
// tempo. The audio itself lives in lib/drums.
export function useBeatMaker() {
  const [state, dispatch] = useReducer(reduce, undefined, initial);
  const { beat } = state;

  // Created on the client only; it makes no sound and opens no audio until the first tap.
  const [engine] = useState(() => (typeof window === "undefined" ? null : new DrumEngine()));
  useEffect(() => () => engine?.dispose(), [engine]);
  useEffect(() => {
    engine?.setBeat(beat);
  }, [engine, beat]);
  const engineState = useSyncExternalStore(engine ? engine.subscribe : noSubscribe, engine ? engine.getState : idleState, idleState);

  // The recordings start loading at once, so the first tap already has its sound.
  const ready = useSyncExternalStore(onKitChange, readyCount, noneReady);
  const total = useMemo(() => kitProgress().total, []);
  const [loadFailed, setLoadFailed] = useState([]);
  const retryLoad = useCallback(() => {
    setLoadFailed([]);
    loadKit().then((r) => setLoadFailed(r.failed));
  }, []);
  useEffect(() => {
    let live = true;
    loadKit().then((r) => live && setLoadFailed(r.failed));
    return () => {
      live = false;
    };
  }, []);

  // ---- parts ----
  const [selectedId, setSelectedId] = useState(null);
  const selected = partById(beat, selectedId) || beat.parts[0];
  useEffect(() => {
    engine?.followPart(selected.id);
  }, [engine, selected.id]);

  // ---- this browser's settings and saved beats ----
  const { user, isLoading } = useAuth();
  const scope = user ? scopeFor(user) : isLoading ? null : "guest";
  const store = useMemo(() => (scope ? openBeatStore(scope, browserStorage()) : null), [scope]);
  const [prefs, setPrefsState] = useState(DEFAULT_PREFS);
  const [prefsTouched, setPrefsTouched] = useState(false);
  const [saved, setSaved] = useState([]);
  const [openedStore, setOpenedStore] = useState(null);
  if (store && openedStore !== store) {
    setOpenedStore(store);
    setSaved(store.saved);
    if (!prefsTouched) setPrefsState(store.prefs);
    if (store.current) dispatch({ type: "restore", beat: store.current });
  }
  const storeNotice = store?.notice || null;

  useEffect(() => {
    if (!store || !state.touched) return;
    const id = setTimeout(() => store.saveCurrent(beat), 400);
    return () => clearTimeout(id);
  }, [store, beat, state.touched]);

  useEffect(() => {
    if (!store || !prefsTouched) return;
    const id = setTimeout(() => store.savePrefs(prefs), 300);
    return () => clearTimeout(id);
  }, [store, prefs, prefsTouched]);

  useEffect(() => {
    engine?.setPrefs({ volume: prefs.volume, mix: prefs.mix, muted: prefs.muted, click: prefs.click });
  }, [engine, prefs]);

  const setPrefs = useCallback((patch) => {
    setPrefsTouched(true);
    setPrefsState((p) => sanitizePrefs({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  }, []);

  // ---- a shared link ----
  // A link never replaces the beat being worked on by itself: the page offers it first.
  const search = useSyncExternalStore(noSubscribe, readSearch, noSearch);
  const [seenSearch, setSeenSearch] = useState("");
  const [shared, setShared] = useState(null);
  if (search !== seenSearch) {
    setSeenSearch(search);
    const param = search ? new URLSearchParams(search).get(SHARE_PARAM) : null;
    if (param) {
      const decoded = decodeBeat(param);
      setShared(decoded ? { beat: decoded } : { broken: true });
    }
  }
  const clearSharedLink = useCallback(() => {
    setShared(null);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // ---- editing ----
  const edit = useCallback((fn, group) => dispatch({ type: "edit", fn, group }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const endGroup = useCallback(() => dispatch({ type: "endGroup" }), []);
  const load = useCallback((next) => {
    engine?.stop();
    dispatch({ type: "load", beat: sanitizeBeat(next) });
    setSelectedId(null);
  }, [engine]);

  // How hard the pads and the grid play: Ghost, Hit or Accent.
  const [tool, setTool] = useState(LEVEL.normal);

  // ---- the transport ----
  const [playMode, setPlayMode] = useState("part");
  const [loopSong, setLoopSong] = useState(true);
  const recordingGroup = useRef(0);
  useEffect(() => {
    engine?.setSongLoop(loopSong);
  }, [engine, loopSong]);

  useEffect(() => {
    if (!engine) return;
    engine.setRecordHandler((part, step, piece, level) => {
      dispatch({ type: "edit", fn: (b) => setNote(b, part, piece, step, level), group: `rec-${recordingGroup.current}` });
    });
    return () => engine.setRecordHandler(null);
  }, [engine]);

  const modeFor = useCallback(
    (kind, from = 0) => (kind === "song" ? { type: "song", loop: loopSong, from } : { type: "part", part: selected.id }),
    [loopSong, selected.id],
  );

  const play = useCallback(
    (kind = playMode, from = 0) => {
      if (!engine) return;
      if (kind !== playMode) setPlayMode(kind);
      engine.play(modeFor(kind, from), { countIn: engine.getState().recording });
    },
    [engine, modeFor, playMode],
  );
  const stop = useCallback(() => {
    engine?.stop();
    dispatch({ type: "endGroup" });
  }, [engine]);
  const toggle = useCallback(() => {
    const status = engine?.getState().status;
    if (status === "running" || status === "starting") stop();
    else play();
  }, [engine, play, stop]);

  const chooseMode = useCallback(
    (kind) => {
      setPlayMode(kind);
      const status = engine?.getState().status;
      if (status === "running") engine.play(modeFor(kind));
    },
    [engine, modeFor],
  );

  const toggleRecord = useCallback(() => {
    if (!engine) return;
    const s = engine.getState();
    if (s.recording) {
      engine.setRecording(false);
      dispatch({ type: "endGroup" });
      return;
    }
    recordingGroup.current += 1;
    engine.setRecording(true);
    if (s.status !== "running" && s.status !== "starting") engine.play(modeFor(playMode), { countIn: true });
  }, [engine, modeFor, playMode]);

  // Recording stops with the music.
  useEffect(() => {
    if (engineState.status === "idle" && engineState.recording) engine?.setRecording(false);
  }, [engine, engineState.status, engineState.recording]);

  // Leaving the page (or the browser freezing it) stops the sound.
  useEffect(() => {
    if (!engine) return;
    const onHide = () => engine.stop();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [engine]);

  // Any first click, tap or key on the page wakes the audio, so the first pad sounds at once. A
  // phone only allows that when the finger lifts (a touch that becomes a scroll allows nothing),
  // so for touch it is the lift that counts.
  useEffect(() => {
    if (!engine) return;
    const wake = (e) => {
      if (e.type === "pointerdown" && e.pointerType === "touch") return;
      engine.wake().then((ok) => {
        if (ok) remove();
      });
    };
    const events = ["pointerdown", "pointerup", "keydown"];
    const remove = () => events.forEach((t) => window.removeEventListener(t, wake, true));
    events.forEach((t) => window.addEventListener(t, wake, true));
    return remove;
  }, [engine]);

  // ---- tap tempo ----
  const [tapper] = useState(() => createTapTempo({ min: 40, max: 240 }));
  const [tapInfo, setTapInfo] = useState(null);
  useEffect(() => {
    if (!tapInfo) return;
    const id = setTimeout(() => setTapInfo(null), 3300);
    return () => clearTimeout(id);
  }, [tapInfo]);
  const tap = useCallback(() => {
    const result = tapper.tap(performance.now());
    if (result.ignored) return;
    setTapInfo({ taps: result.taps, bpm: result.bpm });
    if (result.bpm) dispatch({ type: "edit", fn: (b) => setTempo(b, result.bpm), group: "tap" });
  }, [tapper]);

  // ---- saved beats ----
  const persistList = useCallback(
    (next) => {
      setSaved(next);
      store?.saveList(next);
    },
    [store],
  );
  const saveAs = useCallback(
    (name) => {
      const clean = cleanName(name);
      if (!clean) return { ok: false, message: "Give the beat a name first." };
      const existing = saved.find((s) => s.name.toLowerCase() === clean.toLowerCase());
      const entry = { id: existing?.id || makeSavedId(), name: clean, beat: { ...beat, name: clean }, updatedAt: Date.now() };
      if (!existing && saved.length >= MAX_SAVED) return { ok: false, message: `You can keep ${MAX_SAVED} beats. Delete one to save this.` };
      persistList([entry, ...saved.filter((s) => s.id !== entry.id)]);
      dispatch({ type: "edit", fn: (b) => (b.name === clean ? b : { ...b, name: clean }) });
      return { ok: true, message: existing ? `Saved over “${clean}”.` : `Saved “${clean}”.` };
    },
    [beat, saved, persistList],
  );
  const removeSaved = useCallback((id) => persistList(saved.filter((s) => s.id !== id)), [saved, persistList]);
  const renameSaved = useCallback(
    (id, name) => {
      const clean = cleanName(name);
      if (!clean) return false;
      persistList(saved.map((s) => (s.id === id ? { ...s, name: clean, beat: { ...s.beat, name: clean }, updatedAt: Date.now() } : s)));
      return true;
    },
    [saved, persistList],
  );
  // True when the beat on screen matches one that is saved.
  const savedMatch = useMemo(() => saved.find((s) => sameMusic(s.beat, beat)) || null, [saved, beat]);

  return {
    engine,
    engineState,
    beat,
    selected,
    selectPart: setSelectedId,
    edit,
    endGroup,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    load,
    tool,
    setTool,
    playMode,
    chooseMode,
    loopSong,
    setLoopSong,
    play,
    stop,
    toggle,
    toggleRecord,
    tap,
    tapInfo,
    prefs,
    setPrefs,
    ready,
    total,
    loadFailed,
    retryLoad,
    saved,
    savedMatch,
    saveAs,
    removeSaved,
    renameSaved,
    persistent: store ? store.persistent : true,
    storeNotice,
    shared,
    clearSharedLink,
  };
}
