"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import Icon from "./Icon";
import s from "./CompareTakes.module.css";

function clock(t) {
  const whole = Math.max(0, Math.floor(t || 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// Where a sent take sits in the song: it starts at recording.offset and runs for its duration. A take
// played slowed covers less of the song than it lasts, so its own time is scaled by its speed.
const speedOf = (take) => take.recording.speed ?? 1;
const span = (take) => ({ start: take.recording.offset ?? 0, end: (take.recording.offset ?? 0) + (take.recording.duration ?? 0) * speedOf(take) });

// Two of a student's sent takes, heard one at a time at the same point in the song, so they can hear
// what changed. The switch flips between them without losing the place: a take's own time plus where
// it starts in the song is the song's time. Just their playing, without the band.
// takes: [{ id, label: "Attempt 3", date: "Nov 6", recording: { url, offset, duration } }], newest first.
export default function CompareTakes({ takes }) {
  const [pick, setPick] = useState({ a: takes[1].id, b: takes[0].id });
  const [active, setActive] = useState("b");
  const [playing, setPlaying] = useState(false);
  const chosen = { a: takes.find((t) => t.id === pick.a) ?? takes[1], b: takes.find((t) => t.id === pick.b) ?? takes[0] };
  // Start where both takes are playing, so the first switch has something to compare.
  const both = Math.max(span(chosen.a).start, span(chosen.b).start);
  const [songTime, setSongTime] = useState(both);
  const [note, setNote] = useState("");
  const aRef = useRef(null);
  const bRef = useRef(null);
  const audioFor = (side) => (side === "a" ? aRef.current : bRef.current);

  const whole = { start: Math.min(span(chosen.a).start, span(chosen.b).start), end: Math.max(span(chosen.a).end, span(chosen.b).end) };
  const covers = (side, t) => t >= span(chosen[side]).start && t <= span(chosen[side]).end;

  // The place in the song follows the take that's playing, a few times a second.
  useEffect(() => {
    if (!playing) return;
    const el = audioFor(active);
    const offset = span(chosen[active]).start;
    const rate = speedOf(chosen[active]);
    const id = setInterval(() => setSongTime(el.currentTime * rate + offset), 100);
    return () => clearInterval(id);
    // chosen is rebuilt every render; the take that's playing is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, active, pick]);

  function stop() {
    aRef.current?.pause();
    bRef.current?.pause();
    setPlaying(false);
  }

  async function play() {
    const take = chosen[active];
    let t = songTime;
    if (!covers(active, t)) {
      t = span(take).start;
      setSongTime(t);
    }
    const el = audioFor(active);
    el.currentTime = Math.max(0, (t - span(take).start) / speedOf(take));
    setNote("");
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setNote("That take wouldn't play. Reload the page and try again: recording links expire after 15 minutes.");
    }
  }

  // Switches take at the same point in the song, playing on if it was.
  function choose(side) {
    if (side === active) return;
    const take = chosen[side];
    const t = playing ? audioFor(active).currentTime * speedOf(chosen[active]) + span(chosen[active]).start : songTime;
    if (!covers(side, t)) {
      setNote(`${take.label} doesn't reach ${clock(t)}: it runs from ${clock(span(take).start)} to ${clock(span(take).end)}.`);
      return;
    }
    setNote("");
    const wasPlaying = playing;
    audioFor(active).pause();
    const el = audioFor(side);
    el.currentTime = Math.max(0, (t - span(take).start) / speedOf(take));
    setActive(side);
    setSongTime(t);
    if (wasPlaying) el.play().catch(() => setPlaying(false));
  }

  function seek(t) {
    setSongTime(t);
    if (covers(active, t)) {
      setNote("");
      audioFor(active).currentTime = Math.max(0, (t - span(chosen[active]).start) / speedOf(chosen[active]));
    } else {
      stop();
      setNote(`${chosen[active].label} runs from ${clock(span(chosen[active]).start)} to ${clock(span(chosen[active]).end)}.`);
    }
  }

  function repick(side, id) {
    stop();
    setNote("");
    const next = { ...pick, [side]: id };
    setPick(next);
    const a = takes.find((t) => t.id === next.a);
    const b = takes.find((t) => t.id === next.b);
    setSongTime(Math.max(span(a).start, span(b).start));
  }

  return (
    <section className={s.panel} aria-label="Compare takes">
      <p className={s.intro}>Hear two of your takes at the same point in the song. Switch while it plays to hear what changed.</p>

      {takes.length > 2 && (
        <div className={s.picks}>
          {["a", "b"].map((side) => (
            <label key={side} className={s.pick}>
              <span>{side === "a" ? "Earlier take" : "Later take"}</span>
              <select value={pick[side]} onChange={(e) => repick(side, e.target.value)}>
                {takes
                  .filter((t) => t.id !== pick[side === "a" ? "b" : "a"])
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.date}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className={s.switch} role="group" aria-label="Which take plays">
        {["a", "b"].map((side) => (
          <button key={side} type="button" aria-pressed={active === side} onClick={() => choose(side)}>
            <span className={s.label}>{chosen[side].label}</span>
            <span className={s.date}>Sent {chosen[side].date}</span>
          </button>
        ))}
      </div>

      <div className={s.controls}>
        <Button type="button" size="sm" onClick={playing ? stop : play}>
          <Icon name={playing ? "pause" : "play"} size={14} />
          {playing ? "Pause" : "Play"}
        </Button>
        <span className={s.time}>{clock(songTime)}</span>
        <input
          type="range"
          className={s.scrub}
          min={whole.start}
          max={whole.end}
          step={0.1}
          value={Math.min(whole.end, Math.max(whole.start, songTime))}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Place in the song"
          aria-valuetext={clock(songTime)}
        />
      </div>

      {note && (
        <p className={s.note} role="status">
          {note}
        </p>
      )}

      {/* Both loaded, so a switch is instant. A filmed take is shown, the one that's playing. */}
      {["a", "b"].map((side) =>
        chosen[side].recording.media === "video" ? (
          <video key={side} ref={side === "a" ? aRef : bRef} src={chosen[side].recording.url} preload="auto" playsInline hidden={active !== side} onEnded={() => setPlaying(false)} style={{ width: "100%", maxHeight: 420, marginTop: 12, background: "var(--rw-console)" }} />
        ) : (
          <audio key={side} ref={side === "a" ? aRef : bRef} src={chosen[side].recording.url} preload="auto" onEnded={() => setPlaying(false)} />
        )
      )}
    </section>
  );
}
