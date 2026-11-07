"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import Icon from "@/components/member/Icon";
import { VisualBus, createVisualBus } from "@/components/metronome/visual";
import { LEVEL, PIECE_BY_CODE } from "@/lib/drums/kit";
import { describeBeat } from "@/lib/drums/beat";
import PadKit from "./PadKit";
import PartTabs from "./PartTabs";
import SettingsBeat from "./SettingsBeat";
import SettingsGrooves from "./SettingsGrooves";
import SettingsKit from "./SettingsKit";
import SettingsSaved from "./SettingsSaved";
import SongStrip from "./SongStrip";
import StepGrid from "./StepGrid";
import Transport from "./Transport";
import { useBeatMaker } from "./useBeatMaker";
import s from "./beats.module.css";

const TABS = [
  { id: "grooves", label: "Grooves" },
  { id: "kit", label: "Kit" },
  { id: "beat", label: "Beat" },
  { id: "saved", label: "Save & share" },
];

const TEXT_INPUTS = new Set(["text", "search", "email", "number", "tel", "url", "password"]);

// Where a letter types or a key moves a list.
function isTyping(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && TEXT_INPUTS.has((el.type || "text").toLowerCase());
}

// Where Space already does something: presses a button, ticks a box, moves a slider.
function usesSpace(el) {
  if (!el || !el.tagName) return false;
  if (isTyping(el)) return true;
  if (["BUTTON", "A", "INPUT", "SUMMARY", "OPTION", "LABEL"].includes(el.tagName)) return true;
  const role = el.getAttribute("role");
  return Boolean(role && ["button", "checkbox", "radio", "switch", "tab", "gridcell", "slider", "link"].includes(role));
}

const narrowQuery = "(max-width: 720px)";
const subscribeNarrow = (fn) => {
  const q = window.matchMedia(narrowQuery);
  q.addEventListener("change", fn);
  return () => q.removeEventListener("change", fn);
};
const isNarrow = () => window.matchMedia(narrowQuery).matches;
const notNarrow = () => false;

// On a phone or tablet, Play and Record stay in reach at the foot of the screen once the console's
// own keys have scrolled out of sight (on the way down to the pads, say).
function CompactBar({ m, show }) {
  const { engineState } = m;
  const running = engineState.status === "running" || engineState.status === "starting";
  return (
    <div className={s.compact} data-show={show ? "true" : undefined} inert={!show}>
      <button type="button" className={s.compactPlay} data-on={running ? "true" : undefined} onClick={m.toggle}>
        <Icon name={running ? "stop" : "play"} size={18} />
        {running ? "Stop" : "Play"}
      </button>
      <button type="button" className={s.compactRec} aria-pressed={engineState.recording} onClick={m.toggleRecord}>
        <span className={s.recLamp} aria-hidden="true" />
        Record
      </button>
      <span className={s.compactInfo}>
        <span className={s.compactPart}>{m.playMode === "song" ? "Song" : m.selected.name}</span>
        <span className={s.compactTempo}>{m.beat.tempo} BPM</span>
      </span>
    </div>
  );
}

function announcement(state) {
  if (state.status === "running") return state.countIn ? "Count-in" : state.recording ? "Recording" : "Playing";
  if (state.ended) return "The song has finished";
  return "Stopped";
}

