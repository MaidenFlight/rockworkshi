"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ChordChart from "@/components/member/ChordChart";
import Icon from "@/components/member/Icon";
import Timeline, { partColor } from "@/components/member/player/Timeline";
import { PlayClock } from "@/components/member/player/clock";
import preview from "@/lib/preview/rain-chorus.json";

// The member area's player on the homepage, silent. The real timeline lanes and chord chart, driven
// by a timer instead of the audio engine, over eight bars of one song. Nothing is loaded or played:
// the lanes are loudness outlines measured from the stems by scripts/make-home-preview.py.
// It opens small (the transport, speed and the chord cards) and "Explore the player" opens the band
// and the full chart in place. The button sits above everything it reveals, so it never moves.

const MODES = [
  { id: "full", label: "Whole song" },
  { id: "solo", label: "Isolated track" },
  { id: "minus", label: "Without one part" },
];
const SPEEDS = [0.5, 0.75, 0.9, 1];
const PARTS = Object.keys(preview.lanes);
const chart = preview.chart;
const duration = chart.end;
const section = chart.sections[0];
const barTimes = section.bars.map((b) => b.time);
// The page re-renders with the position this often; anything that glides reads the clock itself.
const RENDER_EVERY_MS = 66;
// Previous bar goes back to the start of this bar if it's this far in, else to the bar before.
const BAR_RESTART_S = 0.6;

const barIndexAt = (t) => Math.max(0, barTimes.findLastIndex((b) => b <= t + 0.001));
const barStartAt = (t) => barTimes[barIndexAt(t)];
const barEndAt = (t) => barTimes[barIndexAt(t) + 1] ?? duration;

