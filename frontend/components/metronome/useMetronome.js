"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createEngine } from "@/lib/metronome/engine";
import { DEFAULT_PREFS, describeConfig, sanitizeConfig, sanitizePrefs, setTempo } from "@/lib/metronome/config";
import { browserStorage, openStore, scopeFor } from "@/lib/metronome/presets";
import { fromSearchParams } from "@/lib/metronome/share";
import { createTapTempo } from "@/lib/metronome/tap";

const IDLE = { status: "idle", error: null, ended: null, timerDone: false, slipped: false, pending: null, clock: null };
const noSubscribe = () => () => {};
const idleState = () => IDLE;
const nothing = () => null;
const readSearch = () => window.location.search;
const noSearch = () => "";

function initial() {
  return { config: sanitizeConfig({}), prefs: { ...DEFAULT_PREFS }, notice: null, touched: false, source: "default", shared: null };
}

// `touched` turns true at the student's first change; until then nothing is written to storage,
// so opening a shared link or the page itself never overwrites what was saved.
function reduce(state, action) {
  switch (action.type) {
    case "change": {
      const result = action.fn(state.config);
      return { ...state, config: result.config, notice: result.notice ?? null, touched: true };
    }
    case "load":
      return { ...state, config: sanitizeConfig(action.config), notice: action.notice ?? null, touched: true };
    case "prefs":
      return { ...state, prefs: sanitizePrefs({ ...state.prefs, ...action.patch }), touched: true };
    case "restore":
      if (state.touched || state.source !== "default") return state;
      return { ...state, config: action.last.config, prefs: action.last.prefs, source: "last" };
    case "share":
      return {
        ...state,
        config: action.result.config,
        source: "share",
        shared: { issues: action.result.issues, summary: describeConfig(action.result.config) },
        touched: false,
        notice: null,
      };
    case "dismissShared":
      return { ...state, shared: null };
    case "clearNotice":
      return { ...state, notice: null };
    default:
      return state;
  }
}

// Everything the metronome page needs: the engine and its state, the settings, saved presets for
// whoever is signed in, a shared link if the page was opened from one, and tap tempo.
export function useMetronome() {
  // Created on the client only; it holds no audio until the first Start.
  const [engine] = useState(() => (typeof window === "undefined" ? null : createEngine()));
  useEffect(() => () => engine?.dispose(), [engine]);
  const engineState = useSyncExternalStore(engine ? engine.subscribe : noSubscribe, engine ? engine.getState : idleState, idleState);

  const [state, dispatch] = useReducer(reduce, undefined, initial);
  const { config, prefs } = state;
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    engine?.setConfig(config);
  }, [engine, config]);
  useEffect(() => {
    engine?.setPrefs(prefs);
  }, [engine, prefs]);
  useEffect(() => {
    engine?.setMuted(muted);
  }, [engine, muted]);

  // A teacher's link fills the controls once the page is in the browser. It never plays by
  // itself and never touches saved presets.
  const search = useSyncExternalStore(noSubscribe, readSearch, noSearch);
  const [seenSearch, setSeenSearch] = useState("");
  if (search !== seenSearch) {
    setSeenSearch(search);
    const result = search ? fromSearchParams(new URLSearchParams(search)) : null;
    if (result) dispatch({ type: "share", result });
  }

  // Saved data belongs to whoever is signed in; wait for the session before choosing whose.
  const { user, isLoading } = useAuth();
  const scope = user ? scopeFor(user) : isLoading ? null : "guest";
  const store = useMemo(() => (scope ? openStore(scope, browserStorage()) : null), [scope]);
  const saved = useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.getSnapshot : nothing, nothing);
  const [restoredFrom, setRestoredFrom] = useState(null);
  if (store && restoredFrom !== store) {
    setRestoredFrom(store);
    // Only the first store reopens the last setup; a later sign-in or sign-out keeps the controls.
    if (!restoredFrom && saved?.last) dispatch({ type: "restore", last: saved.last });
  }

  useEffect(() => {
    if (!store || !state.touched) return;
    const id = setTimeout(() => store.saveLast(config, prefs), 400);
    return () => clearTimeout(id);
  }, [store, config, prefs, state.touched]);

  // Once a shared setup has been changed, the address no longer describes it.
  useEffect(() => {
    if (state.touched && state.source === "share" && window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [state.touched, state.source]);

  useEffect(() => {
    if (!state.notice) return;
    const id = setTimeout(() => dispatch({ type: "clearNotice" }), 12000);
    return () => clearTimeout(id);
  }, [state.notice]);

  // Leaving the page (or the browser freezing it) stops the sound.
  useEffect(() => {
    if (!engine) return;
    const onHide = () => engine.stop();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [engine]);

  const [tapper] = useState(() => createTapTempo());
  const [tapInfo, setTapInfo] = useState(null);
  useEffect(() => {
    if (!tapInfo) return;
    const id = setTimeout(() => setTapInfo(null), 3300);
    return () => clearTimeout(id);
  }, [tapInfo]);

  const change = useCallback((fn) => dispatch({ type: "change", fn }), []);
  const load = useCallback((next, notice) => dispatch({ type: "load", config: next, notice }), []);
  const updatePrefs = useCallback((patch) => dispatch({ type: "prefs", patch }), []);
  const dismissShared = useCallback(() => dispatch({ type: "dismissShared" }), []);
  const clearNotice = useCallback(() => dispatch({ type: "clearNotice" }), []);
  const tap = useCallback(() => {
    const result = tapper.tap(performance.now());
    if (result.ignored) return;
    setTapInfo({ taps: result.taps, bpm: result.bpm });
    if (result.bpm) dispatch({ type: "change", fn: (c) => setTempo(c, result.bpm) });
  }, [tapper]);
  const start = useCallback(() => engine?.start(), [engine]);
  const stop = useCallback(() => engine?.stop(), [engine]);
  const resume = useCallback(() => engine?.resume(), [engine]);

  return {
    engine,
    engineState,
    config,
    prefs,
    muted,
    notice: state.notice,
    shared: state.shared,
    saved,
    store,
    scope,
    tapInfo,
    change,
    load,
    setPrefs: updatePrefs,
    setMuted,
    dismissShared,
    clearNotice,
    tap,
    start,
    stop,
    resume,
  };
}
