"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HostSession } from "@/lib/live/hostSession";
import { KidSession } from "@/lib/live/kidSession";
import { KID_SOUNDS } from "@/lib/live/protocol";
import { PICTURE_SOURCES } from "@/lib/live/video";
import HostMixer from "./HostMixer";
import KidView from "./KidView";
import s from "./live.module.css";

const NO_SESSION = () => () => {};
const NOTHING = () => null;
const COUNTER_KEY = "rw-live-test-kids";

// Each new kid tab gets the next name and the next sound, so someone testing alone can open a
// few tabs and tell them apart without changing anything: Kid 1 plays the melody, Kid 2 the hum,
// Kid 3 the drums, Kid 4 uses the mic.
function nextKidDefaults() {
  let n = 1;
  try {
    n = Number(localStorage.getItem(COUNTER_KEY) || 0) + 1;
    localStorage.setItem(COUNTER_KEY, String(n));
  } catch {
    // private window or blocked storage: every tab starts at Kid 1
  }
  const order = ["melody", "hum", "drums", "mic"];
  return { name: `Kid ${n}`, sound: order[(n - 1) % order.length] };
}

export default function LiveRoomTest() {
  const [config, setConfig] = useState(null);
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({ name: "", sound: "melody", picture: "test", passcode: "" });
  const [session, setSession] = useState(null);
  const snap = useSyncExternalStore(
    session ? session.subscribe : NO_SESSION,
    session ? session.getSnapshot : NOTHING,
    NOTHING,
  );

  useEffect(() => {
    let stale = false;
    fetch("/api/live-test/token", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => !stale && setConfig(data))
      .catch(() => !stale && setConfig({ enabled: false }));
    return () => {
      stale = true;
    };
  }, []);

  // Leaving the page, or starting over, takes this tab out of the room.
  useEffect(() => () => void session?.leave(), [session]);

  function choose(next) {
    // Opening the mixer starts the kid count again, so the tabs opened after it are Kid 1, 2, 3.
    if (next === "host") {
      try {
        localStorage.setItem(COUNTER_KEY, "0");
      } catch {
        // blocked storage: the count just carries on
      }
    }
    // Worked out here, not inside the state update: React may run an update twice in
    // development, which would count two kids.
    // Brian shows the camera; kid tabs show test pictures, since one person testing alone has
    // one camera and can tell named test pictures apart at a glance.
    const defaults = next === "host" ? { name: "Brian", picture: "camera" } : { ...nextKidDefaults(), picture: "test" };
    setRole(next);
    setForm((f) => ({ ...f, ...defaults }));
  }

  function join(event) {
    event.preventDefault();
    const next = role === "host" ? new HostSession() : new KidSession();
    setSession(next);
    // In development, the console can reach the session to check levels and subscriptions.
    if (process.env.NODE_ENV !== "production") window.__liveTest = next;
    // Straight from the click, so the browser lets the page make sound.
    next.join({ name: form.name, sound: form.sound, picture: form.picture, passcode: form.passcode });
  }

  function startOver() {
    setSession(null);
    setRole(null);
  }

  const live = snap?.status === "connected";
  const busy = snap?.status === "connecting";

  return (
    <div className={s.page}>
      <p className={s.eyebrow}>Live sing-along</p>
      <h1 className={s.title}>Live room test</h1>
      {!live && (
        <>
          <p className={s.lead}>
            Try the mixer on your own. One tab is Brian&apos;s mixer and the others pretend to be kids. The mixer plays
            only the kid you pick. Kids see and hear Brian and never hear each other; Brian can also let them see each
            other like a video call.
          </p>
          <ol className={s.steps}>
            <li>In this tab, choose Be Brian.</li>
            <li>
              Open this page in two or three more tabs and choose Be a kid in each. Each one gets its own test sound and
              test picture.
            </li>
            <li>Back in Brian&apos;s tab, press 1, 2, 3 to hear each kid, and 0 for nobody.</li>
          </ol>
        </>
      )}

      {!config ? (
        <p className={s.lead}>Checking the test room…</p>
      ) : !config.enabled ? (
        <div className={s.console}>
          <p className={s.error} role="alert">The live room test is switched off on this site.</p>
        </div>
      ) : live && role === "host" ? (
        <HostMixer session={session} />
      ) : live ? (
        <KidView session={session} />
      ) : !role ? (
        <div className={s.console}>
          {snap?.status === "ended" && snap.error && <p className={s.error} role="alert">{snap.error}</p>}
          <div className={s.roles}>
            <button type="button" className={s.role} onClick={() => choose("host")}>
              <span className={s.roleName}>Be Brian</span>
              <span className={s.roleText}>The mixer. Pick which kid you hear, put a kid on stage, time the delay.</span>
            </button>
            <button type="button" className={s.role} onClick={() => choose("kid")}>
              <span className={s.roleName}>Be a kid</span>
              <span className={s.roleText}>
                See and hear Brian. Send your mic and camera, or test ones so you can tell tabs apart.
              </span>
            </button>
          </div>
        </div>
      ) : (
        <form className={`${s.console} ${s.form}`} onSubmit={join}>
          <h2 className={s.panelTitle}>{role === "host" ? "Open the mixer" : "Join as a kid"}</h2>
          {snap?.error && <p className={s.error} role="alert">{snap.error}</p>}
          <label className={s.field}>
            <span className={s.fieldLabel}>Name</span>
            <input
              className={s.input}
              value={form.name}
              maxLength={32}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="off"
            />
          </label>
          {role === "kid" && (
            <fieldset className={s.choices}>
              <legend>What this kid sends</legend>
              {KID_SOUNDS.map((option) => (
                <label key={option.id} className={s.choice}>
                  <input
                    type="radio"
                    name="sound"
                    value={option.id}
                    checked={form.sound === option.id}
                    onChange={() => setForm({ ...form, sound: option.id })}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          )}
          <fieldset className={s.choices}>
            <legend>{role === "host" ? "What Brian shows" : "What this kid shows"}</legend>
            {PICTURE_SOURCES.map((option) => (
              <label key={option.id} className={s.choice}>
                <input
                  type="radio"
                  name="picture"
                  value={option.id}
                  checked={form.picture === option.id}
                  onChange={() => setForm({ ...form, picture: option.id })}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {config.needsPasscode && (
            <label className={s.field}>
              <span className={s.fieldLabel}>Passcode</span>
              <input
                className={s.input}
                value={form.passcode}
                onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                autoComplete="off"
              />
            </label>
          )}
          <p className={s.meta}>
            Wear headphones. For singing, the browser&apos;s echo cancelling is off, so sound from speakers would go
            straight back into the mic.
          </p>
          <div className={s.actions}>
            <button type="submit" className="rw-btn rw-btn-primary" disabled={busy}>
              {busy ? "Joining…" : role === "host" ? "Open the mixer" : "Join"}
            </button>
            <button type="button" className="rw-btn rw-btn-quiet" onClick={startOver} disabled={busy}>
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