function clock(s) {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function prefersStill() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function ConsolePreview() {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState("full");
  const [focus, setFocus] = useState("Guitar");
  const [loop, setLoop] = useState(null); // { start, end }
  const [expanded, setExpanded] = useState(false);
  const ids = useId();
  const bandId = `${ids}band`;
  const chartId = `${ids}chart`;
  // With reduced motion the song steps a bar at a time instead of gliding.
  const [still, setStill] = useState(prefersStill);
  // The timer: where it was last started from, when, and how it runs. Read only outside render.
  const run = useRef({ from: 0, at: 0, playing: false, speed: 1, loop: null, still });
  // Off screen nothing is redrawn; the timer keeps time, so it picks up where the song has got to.
  const root = useRef(null);
  const [visible, setVisible] = useState(true);
  const live = playing && visible;

  useEffect(() => {
    const watch = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    watch.observe(root.current);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    let query;
    try {
      query = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const change = () => setStill(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    run.current.still = still;
  }, [still]);

  const positionNow = useCallback(() => {
    const r = run.current;
    let t = r.from;
    if (r.playing) {
      t += ((performance.now() - r.at) / 1000) * r.speed;
      const start = r.loop ? r.loop.start : 0;
      const end = r.loop ? r.loop.end : duration;
      if (t >= end) t = start + ((t - start) % (end - start));
    }
    return r.still && r.playing ? barStartAt(t) : t;
  }, []);

  // While playing in view, re-render a few times a second so the chart and the clock keep up.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setPosition(positionNow()), RENDER_EVERY_MS);
    return () => clearInterval(id);
  }, [live, positionNow]);

  const restart = useCallback((from) => {
    run.current.from = from;
    run.current.at = performance.now();
  }, []);

  function play() {
    restart(run.current.from >= (run.current.loop?.end ?? duration) - 0.05 ? (run.current.loop?.start ?? 0) : run.current.from);
    run.current.playing = true;
    setPlaying(true);
  }

  function pause() {
    const t = positionNow();
    run.current.playing = false;
    restart(t);
    setPlaying(false);
    setPosition(t);
  }

  const seek = useCallback((t) => {
    const r = run.current;
    const start = r.loop ? r.loop.start : 0;
    const end = r.loop ? r.loop.end : duration;
    const to = Math.min(end - 0.01, Math.max(start, t));
    r.from = to;
    r.at = performance.now();
    setPosition(to);
  }, []);

  function changeSpeed(s) {
    restart(positionNow());
    run.current.speed = s;
    setSpeed(s);
  }

  const loopRange = useCallback(
    (start, end) => {
      if (end - start < 0.5) return;
      run.current.loop = { start, end };
      setLoop({ start, end });
      seek(start);
    },
    [seek]
  );

  function clearLoop() {
    run.current.loop = null;
    setLoop(null);
  }

  // Closing the full player also stops it, so the small view always starts from a known place.
  // Speed, loop and the band choices are kept for next time.
  function toggleExpanded() {
    if (expanded && playing) pause();
    setExpanded(!expanded);
  }

  function stepBar(direction) {
    const t = positionNow();
    const i = barIndexAt(t);
    const target = direction < 0 ? (t - barTimes[i] > BAR_RESTART_S ? i : i - 1) : i + 1;
    seek(barTimes[(target + barTimes.length) % barTimes.length]);
  }

  // The same states the real player gives each part, minus the mixer.
  const lanes = useMemo(
    () =>
      PARTS.map((p) => ({
        id: p,
        label: p,
        color: partColor(p),
        state: mode === "solo" ? (p === focus ? "playing" : "off") : mode === "minus" ? (p === focus ? "off" : "playing") : "playing",
        peaks: preview.lanes[p],
      })),
    [mode, focus]
  );
  const clockValue = useMemo(() => ({ getPosition: positionNow, playing: live }), [positionNow, live]);
  const snap = useMemo(() => ({ start: barStartAt, end: barEndAt }), []);

  const bar = barIndexAt(position) + 1;
  const loopBars = loop ? [barIndexAt(loop.start) + 1, barIndexAt(loop.end - 0.01) + 1] : null;

  return (
    <PlayClock.Provider value={clockValue}>
      <div ref={root} className="rw-player rw-preview-player" data-expanded={expanded ? "true" : "false"}>
        <div className="rw-transport rw-preview-transport">
          <div className="rw-tp-row">
            <div role="group" aria-label="Transport" className="rw-tp-keys">
              <button type="button" className="rw-tp-key" onClick={() => stepBar(-1)} aria-label="Previous bar">
                <Icon name="bar-back" size={18} />
              </button>
              <button type="button" className="rw-tp-play" onClick={playing ? pause : play} data-playing={playing ? "true" : "false"}>
                <Icon name={playing ? "pause" : "play"} size={18} />
                {playing ? "Pause" : "Play"}
              </button>
              <button type="button" className="rw-tp-key" onClick={() => stepBar(1)} aria-label="Next bar">
                <Icon name="bar-forward" size={18} />
              </button>
            </div>

            <div className="rw-tp-clock">
              <span className="rw-tp-time">
                <span className="rw-tp-now">{clock(position)}</span>
                <span className="rw-tp-total">/ {clock(duration)}</span>
              </span>
              <span className="rw-tp-state" data-state={playing ? "playing" : "paused"}>
                {playing ? (speed < 1 ? `Playing at ${Math.round(speed * 100)}%` : "Playing") : "Paused"}
              </span>
            </div>

            <div className="rw-tp-where">
              <span className="rw-tp-section">{section.name}</span>
              <span className="rw-tp-bar">
                Bar {bar} of {barTimes.length}
              </span>
              <span className="rw-tp-progress" aria-hidden="true">
                <span style={{ transform: `scaleX(${(bar - 1) / barTimes.length})` }} />
              </span>
            </div>

            <span className="rw-preview-silent">
              <Icon name="sound-off" size={16} />
              Silent preview
            </span>
          </div>

          <div className="rw-preview-practice">
            <div className="rw-tp-row rw-tp-practice">
              <div role="group" aria-label="Speed" className="rw-tp-group">
                <span className="rw-tp-label">Speed</span>
                <span className="rw-seg">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" onClick={() => changeSpeed(s)} aria-pressed={speed === s}>
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                </span>
              </div>
              {loop && (
                <div className="rw-tp-group rw-tp-loop">
                  <Icon name="loop" size={15} />
                  <span>{loopBars[0] === loopBars[1] ? `Repeating bar ${loopBars[0]}` : `Repeating bars ${loopBars[0]} to ${loopBars[1]}`}</span>
                  <button type="button" className="rw-tp-x" onClick={clearLoop} aria-label="Clear the loop">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              )}
            </div>
            {/* Beside the speed row, not inside it: on a phone that row scrolls sideways, and the
                button would scroll out of sight with it. */}
            <button
              type="button"
              className="rw-preview-toggle"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={`${bandId} ${chartId}`}
            >
              {expanded ? "Collapse player" : "Explore the player"}
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
        </div>

        {/* Kept in the page while closed, so aria-controls always points at something. */}
        <div id={bandId} hidden={!expanded}>
          {expanded && (
            <Timeline
              duration={duration}
              chart={chart}
              lanes={lanes}
              loop={loop}
              snap={snap}
              onLoop={loopRange}
              getPosition={positionNow}
              playing={live}
              position={position}
              onSeek={seek}
              disabled={false}
              header={
                <div className="rw-tl-header">
                  <div role="group" aria-label="Band" className="rw-tp-group">
                    <span className="rw-tp-label">Band</span>
                    <span className="rw-seg">
                      {MODES.map((m) => (
                        <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}>
                          {m.label}
                        </button>
                      ))}
                    </span>
                  </div>
                  {mode !== "full" && (
                    <div role="group" aria-label={mode === "solo" ? "Only this part" : "Leave out"} className="rw-tp-group">
                      <span className="rw-tp-label">{mode === "solo" ? "Only" : "Leave out"}</span>
                      {PARTS.map((p) => (
                        <button key={p} type="button" onClick={() => setFocus(p)} aria-pressed={focus === p} className="rw-focus-chip" style={{ "--lane": partColor(p) }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              }
              footer={null}
            />
          )}
        </div>

        <section id={chartId} className="rw-practice" aria-label="Play along">
          <ChordChart
            chart={chart}
            position={position}
            myPart="Guitar"
            loop={loop}
            onSeek={seek}
            onLoopSection={loopRange}
            ephemeral
            titleAs="h4"
            endLabel="Back to bar 1"
            compact={!expanded}
          />
        </section>
      </div>
    </PlayClock.Provider>
  );
}