export default function BeatMaker() {
  const m = useBeatMaker();
  const { engine, engineState } = m;
  const [bus] = useState(createVisualBus);
  const [tab, setTab] = useState("grooves");
  const tabRefs = useRef({});
  const consoleRef = useRef(null);
  const flashTimers = useRef(new WeakMap());

  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, notNarrow);
  const view = m.prefs.view || (narrow ? "pads" : "grid");

  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = consoleRef.current?.querySelector("[data-transport-keys]");
    if (!el) return;
    const watch = new IntersectionObserver(([entry]) => setAway(!entry.isIntersecting));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Lights a drum's pad and its grid row for a moment: by hand or from the beat.
  const flash = useCallback((piece) => {
    const root = consoleRef.current;
    if (!root) return;
    root.querySelectorAll(`[data-flash="${piece}"]`).forEach((el) => {
      el.setAttribute("data-hit", "");
      clearTimeout(flashTimers.current.get(el));
      flashTimers.current.set(
        el,
        setTimeout(() => el.removeAttribute("data-hit"), 110),
      );
    });
  }, []);

  const playPiece = useCallback(
    (piece, level) => {
      engine?.hit(piece, level);
      flash(piece);
    },
    [engine, flash],
  );

  // Every frame while playing, the screen reads what is sounding now from the audio clock.
  const status = engineState.status;
  useEffect(() => {
    if (!engine) return;
    if (status !== "running") {
      bus.emit(null);
      return;
    }
    let last = engine.audibleNow();
    let raf = requestAnimationFrame(function frame() {
      const now = engine.audibleNow();
      for (const h of engine.hitsBetween(last, now)) flash(h.piece);
      last = now;
      bus.emit(engine.snapshot());
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [engine, status, bus, flash]);

  // The computer keyboard is a drum kit: each pad shows its key. Shift plays an accent. Space
  // starts and stops; Ctrl+Z and Ctrl+Shift+Z undo and redo. Never where a key already types.
  const onKey = useEffectEvent((e) => {
    if (e.defaultPrevented) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")) {
      if (isTyping(e.target)) return;
      e.preventDefault();
      if (e.key === "y" || e.key === "Y" || e.shiftKey) m.redo();
      else m.undo();
      return;
    }
    if (mod || e.altKey) return;
    if (e.code === "Space" || e.key === " ") {
      if (usesSpace(e.target)) return;
      e.preventDefault();
      if (!e.repeat) m.toggle();
      return;
    }
    const piece = PIECE_BY_CODE[e.code];
    if (!piece || isTyping(e.target)) return;
    e.preventDefault();
    if (e.repeat) return;
    playPiece(piece.id, e.shiftKey ? LEVEL.accent : m.tool);
  });
  useEffect(() => {
    const handler = (e) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function selectTab(id, moveFocus) {
    setTab(id);
    if (moveFocus) requestAnimationFrame(() => tabRefs.current[id]?.focus());
  }

  function onTabKey(e, index) {
    const last = TABS.length - 1;
    const to = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    selectTab(TABS[to].id, true);
  }

  const loading = m.ready < m.total;

  return (
    <VisualBus.Provider value={bus}>
      <div className={s.page}>
        <Link href="/tools" className="rw-back">
          <Icon name="arrow-left" size={14} /> Music tools
        </Link>
        <h1 className={s.title}>Beat Maker</h1>
        <p className={s.lead}>
          Play drums on the pads or your keyboard, start from a groove, and build your own beat part by part into a song. Use it to practise
          drums, or to make a backing beat for any instrument.
        </p>

        {m.shared && (
          <div className={s.shared} role="status">
            {m.shared.broken ? (
              <>
                <div>
                  <p className={s.sharedTitle}>This link didn&rsquo;t have a beat in it</p>
                  <p className={s.sharedText}>It may have been cut short when it was copied. Your own beat is still here.</p>
                </div>
                <div className={s.buttonRow}>
                  <button type="button" className={s.paperButton} onClick={m.clearSharedLink}>
                    Dismiss
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className={s.sharedTitle}>Someone shared a beat with you{m.shared.beat.name ? `: “${m.shared.beat.name}”` : ""}</p>
                  <p className={s.sharedText}>
                    {describeBeat(m.shared.beat)}. Opening it replaces the beat on screen; Undo brings yours back, and anything you saved stays
                    saved.
                  </p>
                </div>
                <div className={s.buttonRow}>
                  <button
                    type="button"
                    className={s.paperButtonStrong}
                    onClick={() => {
                      m.load(m.shared.beat);
                      m.clearSharedLink();
                    }}
                  >
                    Open it
                  </button>
                  <button type="button" className={s.paperButton} onClick={m.clearSharedLink}>
                    Not now
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <section ref={consoleRef} className={s.console} data-view={view} aria-label="Beat maker">
          <Transport m={m} />
          {(loading || m.loadFailed.length > 0 || engineState.error) && (
            <div className={s.consoleNotes}>
              {loading && m.loadFailed.length === 0 && (
                <p className={s.loading} role="status">
                  Loading the drums… {m.ready} of {m.total}
                </p>
              )}
              {m.loadFailed.length > 0 && (
                <p className={s.alert} role="alert">
                  {m.loadFailed.length === 1 ? "One drum sound" : `${m.loadFailed.length} drum sounds`} didn&rsquo;t load.{" "}
                  <button type="button" className={s.inlineLink} onClick={m.retryLoad}>
                    Try again
                  </button>
                </p>
              )}
              {engineState.error && (
                <p className={s.alert} role="alert">
                  {engineState.error}
                </p>
              )}
            </div>
          )}

          <PartTabs m={m} />

          <div className={s.viewBar}>
            <div className={s.toolGroup} role="radiogroup" aria-label="How hard to play">
              {[
                { level: LEVEL.ghost, label: "Ghost" },
                { level: LEVEL.normal, label: "Hit" },
                { level: LEVEL.accent, label: "Accent" },
              ].map((t) => (
                <button
                  key={t.level}
                  type="button"
                  role="radio"
                  aria-checked={m.tool === t.level}
                  className={s.toolKey}
                  data-level={t.level}
                  onClick={() => m.setTool(t.level)}
                >
                  <span className={s.toolMark} data-level={t.level} aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className={s.viewSwitch} role="radiogroup" aria-label="Show">
              {[
                { id: "grid", label: "Grid" },
                { id: "pads", label: "Pads" },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={view === v.id}
                  className={s.viewKey}
                  onClick={() => m.setPrefs({ view: v.id })}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {view === "grid" ? <StepGrid m={m} playPiece={playPiece} /> : <PadKit m={m} playPiece={playPiece} />}

          <SongStrip m={m} />
        </section>

        <div className={s.settings}>
          <h2 className={s.srOnly}>Settings</h2>
          <div className={s.tabs} role="tablist" aria-label="Beat maker settings">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`bm-tab-${t.id}`}
                aria-controls={`bm-panel-${t.id}`}
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                className={s.tab}
                onClick={() => selectTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {TABS.map((t) => (
            <div key={t.id} role="tabpanel" id={`bm-panel-${t.id}`} aria-labelledby={`bm-tab-${t.id}`} hidden={tab !== t.id} className={s.panel}>
              {t.id === "grooves" && <SettingsGrooves m={m} />}
              {t.id === "kit" && <SettingsKit m={m} playPiece={playPiece} />}
              {t.id === "beat" && <SettingsBeat m={m} />}
              {t.id === "saved" && <SettingsSaved m={m} />}
            </div>
          ))}
        </div>

        <p className={s.credit}>
          Drum sounds:{" "}
          <a href="https://drumgizmo.org/wiki/doku.php?id=kits:drskit" target="_blank" rel="noreferrer">
            DRSKit
          </a>{" "}
          by Jes Eiler of DRSDrums and the DrumGizmo team,{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          , mixed and shortened for this page. Your beats are kept in this browser.
        </p>

        <p className={s.srOnly} aria-live="polite">
          {announcement(engineState)}
        </p>

        <CompactBar m={m} show={away} />
      </div>
    </VisualBus.Provider>
  );
}
