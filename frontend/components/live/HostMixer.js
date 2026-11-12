"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import Meter from "@/components/member/player/Meter";
import LevelSlider from "@/components/member/mixer/LevelSlider";
import { soundName } from "@/lib/live/protocol";
import { PICTURE_QUALITIES, PICTURE_SOURCES } from "@/lib/live/video";
import VideoTile from "./VideoTile";
import s from "./live.module.css";

const TEXT_INPUTS = new Set(["text", "search", "email", "number", "tel", "url", "password"]);

function isTyping(el) {
  if (!el?.tagName) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && TEXT_INPUTS.has((el.type || "text").toLowerCase());
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// A rate in kilobits a second, as gigabytes over an hour: what one kid receives in a session.
function gbPerHour(kbps) {
  return ((kbps * 1000 * 3600) / 8 / 1e9).toFixed(2);
}

function pictureNote(state) {
  const quality = PICTURE_QUALITIES.find((q) => q.id === state.quality);
  const cap = quality ? ` At ${quality.short} it can use up to ${(quality.topKbps / 1000).toFixed(1)} Mbps.` : "";
  if (state.pictureKbps > 0) {
    return `Each kid watching you full size gets about ${(state.pictureKbps / 1000).toFixed(2)} Mbps of picture, roughly ${gbPerHour(state.pictureKbps)} GB an hour.${cap}`;
  }
  return `Your picture isn't sending anything yet; it starts once a kid is watching.${cap}`;
}

function roundTrip(kid, bpm) {
  if (kid.rtt === null) return kid.rttNote || "Not measured";
  const beats = kid.rtt / (60 / bpm);
  return `${kid.rtt.toFixed(2)} s, ${beats.toFixed(1)} of a beat at ${bpm} BPM`;
}

function KidStrip({ session, kid, number, state }) {
  const getNodes = useCallback(() => [session.getKidMeter(kid.identity)].filter(Boolean), [session, kid.identity]);
  const listening = state.listening === kid.identity;
  const onStage = state.stage === kid.identity;
  return (
    <li className={s.strip} data-open={listening || onStage ? "true" : undefined} data-stage={onStage ? "true" : undefined}>
      <VideoTile track={kid.video} placeholder="No picture" />
      <div className={s.stripHead}>
        {number <= 9 && <span className={s.key} aria-hidden="true">{number}</span>}
        <span className={s.kidName}>{kid.name}</span>
        <span className={s.kidSound}>{kid.hasAudio ? soundName(kid.sound) : "No sound yet"}</span>
      </div>
      <Meter getNodes={getNodes} active vertical={false} length={400} thickness={8} fluid title={`${kid.name}'s level`} />
      <div className={s.stripButtons}>
        <button
          type="button"
          className="rw-btn"
          data-kind="listen"
          aria-pressed={listening}
          onClick={() => session.listenTo(listening ? "" : kid.identity)}
        >
          {listening ? "Listening" : "Listen"}
        </button>
        <button type="button" className="rw-btn" data-kind="stage" aria-pressed={onStage} onClick={() => session.toggleStage(kid.identity)}>
          {onStage ? "On stage" : "Put on stage"}
        </button>
      </div>
      <LevelSlider
        label="Volume"
        labelWidth={64}
        value={Math.round(kid.volume * 100)}
        onChange={(v) => session.setVolume(kid.identity, v / 100)}
      />
      <div className={s.delayRow}>
        <span className={s.label}>Round trip</span>
        <span className={s.delayValue} aria-live="polite">
          {state.measuring === kid.identity ? "Measuring…" : roundTrip(kid, state.bpm)}
        </span>
        <button
          type="button"
          className="rw-btn rw-btn-small"
          onClick={() => session.measure(kid.identity)}
          disabled={Boolean(state.measuring) || !kid.hasAudio}
        >
          Measure
        </button>
      </div>
    </li>
  );
}

// Brian's screen: what the mixer sends (picture and sound), and a strip per kid with their
// picture, a meter, Listen, Put on stage, a volume and the delay test. Number keys pick a kid,
// 0 or Escape picks nobody.
export default function HostMixer({ session }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const getSendNodes = useCallback(() => [session.getSendMeter()].filter(Boolean), [session]);

  useEffect(() => {
    function onKey(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTyping(document.activeElement)) return;
      if (/^[1-9]$/.test(event.key)) {
        session.listenToNumber(Number(event.key));
        event.preventDefault();
      } else if (event.key === "0" || event.key === "Escape") {
        session.listenTo("");
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  const nameOf = (identity) => state.kids.find((k) => k.identity === identity)?.name ?? "";
  const heard = [...new Set([state.listening, state.stage].filter(Boolean))].map(nameOf).filter(Boolean);
  const count = state.kids.length;

  return (
    <section className={s.console} aria-label="Brian's mixer">
      <div className={s.statusRow}>
        <span className={s.lamp} data-on="true">
          Live
        </span>
        <span className={s.meta}>
          {state.name} · {count === 1 ? "1 kid" : `${count} kids`} in the room
        </span>
        <button type="button" className={`rw-btn rw-btn-small ${s.push}`} onClick={() => session.leave()}>
          Leave
        </button>
      </div>

      <div className={s.sendRow} role="group" aria-label="What you send">
        <VideoTile track={state.selfVideo} mirror={state.selfMirror} size="self" placeholder="No picture" label="You" />
        <div className={s.sendControls}>
          <div className={s.pictureRow}>
            <span className={s.label}>You send</span>
            <button type="button" className="rw-toggle" aria-pressed={state.micOn} onClick={() => session.setMic(!state.micOn)}>
              Mic
            </button>
            <button type="button" className="rw-toggle" aria-pressed={state.clickOn} onClick={() => session.setClick(!state.clickOn)}>
              Click
            </button>
            <span className={s.tempo}>
              <button type="button" className="rw-btn rw-btn-small" aria-label="Slower" onClick={() => session.setBpm(state.bpm - 5)}>
                −
              </button>
              <output aria-label="Tempo">{state.bpm} BPM</output>
              <button type="button" className="rw-btn rw-btn-small" aria-label="Faster" onClick={() => session.setBpm(state.bpm + 5)}>
                +
              </button>
            </span>
          </div>
          <div className={s.pictureRow}>
            <div className="rw-seg" role="group" aria-label="Your picture">
              {PICTURE_SOURCES.map((option) => (
                <button key={option.id} type="button" aria-pressed={state.picture === option.id} onClick={() => session.setPicture(option.id)}>
                  {option.short}
                </button>
              ))}
            </div>
            <div className="rw-seg" role="group" aria-label="Picture quality">
              {PICTURE_QUALITIES.map((quality) => (
                <button
                  key={quality.id}
                  type="button"
                  aria-pressed={state.quality === quality.id}
                  disabled={state.picture === "off"}
                  onClick={() => session.setQuality(quality.id)}
                >
                  {quality.short}
                </button>
              ))}
            </div>
            <span className={s.sendMeter}>
              <Meter getNodes={getSendNodes} active vertical={false} length={400} thickness={8} fluid title="What you send" />
            </span>
          </div>
        </div>
      </div>
      {state.picture !== "off" && (
        <p className={s.meta} aria-live="polite">
          {pictureNote(state)}
        </p>
      )}
      {state.micError && (
        <p className={s.error} role="alert">
          {state.micError}
        </p>
      )}
      {state.pictureError && (
        <p className={s.error} role="alert">
          {state.pictureError}
        </p>
      )}

      <div className={s.sendRow} role="group" aria-label="Song">
        <label className={s.songPick}>
          <span className={s.label}>Song</span>
          <select
            className={s.select}
            value={state.song}
            onChange={(e) => session.chooseSong(e.target.value)}
            disabled={!state.songs.length}
          >
            <option value="">{state.songs.length ? "Choose a song…" : state.songsNote || "No songs yet"}</option>
            {state.songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </label>
        <div className={s.transport}>
          <button
            type="button"
            className="rw-btn rw-btn-small"
            onClick={() => (state.songPlaying ? session.pauseSong() : session.playSong())}
            disabled={!state.song}
          >
            {state.songPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className="rw-btn rw-btn-small" onClick={() => session.stopSong()} disabled={!state.song}>
            Stop
          </button>
          <input
            type="range"
            className="rw-range"
            min={0}
            max={Math.max(1, state.songLength)}
            step={0.5}
            value={Math.min(state.songTime, state.songLength || 0)}
            onChange={(e) => session.seekSong(Number(e.target.value))}
            disabled={!state.song || !state.songLength}
            aria-label="Place in the song"
            aria-valuetext={`${clock(state.songTime)} of ${clock(state.songLength)}`}
            style={{
              background: `linear-gradient(90deg, var(--rw-gold) ${(state.songLength ? state.songTime / state.songLength : 0) * 100}%, var(--rw-console-well) 0)`,
            }}
          />
          <output className={s.clock}>
            {clock(state.songTime)} / {clock(state.songLength)}
          </output>
        </div>
        <div className={s.songLevel}>
          <LevelSlider label="Level" labelWidth={44} value={Math.round(state.songVolume * 100)} onChange={(v) => session.setSongVolume(v / 100)} />
        </div>
      </div>
      {state.songError && (
        <p className={s.error} role="alert">
          {state.songError}
        </p>
      )}

      <div className={s.mixHead}>
        <p className={s.hearing} aria-live="polite">
          You&apos;re hearing: <strong>{heard.length ? heard.join(" and ") : "nobody"}</strong>
        </p>
        <button type="button" className="rw-btn rw-btn-small" onClick={() => session.listenTo("")} disabled={!state.listening}>
          Nobody (0)
        </button>
        <button
          type="button"
          className={`rw-toggle ${s.push}`}
          aria-pressed={state.gallery}
          onClick={() => session.setGallery(!state.gallery)}
        >
          Kids see each other
        </button>
        <button type="button" className="rw-toggle" aria-pressed={state.withMusic} onClick={() => session.setWithMusic(!state.withMusic)}>
          Hear them with the music
        </button>
      </div>

      {count === 0 ? (
        <p className={s.empty}>No kids yet. Open this page in another tab and choose Be a kid.</p>
      ) : (
        <ol className={s.strips}>
          {state.kids.map((kid, i) => (
            <KidStrip key={kid.identity} session={session} kid={kid} number={i + 1} state={state} />
          ))}
        </ol>
      )}

      <p className={s.meta}>
        Press 1 to 9 to hear a kid, 0 for nobody. Every kid sees and hears you. Kids see each other while Kids see each
        other is on, but never hear each other: each kid&apos;s sound comes only to you, unless they&apos;re on stage. Play a song and the kids hear it along with your mic; playing turns the
        click off, and switching your Mic off sends the song by itself. With the music on, the kid you hear sends back
        what they hear too, so their voice arrives in time with the song or click, and your own copy goes quiet. Round
        trip is Brian to the kid and back, measured with a beep; real kids add a little for their headphones and mic.
      </p>
    </section>
  );
}
