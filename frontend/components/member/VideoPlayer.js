"use client";

import { useEffect, useRef, useState } from "react";
import { progressionFor } from "@/lib/keyChords";

const SECTION_TEMPLATE = [
  { id: "intro", name: "Intro", start: 0, end: 14 },
  { id: "verse-1", name: "Verse 1", start: 14, end: 42 },
  { id: "chorus-1", name: "Chorus 1", start: 42, end: 66 },
  { id: "verse-2", name: "Verse 2", start: 66, end: 94 },
  { id: "chorus-2", name: "Chorus 2", start: 94, end: 118 },
  { id: "instrumental", name: "Instrumental", start: 118, end: 142 },
  { id: "final-chorus", name: "Final Chorus", start: 142, end: 174 },
  { id: "outro", name: "Outro", start: 174, end: 190 },
];
const TEMPLATE_SPAN = SECTION_TEMPLATE[SECTION_TEMPLATE.length - 1].end;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

function fmtT(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parseT(str) {
  const parts = String(str).split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

export default function VideoPlayer({ lesson }) {
  const [videoType, setVideoType] = useState("lesson");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [sectionLoopId, setSectionLoopId] = useState(null);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [customLoopOn, setCustomLoopOn] = useState(false);
  const [customPanelOn, setCustomPanelOn] = useState(false);
  const [customStartText, setCustomStartText] = useState("");
  const [customEndText, setCustomEndText] = useState("");
  const [mediaMode, setMediaMode] = useState("video"); // 'video' | 'backing'
  const [backingPlaying, setBackingPlaying] = useState(false);
  const [chordOverlayOn, setChordOverlayOn] = useState(false);
  const [toast, setToast] = useState("");

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const sectionsRef = useRef(SECTION_TEMPLATE);
  const rafRef = useRef(null);
  const playerBoxRef = useRef(null);
  const toastTimer = useRef(null);

  const src = videoType === "lesson" ? lesson.videoUrl : lesson.playthroughVideoUrl;
  const sections = sectionsRef.current;
  const progression = progressionFor(lesson.key);

  function mediaEl() {
    return mediaMode === "backing" ? audioRef.current : videoRef.current;
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  // rAF tick: enforce loop boundaries, track playhead / active section
  useEffect(() => {
    function tick() {
      const el = mediaEl();
      if (el && !el.paused && !el.ended) {
        setCurrentTime(el.currentTime);
        if (sectionLoopId) {
          const sec = sections.find((s) => s.id === sectionLoopId);
          if (sec && (el.currentTime >= sec.end - 0.03 || el.currentTime < sec.start - 0.5)) {
            el.currentTime = sec.start;
          }
        } else if (customLoopOn && customStart != null && customEnd != null) {
          if (el.currentTime >= customEnd - 0.03 || el.currentTime < customStart - 0.5) {
            el.currentTime = customStart;
          }
        } else {
          const sec = sections.find((s) => el.currentTime >= s.start && el.currentTime < s.end);
          if (sec && sec.id !== activeSectionId) setActiveSectionId(sec.id);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionLoopId, customLoopOn, customStart, customEnd, mediaMode]);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        vpToggle();
      } else if (e.code === "ArrowLeft") {
        vpSkip(-5);
      } else if (e.code === "ArrowRight") {
        vpSkip(5);
      } else if (e.key === "l" || e.key === "L") {
        if (sectionLoopId || customLoopOn) stopLoop();
        else if (activeSectionId) loopSection(activeSectionId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  function onLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    const dur = el.duration || 0;
    setDuration(dur);
    const scale = dur / TEMPLATE_SPAN;
    const scaled = SECTION_TEMPLATE.map((s) => ({ ...s, start: s.start * scale, end: s.end * scale }));
    scaled[scaled.length - 1].end = dur;
    sectionsRef.current = scaled;
    el.playbackRate = speed;
    el.volume = volume;
    el.muted = muted;
  }

  function ensureBacking() {
    if (!audioRef.current) {
      const audio = new Audio(lesson.videoUrl);
      audio.onplay = () => setBackingPlaying(true);
      audio.onpause = () => setBackingPlaying(false);
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  function vpToggle() {
    const el = videoRef.current;
    if (!el) return;
    if (audioRef.current) audioRef.current.pause();
    if (mediaMode !== "video") setMediaMode("video");
    if (el.paused) el.play();
    else el.pause();
  }

  function vpSkip(delta) {
    const el = mediaEl();
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  }

  function vpSeekFrac(frac) {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    el.currentTime = frac * el.duration;
  }

  function onTimelineClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    vpSeekFrac(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }

  function vpSetSpeed(s) {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    if (audioRef.current) audioRef.current.playbackRate = s;
  }

  function vpSetVolume(v) {
    setVolume(v);
    setMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
  }

  function vpToggleMute() {
    const m = !muted;
    setMuted(m);
    if (videoRef.current) videoRef.current.muted = m;
  }

  function vpFullscreen() {
    const c = playerBoxRef.current;
    if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (c.requestFullscreen) c.requestFullscreen();
  }

  function playSection(id) {
    setActiveSectionId(id);
    const sec = sections.find((s) => s.id === id);
    const el = mediaEl();
    if (sec && el) {
      el.currentTime = sec.start;
      el.play();
    }
  }

  function loopSection(id) {
    setSectionLoopId(id);
    setCustomLoopOn(false);
    setActiveSectionId(id);
    const sec = sections.find((s) => s.id === id);
    const el = mediaEl();
    if (sec && el) {
      el.currentTime = sec.start;
      el.play();
    }
  }

  function stopLoop() {
    setSectionLoopId(null);
    setCustomLoopOn(false);
  }

  function setCustomStartNow() {
    const el = mediaEl();
    if (!el) return;
    setCustomStart(el.currentTime);
    setCustomStartText(fmtT(el.currentTime));
  }

  function setCustomEndNow() {
    const el = mediaEl();
    if (!el) return;
    setCustomEnd(el.currentTime);
    setCustomEndText(fmtT(el.currentTime));
  }

  function startCustomLoop() {
    if (customStart == null || customEnd == null || customEnd <= customStart) {
      showToast("Set a start and end time first.");
      return;
    }
    setSectionLoopId(null);
    setCustomLoopOn(true);
    const el = mediaEl();
    if (el) {
      el.currentTime = customStart;
      el.play();
    }
  }

  function clearCustomLoop() {
    setCustomLoopOn(false);
    setCustomStart(null);
    setCustomEnd(null);
    setCustomStartText("");
    setCustomEndText("");
  }

  function toggleBacking() {
    const audio = ensureBacking();
    if (audio.paused) {
      if (videoRef.current) videoRef.current.pause();
      setMediaMode("backing");
      audio.currentTime = currentTime;
      audio.play();
    } else {
      audio.pause();
    }
  }

  function closeBacking() {
    if (audioRef.current) audioRef.current.pause();
    setMediaMode("video");
    setSectionLoopId(null);
    setCustomLoopOn(false);
  }

  function printChordSheet() {
    document.body.classList.add("rw-printing-chords");
    window.print();
    setTimeout(() => document.body.classList.remove("rw-printing-chords"), 500);
  }

  const pct = duration ? (currentTime / duration) * 100 : 0;
  const activeLoop = sectionLoopId
    ? sections.find((s) => s.id === sectionLoopId)
    : customLoopOn
    ? { name: "Custom loop", start: customStart, end: customEnd }
    : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["lesson", "playthrough"].map((t) => (
          <button
            key={t}
            onClick={() => setVideoType(t)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: videoType === t ? "1px solid #ef5130" : "1px solid #d8cab8",
              background: videoType === t ? "#fdece6" : "#fff",
              fontWeight: 700,
              fontSize: 13,
              color: "#0a2338",
              cursor: "pointer",
            }}
          >
            {t === "lesson" ? "Lesson video" : "Playthrough"}
          </button>
        ))}
      </div>

      <div ref={playerBoxRef} style={{ position: "relative", background: "#06192d", borderRadius: 12, overflow: "hidden" }}>
        {src ? (
          <video
            key={src}
            ref={videoRef}
            src={src}
            style={{ width: "100%", display: "block", maxHeight: 480, background: "#000" }}
            onLoadedMetadata={onLoadedMetadata}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={vpToggle}
          />
        ) : (
          <div style={{ padding: 60, textAlign: "center", color: "rgba(255,245,236,0.6)" }}>Video coming soon.</div>
        )}

        {src && (
          <div style={{ padding: "10px 14px", background: "#06192d" }}>
            <div onClick={onTimelineClick} style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.18)", borderRadius: 999, cursor: "pointer", marginBottom: 10 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "#ef5130", borderRadius: 999 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => vpSkip(-5)} style={iconBtn}>
                &#8630; 5s
              </button>
              <button onClick={vpToggle} style={{ ...iconBtn, background: "#ef5130", color: "#fff", border: "none" }}>
                {playing ? "Pause" : "Play"}
              </button>
              <button onClick={() => vpSkip(5)} style={iconBtn}>
                5s &#8631;
              </button>
              <span style={{ color: "#fff", fontSize: 12.5 }}>
                {fmtT(currentTime)} / {fmtT(duration)}
              </span>
              <span style={{ flex: 1 }} />
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => vpSetSpeed(s)}
                  style={{ ...iconBtn, background: speed === s ? "#ef5130" : "transparent", color: "#fff", fontSize: 11 }}
                >
                  {s}x
                </button>
              ))}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => vpSetVolume(Number(e.target.value))}
                style={{ width: 70 }}
              />
              <button onClick={vpToggleMute} style={iconBtn}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button onClick={vpFullscreen} style={iconBtn}>
                Fullscreen
              </button>
            </div>
          </div>
        )}
      </div>

      {activeLoop && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdece6", border: "1px solid #f3c7ba", borderRadius: 10, padding: "10px 16px", marginTop: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#cf3f20" }}>
            Looping: {activeLoop.name} ({fmtT(activeLoop.start)}–{fmtT(activeLoop.end)})
          </span>
          <button onClick={stopLoop} style={{ ...iconBtn, background: "#fff" }}>
            Stop Loop
          </button>
        </div>
      )}

      <h3 style={{ fontWeight: 700, fontSize: 16, color: "#0a2338", margin: "28px 0 12px" }}>Practice by section</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {sections.map((sec) => (
          <div
            key={sec.id}
            style={{
              padding: 12,
              borderRadius: 10,
              border: activeSectionId === sec.id ? "1px solid #ef5130" : "1px solid #ece0d5",
              background: activeSectionId === sec.id ? "#fdece6" : "#fffdf9",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0a2338" }}>{sec.name}</div>
            <div style={{ fontSize: 11.5, color: "#8a7d6a", marginBottom: 8 }}>
              {fmtT(sec.start)}–{fmtT(sec.end)}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => playSection(sec.id)} style={{ ...iconBtn, flex: 1, fontSize: 11 }}>
                Play
              </button>
              <button
                onClick={() => loopSection(sec.id)}
                style={{
                  ...iconBtn,
                  flex: 1,
                  fontSize: 11,
                  background: sectionLoopId === sec.id ? "#ef5130" : "#fff",
                  color: sectionLoopId === sec.id ? "#fff" : "#0a2338",
                }}
              >
                Loop
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={() => setCustomPanelOn((v) => !v)} style={iconBtn}>
          {customPanelOn ? "Hide custom loop" : "Custom A/B loop"}
        </button>
        {customPanelOn && (
          <div style={{ marginTop: 12, padding: 16, border: "1px solid #ece0d5", borderRadius: 10, background: "#fffdf9" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <label style={{ flex: 1, fontSize: 12.5, color: "#33454f" }}>
                Start
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={customStartText}
                    onChange={(e) => {
                      setCustomStartText(e.target.value);
                      setCustomStart(parseT(e.target.value));
                    }}
                    placeholder="0:00"
                    style={textInput}
                  />
                  <button onClick={setCustomStartNow} style={iconBtn}>
                    Now
                  </button>
                </div>
              </label>
              <label style={{ flex: 1, fontSize: 12.5, color: "#33454f" }}>
                End
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={customEndText}
                    onChange={(e) => {
                      setCustomEndText(e.target.value);
                      setCustomEnd(parseT(e.target.value));
                    }}
                    placeholder="0:10"
                    style={textInput}
                  />
                  <button onClick={setCustomEndNow} style={iconBtn}>
                    Now
                  </button>
                </div>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={startCustomLoop} className="rw-cta" style={{ ...iconBtn, background: "#ef5130", color: "#fff", border: "none" }}>
                Start Loop
              </button>
              <button onClick={clearCustomLoop} style={iconBtn}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 28 }}>
        <div style={{ border: "1px solid #ece0d5", borderRadius: 12, padding: 18, background: "#fffdf9" }}>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 10 }}>
            Backing track
          </div>
          <button onClick={toggleBacking} style={iconBtn}>
            {backingPlaying ? "Pause backing track" : "Play backing track"}
          </button>
          {mediaMode === "backing" && (
            <button onClick={closeBacking} style={{ ...iconBtn, marginLeft: 8 }}>
              Close
            </button>
          )}
        </div>

        <div style={{ border: "1px solid #ece0d5", borderRadius: 12, padding: 18, background: "#fffdf9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0e8a97" }}>
              Chord sheet
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={printChordSheet} style={iconBtn}>
                Print
              </button>
              <button onClick={() => setChordOverlayOn(true)} style={iconBtn}>
                Expand
              </button>
            </div>
          </div>
          <ChordSheetBody sections={sections} progression={progression} fmtT={fmtT} compact />
        </div>
      </div>

      {chordOverlayOn && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,35,56,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setChordOverlayOn(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fffdf9", borderRadius: 16, padding: 28, maxWidth: 640, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: "#0a2338" }}>
                {lesson.title} &mdash; Chord Sheet
              </h3>
              <button onClick={() => setChordOverlayOn(false)} style={iconBtn}>
                Close
              </button>
            </div>
            <ChordSheetBody sections={sections} progression={progression} fmtT={fmtT} />
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0a2338", color: "#fff", padding: "10px 20px", borderRadius: 999, fontSize: 13.5, zIndex: 90 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ChordSheetBody({ sections, progression, fmtT, compact }) {
  return (
    <div id="chordPrintArea" className="chord-scroll" style={{ maxHeight: compact ? 220 : "none", overflowY: compact ? "auto" : "visible" }}>
      {sections.map((sec, i) => (
        <div key={sec.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ece0d5", fontSize: 13.5 }}>
          <span style={{ color: "#33454f" }}>
            {sec.name} <span style={{ color: "#8a7d6a", fontSize: 11.5 }}>({fmtT(sec.start)}–{fmtT(sec.end)})</span>
          </span>
          <span style={{ fontWeight: 700, color: "#0a2338", fontFamily: "monospace" }}>
            {progression[i % progression.length]}
          </span>
        </div>
      ))}
    </div>
  );
}

const iconBtn = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid #d8cab8",
  background: "#fff",
  color: "#0a2338",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};

const textInput = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #d8cab8",
  fontSize: 13,
};
