"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import InstrumentIcon from "@/components/InstrumentIcon";
import { ui } from "@/components/ui";
import { instruments } from "@/lib/content";
import { NetworkError, practiceRequest } from "@/lib/practice";
import s from "./SongTutorials.module.css";

// The song page's video tutorials for the student's own instrument, above the practice player.
// Everything shown comes from published content (GET /songs/:id/tutorials), so a video the school
// publishes appears here without a code change. Until anything is published for the instrument,
// the section is one Coming soon panel rather than five empty cards. The server decides which
// instrument's videos come back; staff can preview another instrument's.

const KIND_LABEL = { lesson: "Lesson", playthrough: "Playthrough" };
const TERM_REASONS = ["locked", "preparing", "not_in_term"];
const cx = (...parts) => parts.filter(Boolean).join(" ");

// Signup stores one of the six names, but the settings page takes free text.
function knownInstrument(name) {
  const wanted = (name || "").trim().toLowerCase();
  return instruments.find((i) => i.name.toLowerCase() === wanted)?.name || null;
}

export default function SongTutorials({ songId, user, playerId, playerBelow }) {
  const staff = Boolean(user?.isAdmin || user?.isTeacher);
  const [preview, setPreview] = useState(() => knownInstrument(user?.instrument) || instruments[0].name);
  // { status: "loading" | "ready" | "failed" | "denied", data, offline, message, reason }
  const [load, setLoad] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const query = staff ? `?instrument=${encodeURIComponent(preview)}` : "";
    practiceRequest(`/songs/${songId}/tutorials${query}`).then(
      (data) => {
        if (!cancelled) setLoad({ status: "ready", data });
      },
      (err) => {
        if (cancelled) return;
        if (err instanceof NetworkError) setLoad({ status: "failed", offline: true });
        else if ([401, 402, 403].includes(err.status)) setLoad({ status: "denied", message: err.message, reason: err.reason });
        else setLoad({ status: "failed" });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [songId, staff, preview, attempt]);

  // Retry starts over; refresh keeps what's on screen while new links load (after a video fails).
  const retry = () => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  };
  const refresh = () => setAttempt((n) => n + 1);

  const instrument = load.status === "ready" ? load.data.instrument : staff ? preview : knownInstrument(user?.instrument);
  const levels = load.status === "ready" ? load.data.levels : [];
  const published = levels.some((l) => l.videos.length > 0);

  const goToPlayer = playerBelow ? <PlayerLink playerId={playerId} /> : null;
  const practiseLine = playerBelow ? " You can practise with the song player below." : "";

  let body;
  if (load.status === "loading") {
    body = (
      <p className={s.quiet} role="status">
        Loading video tutorials…
      </p>
    );
  } else if (load.status === "failed") {
    body = (
      <div className={s.state} role="alert">
        <div>
          <h3 className={s.problem}>{load.offline ? "You're offline" : "Video tutorials didn't load"}</h3>
          <p className={s.line}>
            {load.offline ? "Check your connection and try again." : "Something went wrong loading them. Try again in a moment."}
            {practiseLine}
          </p>
        </div>
        <div className={s.actions}>
          <button type="button" className={cx(ui.btn, ui.sm, ui.secondary, s.action)} onClick={retry}>
            Retry
          </button>
          {goToPlayer}
        </div>
      </div>
    );
  } else if (load.status === "denied") {
    // The same explanation the page gives when the song itself is shut.
    body = (
      <div className={s.state} role="status">
        <p className={s.line}>
          <strong className={s.strong}>{load.message}</strong>
          {TERM_REASONS.includes(load.reason) ? (
            <>
              {" "}
              Your term&apos;s songs open month by month. <Link href="/member" className={s.link}>See your term</Link>
            </>
          ) : null}
        </p>
      </div>
    );
  } else if (!instrument) {
    body = (
      <div className={s.state}>
        <p className={s.line}>
          Your account doesn&apos;t have an instrument yet, and video tutorials are made for each one. Ask the school to set it.
          {practiseLine}
        </p>
        {goToPlayer}
      </div>
    );
  } else if (!published) {
    body = (
      <div className={s.state}>
        <div>
          <h3 className={s.soon}>Coming soon</h3>
          <p className={s.line}>
            Video lessons for this song on {instrument.toLowerCase()} are on the way.{practiseLine}
          </p>
        </div>
        {goToPlayer}
      </div>
    );
  } else {
    body = <TutorialVideos key={instrument} levels={levels} onRefresh={refresh} />;
  }
  // With videos the section is tall, so the way past it goes at the top.
  const headLink = load.status === "ready" && published ? goToPlayer : null;

  return (
    <section className={s.tutorials} aria-labelledby="tutorials-title" aria-busy={load.status === "loading" || undefined}>
      <div className={s.head}>
        {instrument ? (
          <span className={s.mark}>
            <InstrumentIcon name={instrument} size={30} />
          </span>
        ) : null}
        <h2 id="tutorials-title" className={s.title}>
          {instrument ? `${instrument} video tutorials` : "Video tutorials"}
        </h2>
        {staff || headLink ? (
          <div className={s.headEnd}>
            {staff ? (
              <label className={s.previewAs}>
                Preview as
                <select
                  className={s.select}
                  value={preview}
                  onChange={(e) => {
                    setPreview(e.target.value);
                    setLoad({ status: "loading" });
                  }}
                >
                  {instruments.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {headLink}
          </div>
        ) : null}
      </div>
      {body}
    </section>
  );
}

// Published videos for one instrument: one player, and the five levels beside it. Levels with
// nothing yet stay listed, quietly, as coming soon.
function TutorialVideos({ levels, onRefresh }) {
  const videos = levels.flatMap((l) => l.videos.map((v) => ({ ...v, level: l.level, name: l.name, key: `${l.level}-${v.kind}` })));
  const [chosen, setChosen] = useState(() => (videos.find((v) => v.status === "ready") || videos[0]).key);
  // The video whose file failed to load, until the student tries again.
  const [failed, setFailed] = useState(null);
  const current = videos.find((v) => v.key === chosen) || videos[0];
  const playable = current.status === "ready" && failed !== current.key;

  return (
    <div className={s.videos}>
      <figure className={s.stage}>
        <div className={s.frame}>
          {playable ? (
            <video
              key={current.url}
              className={s.video}
              src={current.url}
              controls
              playsInline
              preload="metadata"
              aria-label={`${KIND_LABEL[current.kind]}, level ${current.level}, ${current.name}`}
              onError={() => setFailed(current.key)}
            />
          ) : (
            <div className={s.cantPlay} role="alert">
              <h3 className={s.cantPlayHead}>This video can&apos;t play right now</h3>
              <p className={s.cantPlayLine}>It didn&apos;t load. Try again in a moment.</p>
              <button
                type="button"
                className={cx(ui.btn, ui.sm, ui.secondary, s.action)}
                onClick={() => {
                  setFailed(null);
                  onRefresh();
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
        <figcaption className={s.caption}>
          <span className={s.kind} data-kind={current.kind}>
            {KIND_LABEL[current.kind]}
          </span>
          Level {current.level} · {current.name}
        </figcaption>
      </figure>

      <ol className={s.levels} aria-label="Levels">
        {levels.map((l) => (
          <li key={l.level} className={cx(s.level, !l.videos.length && s.pending)}>
            <span className={s.levelN} aria-hidden="true">
              {l.level}
            </span>
            <span className={s.levelName}>
              <span className="rw-sr-only">Level {l.level}: </span>
              {l.name}
            </span>
            {l.videos.length ? (
              <span className={s.choices}>
                {l.videos.map((v) => {
                  const key = `${l.level}-${v.kind}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={s.choice}
                      aria-pressed={key === current.key}
                      aria-label={`${KIND_LABEL[v.kind]}, level ${l.level}, ${l.name}`}
                      onClick={() => setChosen(key)}
                    >
                      {KIND_LABEL[v.kind]}
                    </button>
                  );
                })}
              </span>
            ) : (
              <span className={s.soonTag}>Coming soon</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Moves to the practice player and puts keyboard focus there, so Tab carries on into its controls.
// The scroll is instant under reduced motion.
function PlayerLink({ playerId }) {
  function go(event) {
    const target = document.getElementById(playerId);
    if (!target) return;
    event.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: still ? "instant" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  return (
    <a href={`#${playerId}`} onClick={go} className={cx(ui.btn, ui.sm, ui.secondary, s.action)}>
      Go to practice player
      <span className={s.down} aria-hidden="true">
        <Icon name="arrow-left" size={14} />
      </span>
    </a>
  );
}
