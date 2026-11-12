"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HostSession } from "@/lib/live/hostSession";
import { KidSession } from "@/lib/live/kidSession";
import HostMixer from "./HostMixer";
import KidView from "./KidView";
import s from "./live.module.css";

const NO_SESSION = () => () => {};
const NOTHING = () => null;

// A real meeting's room: the host's mixer or a student's view, joined with a pass from the site.
// Joining is a click, because the browser only lets a page start sound from one. The host sends the
// camera; a student sends their camera and microphone.
export default function MeetingRoom({ role, name, getPass, joinLabel, intro, onLeft, extra }) {
  const [session, setSession] = useState(null);
  const snap = useSyncExternalStore(session ? session.subscribe : NO_SESSION, session ? session.getSnapshot : NOTHING, NOTHING);

  useEffect(() => () => void session?.leave(), [session]);

  useEffect(() => {
    if (snap?.status === "ended" || snap?.status === "error") onLeft?.(snap);
  }, [snap?.status, snap, onLeft]);

  function join() {
    const next = role === "host" ? new HostSession() : new KidSession();
    setSession(next);
    if (process.env.NODE_ENV !== "production") window.__liveTest = next;
    next.join({ name, picture: "camera", sound: "mic", getPass });
  }

  if (snap?.status === "connected") {
    return (
      <>
        {extra?.(session)}
        {role === "host" ? <HostMixer session={session} /> : <KidView session={session} meeting />}
      </>
    );
  }

  const busy = snap?.status === "connecting";
  return (
    <div className={s.console}>
      {snap?.error && (
        <p className={s.error} role="alert">
          {snap.error}
        </p>
      )}
      {snap?.status === "ended" && !snap.error && <p className={s.meta}>You left the meeting.</p>}
      {intro && <p className={s.meta}>{intro}</p>}
      <button
        type="button"
        className="rw-btn"
        // A fresh session each time (one that ended can't join again), straight from the click.
        onClick={join}
        disabled={busy}
      >
        {busy ? "Joining…" : joinLabel}
      </button>
      <p className={s.meta}>Wear wired headphones: sound from speakers goes straight back into your microphone.</p>
    </div>
  );
}
