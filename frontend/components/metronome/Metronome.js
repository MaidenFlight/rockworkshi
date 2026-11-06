"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import Icon from "@/components/member/Icon";
import { cellsOf, pulseNote } from "@/lib/metronome/rhythm";
import Console, { useLive } from "./Console";
import NoteValue, { PULSE_SYMBOL } from "./NoteValue";
import SettingsMetronome from "./SettingsMetronome";
import SettingsPresets from "./SettingsPresets";
import SettingsTraining from "./SettingsTraining";
import { useMetronome } from "./useMetronome";
import { VisualBus, createVisualBus, useVisual } from "./visual";
import s from "./metronome.module.css";

const TABS = [
  { id: "metronome", label: "Metronome" },
  { id: "training", label: "Training" },
  { id: "presets", label: "Presets" },
];

const TEXT_INPUTS = new Set(["text", "search", "email", "number", "tel", "url", "password"]);

// Where T would type a letter or jump a list.
function isTyping(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && TEXT_INPUTS.has((el.type || "text").toLowerCase());
}

// Where Space already does something: presses a button, ticks a box, moves a slider, types.
function usesSpace(el) {
  if (!el || !el.tagName) return false;
  if (isTyping(el)) return true;
  if (["BUTTON", "A", "INPUT", "SUMMARY", "OPTION", "LABEL"].includes(el.tagName)) return true;
  const role = el.getAttribute("role");
  return Boolean(role && ["button", "checkbox", "radio", "switch", "tab", "menuitem", "option", "slider", "spinbutton", "link"].includes(role));
}

function announcement(engineState, live, config) {
  const { status, ended } = engineState;
  if (status === "running") {
    if (config.training.mode === "builder" && live && live.stage !== null) return `Tempo ${live.tempo}`;
    return "Playing";
  }
  if (status === "interrupted") return "Sound interrupted";
  if (ended === "target") return "Tempo builder finished";
  if (ended === "timer") return "Time's up";
  return "Stopped";
}

