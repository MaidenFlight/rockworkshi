"use client";

import { useCallback, useSyncExternalStore } from "react";
import Meter from "@/components/member/player/Meter";
import { KID_SOUNDS } from "@/lib/live/protocol";
import { PICTURE_SOURCES } from "@/lib/live/video";
import VideoTile from "./VideoTile";
import s from "./live.module.css";

// A kid's screen, laid out like a video call: Brian's picture big (and the kid on stage
// alongside), everyone else in a gallery, whether Brian is listening, who they can hear, and what
// they send. Sound and picture can change while connected.
// meeting: a real meeting, where the sound is the microphone and there are no test sounds or
// test-only advice.
export default function KidView({ session, meeting = false }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const getNodes = useCallback(() => [session.getSendMeter()].filter(Boolean), [session]);
  const brian = state.hostName;

  return (
    <section className={s.console} aria-label={`${state.name}'s page`}>
      <div className={s.statusRow}>
        <span className={s.lamp} data-on="true">
          In the room
        </span>
        <span className={s.meta}>{state.name}</span>
        <button type="button" className={`rw-btn rw-btn-small ${s.push}`} onClick={() => session.leave()}>
          Leave
        </button>
      </div>

      <p className={s.big} aria-live="polite">
        {state.hostHere ? `You can hear ${brian}` : "Waiting for Brian to open the mixer"}
      </p>

      <div className={s.screens} data-two={state.stageName ? "true" : undefined}>
        <VideoTile
          track={state.brianVideo}
          label={state.hostHere ? brian : null}
          size="screen"
          placeholder={state.hostHere ? `${brian}'s picture is off` : "Brian isn't here yet"}
        />
        {state.stageName && (
          <VideoTile track={state.stageVideo} label={`${state.stageName}, on stage`} size="screen" placeholder={`${state.stageName} has no picture`} />
        )}
      </div>

      <section className={s.galleryWrap} aria-label="Everyone in the room">
        <span className={s.label}>In the room</span>
        <div className={s.gallery}>
          <VideoTile track={state.selfVideo} mirror={state.selfMirror} label="You" size="gallery" placeholder="Your picture is off" />
          {state.gallery.map((kid) => (
            <VideoTile key={kid.identity} track={kid.video} label={kid.name} size="gallery" placeholder={`${kid.name} has no picture`} />
          ))}
        </div>
        <p className={s.meta}>
          {state.galleryOn
            ? `You can see the other kids, but you only hear ${brian} and whoever is on stage.`
            : `Only ${brian} sees everyone's pictures right now.`}
        </p>
      </section>

      <ul className={s.lamps} aria-live="polite">
        <li className={s.lamp} data-tone="gold" data-on={state.heardByBrian}>
          {brian} is listening to you
        </li>
        <li className={s.lamp} data-tone="flare" data-on={state.onStage}>
          On stage: everyone can hear you
        </li>
        <li className={s.lamp} data-on={state.sendingBack}>
          {state.measuring ? `${brian} is timing the delay: you'll hear beeps` : `Sending the music back to ${brian}`}
        </li>
      </ul>

      <p className={s.meta}>
        You can hear: {state.hearing.length ? state.hearing.join(", ") : "nobody yet"}
        {state.stageName ? ` (${state.stageName} is on stage)` : ""}
      </p>

      <div className={s.sendBox}>
        <span className={s.label}>You send</span>
        <div className={s.pictureRow}>
          <div className="rw-seg" role="group" aria-label="Your picture">
            {PICTURE_SOURCES.map((option) => (
              <button key={option.id} type="button" aria-pressed={state.picture === option.id} onClick={() => session.setPicture(option.id)}>
                {option.short}
              </button>
            ))}
          </div>
        </div>
        {state.pictureError && (
          <p className={s.error} role="alert">
            {state.pictureError}
          </p>
        )}
        {!meeting && (
          <div className={`rw-seg ${s.segWrap}`} role="group" aria-label="Your sound">
            {KID_SOUNDS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={state.sound === option.id}
                onClick={() => session.setSound(option.id)}
              >
                {option.short}
              </button>
            ))}
          </div>
        )}
        <Meter getNodes={getNodes} active vertical={false} length={400} thickness={8} fluid title="What you send" />
        {state.micError && (
          <p className={s.error} role="alert">
            {state.micError}
          </p>
        )}
      </div>

      <div className={s.statusRow}>
        <button type="button" className="rw-toggle" aria-pressed={state.speakerOn} onClick={() => session.setSpeaker(!state.speakerOn)}>
          Sound in this tab
        </button>
        {!meeting && <span className={s.meta}>Testing alone? Turn this off in all but one kid tab, or the click plays several times.</span>}
      </div>
    </section>
  );
}