export default function Metronome() {
  const m = useMetronome();
  const [bus] = useState(createVisualBus);
  const [tab, setTab] = useState("metronome");
  const [focus, setFocus] = useState(false);
  const [away, setAway] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(72);
  const sentinel = useRef(null);
  const dialog = useRef(null);
  const nameRef = useRef(null);
  const tabRefs = useRef({});
  const status = m.engineState.status;
  const active = status === "running" || status === "starting";

  // Every frame while playing, the screen reads what is sounding now. When playback stops, one
  // last read clears the lights and keeps the final bar and time.
  useEffect(() => {
    const engine = m.engine;
    if (!engine) return;
    if (status !== "running") {
      bus.emit(engine.snapshot());
      return;
    }
    let raf = requestAnimationFrame(function step() {
      bus.emit(engine.snapshot());
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [m.engine, status, bus]);

  const toggle = () => {
    if (status === "interrupted") m.resume();
    else if (active) m.stop();
    else m.start();
  };

  // Space starts and stops, T taps, but never where those keys already mean something.
  const onKey = useEffectEvent((e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (e.key === " ") {
      if (usesSpace(e.target)) return;
      e.preventDefault();
      toggle();
    } else if (e.key === "t" || e.key === "T") {
      if (isTyping(e.target) || m.config.training.mode === "builder") return;
      e.preventDefault();
      m.tap();
    }
  });
  useEffect(() => {
    const handler = (e) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // On a phone, a compact transport appears while the console's own is out of sight.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const watch = new IntersectionObserver(([entry]) => setAway(!entry.isIntersecting));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // The console sticks under the site header on wide screens, whatever height that is.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const watch = new ResizeObserver(() => setHeaderHeight(header.getBoundingClientRect().height));
    watch.observe(header);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (focus && !d.open) d.showModal();
    else if (!focus && d.open) d.close();
  }, [focus]);

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

  const live = useLive();

  return (
    <VisualBus.Provider value={bus}>
      <div className={s.page} style={{ "--mt-top": `${Math.round(headerHeight) + 16}px` }}>
        <Link href="/tools" className="rw-back">
          <Icon name="arrow-left" size={14} /> Music tools
        </Link>
        <h1 className={s.title}>Metronome</h1>
        <p className={s.lead}>Set a tempo, press Start and play along.</p>

        {m.shared && (
          <div className={s.shared} role="status">
            <div>
              <p className={s.sharedTitle}>You opened a shared practice setup</p>
              <p className={s.sharedText}>
                {m.shared.summary}. Nothing has been saved, and it won&rsquo;t play until you press Start.
              </p>
              {m.shared.issues.length > 0 && (
                <p className={s.sharedText}>
                  Some settings in the link couldn&rsquo;t be read, so they were left as they normally start: {m.shared.issues.join(", ")}.
                </p>
              )}
            </div>
            <div className={s.buttonRow}>
              <button
                type="button"
                className={s.paperButtonStrong}
                onClick={() => {
                  setTab("presets");
                  requestAnimationFrame(() => nameRef.current?.focus());
                }}
              >
                Save it as a preset
              </button>
              <button type="button" className={s.paperButton} onClick={m.dismissShared}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className={s.layout}>
          <div className={s.consoleCol}>
            <h2 className={s.srOnly}>Metronome controls</h2>
            <Console m={m} size="page" onToggleFocus={() => setFocus(true)} onEditTraining={() => selectTab("training", true)} />
            <div ref={sentinel} className={s.sentinel} aria-hidden="true" />
          </div>

          <div className={s.settingsCol}>
            <h2 className={s.srOnly}>Settings</h2>
            <div className={s.tabs} role="tablist" aria-label="Metronome settings">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`mt-tab-${t.id}`}
                  aria-controls={`mt-panel-${t.id}`}
                  aria-selected={tab === t.id}
                  tabIndex={tab === t.id ? 0 : -1}
                  className={s.tab}
                  onClick={() => selectTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {t.label}
                  {t.id === "training" && m.config.training.mode !== "off" && <span className={s.tabOn}>On</span>}
                </button>
              ))}
            </div>
            {TABS.map((t) => (
              <div key={t.id} role="tabpanel" id={`mt-panel-${t.id}`} aria-labelledby={`mt-tab-${t.id}`} hidden={tab !== t.id} className={s.panel}>
                {t.id === "metronome" && <SettingsMetronome m={m} />}
                {t.id === "training" && <SettingsTraining m={m} />}
                {t.id === "presets" && <SettingsPresets m={m} nameRef={nameRef} />}
              </div>
            ))}
          </div>
        </div>

        <p className={s.limits}>
          Keep this page open and the screen on while you practise: phones and browsers can pause sound in the background or when the
          screen locks. If that happens the metronome stops and offers Resume.
        </p>

        <CompactBar m={m} show={away && !focus} onToggle={toggle} />

        <p className={s.srOnly} aria-live="polite">
          {announcement(m.engineState, live, m.config)}
        </p>

        <dialog ref={dialog} className={s.focusDialog} aria-label="Focus view" onClose={() => setFocus(false)}>
          {focus && <Console m={m} size="focus" onToggleFocus={() => setFocus(false)} onEditTraining={() => setFocus(false)} />}
        </dialog>
      </div>
    </VisualBus.Provider>
  );
}

// The phone's always-in-reach transport: Start/Stop, the tempo, the beat, and Tap.
function CompactBar({ m, show, onToggle }) {
  const { config, engineState } = m;
  const status = engineState.status;
  const active = status === "running" || status === "starting";
  const builderOn = config.training.mode === "builder";
  const live = useLive();
  const tempo = builderOn ? (status === "running" && live?.tempo ? live.tempo : config.training.builder.start) : config.tempo;
  const dots = useRef([]);
  const cells = cellsOf(config.meter).length;
  useVisual((snap) => {
    const on = Boolean(snap?.running) && !snap.waiting;
    dots.current.forEach((el, i) => {
      if (!el) return;
      if (on && snap.cell === i) el.setAttribute("data-now", snap.countIn ? "count" : snap.phase === "rest" ? "rest" : "play");
      else el.removeAttribute("data-now");
    });
  });
  return (
    <div className={s.compact} data-show={show ? "true" : undefined} inert={!show}>
      <button type="button" className={s.compactPlay} data-on={active ? "true" : undefined} onClick={onToggle}>
        <Icon name={status === "interrupted" ? "play" : active ? "stop" : "play"} size={18} />
        {status === "interrupted" ? "Resume" : active ? "Stop" : "Start"}
      </button>
      <span className={s.compactTempo}>
        <NoteValue {...PULSE_SYMBOL[pulseNote(config.meter)]} height={22} />
        <span aria-hidden="true">=</span>
        <span className={s.compactValue}>{tempo}</span>
      </span>
      <span className={s.compactBeats} aria-hidden="true">
        {Array.from({ length: Math.min(cells, 12) }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              dots.current[i] = el;
            }}
            data-level={config.accents[i]}
          />
        ))}
      </span>
      <button type="button" className={s.compactTap} onClick={m.tap} disabled={builderOn}>
        Tap
      </button>
    </div>
  );
}
