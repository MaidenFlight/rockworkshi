"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { nextEnrolmentStep } from "@/lib/auth/enrolment";
import T from "@/components/T";
import { StageDefs, Scenery, DrumKit, Guitar, Bass, Ukulele, Keys, Mic } from "./StageArt";
import styles from "./StageSet.module.css";

// The stage is drawn on a 720 x 840 board and everything is placed in those units, then turned
// into percentages, so the whole picture scales as one.
const W = 720;
const H = 840;
// The lamps hang out of sight, well above the top of the picture.
const RIG = -60;

// Left to right, which is also the order the keyboard walks them. Three depths. At the front,
// nearest and in shadow: the guitar and the bass to the left, the mic and the ukulele to the
// right, in two loose groups with the kit open between them. In the middle the kit, on its riser
// under the one strong lamp. At the back, small, dim and a touch out of focus: the stage piano
// and the amps. Nothing is spaced evenly or lit the same.
//   cx, foot: where the instrument stands · w: its width · ratio: the drawing's own width / height
//   rest: how much light it sits in · soft: how far out of focus, in px · tag: where its name
//   tag hangs, across its width
//   lamp, tilt, spread, reach: its light · level: how bright that light rests
//   pool: [centre x, y, width] of the light on the floor · delay: when it comes up in the opening
const CAST = [
  {
    key: "guitar", name: "Guitar", instrument: "Guitar", Art: Guitar,
    cx: 74, foot: 810, w: 128, ratio: 140 / 346, z: 7, rest: 0.84, edge: "start",
    lamp: 22, tilt: -4.4, spread: 11, reach: 880, level: 0.6, pool: [78, 800, 220], delay: 0.9,
  },
  {
    key: "bass", name: "Bass", instrument: "Bass", Art: Bass,
    cx: 158, foot: 772, w: 100, ratio: 136 / 388, z: 6, rest: 0.66,
    lamp: 96, tilt: -5.2, spread: 9, reach: 850, level: 0.26, pool: [158, 766, 180], delay: 1.15,
  },
  {
    key: "drums", name: "Drums", instrument: "Drums", Art: DrumKit,
    cx: 350, foot: 636, w: 404, ratio: 500 / 340, z: 3, rest: 1, tag: 58,
    lamp: 350, tilt: 1.5, spread: 21, reach: 800, level: 1, pool: [350, 682, 420], delay: 0.3,
  },
  {
    key: "voice", name: "Voice", instrument: "Voice", Art: Mic,
    cx: 446, foot: 786, w: 84, ratio: 84 / 360, z: 7, rest: 0.84,
    lamp: 410, tilt: -2.2, spread: 5, reach: 860, level: 0.28, pool: [448, 780, 110], delay: 1.9,
  },
  {
    key: "ukulele", name: "Ukulele", instrument: "Ukulele", Art: Ukulele,
    cx: 518, foot: 808, w: 86, ratio: 100 / 236, z: 7, rest: 0.94,
    lamp: 604, tilt: 6.2, spread: 9, reach: 890, level: 0.52, pool: [518, 800, 180], delay: 1.4,
  },
  {
    key: "keys", name: "Keys", instrument: "Piano", Art: Keys,
    cx: 598, foot: 672, w: 240, ratio: 460 / 384, z: 2, rest: 0.68, soft: 0.4, edge: "end",
    lamp: 764, tilt: 15.6, spread: 9, reach: 700, level: 0.26, pool: [598, 666, 250], delay: 1.65,
  },
];

const pct = (n, of) => `${Math.round((n / of) * 10000) / 100}%`;

export default function StageSet() {
  const { user, isLoading } = useAuth();
  const enrolled = !isLoading && user?.emailVerified && user?.profileComplete && user?.paymentComplete;
  const pending = !isLoading && user ? nextEnrolmentStep(user) : null;

  const root = useRef(null);
  const touched = useRef(false);
  const [chosen, setChosen] = useState(null);

  // The haze only drifts while the stage is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.removeAttribute("data-offstage");
      else el.setAttribute("data-offstage", "");
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // A chosen instrument lets go when the visitor taps anywhere else.
  useEffect(() => {
    if (!chosen) return undefined;
    const away = (e) => {
      if (!e.target.closest?.("[data-stage-instrument]")) setChosen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [chosen]);

  return (
    <div className={styles.set} ref={root}>
      <StageDefs />
      <p className={styles.hint}>
        <T k="home.stage.explore">Explore the instruments</T>
      </p>

      <div className={styles.scene} role="group" aria-label="The instruments on stage">
        <span className={styles.wash} aria-hidden="true" />
        <Scenery className={styles.scenery} />

        <div className={styles.lights} aria-hidden="true">
          {CAST.map((c) => (
            <span
              key={c.key}
              className={styles.beam}
              data-light={c.key}
              style={{
                left: pct(c.lamp, W),
                top: pct(RIG, H),
                // Wide enough for the beam's soft edge as well as its core.
                width: pct(2 * c.reach * Math.tan((c.spread * 1.9 * Math.PI) / 360) + 40, W),
                height: pct(c.reach, H),
                "--tilt": `${c.tilt}deg`,
                "--spread": `${c.spread}deg`,
                "--level": c.level,
                "--delay": `${c.delay}s`,
              }}
            />
          ))}
          {CAST.map((c) => (
            <span
              key={c.key}
              className={styles.pool}
              data-light={c.key}
              style={{
                left: pct(c.pool[0] - c.pool[2] / 2, W),
                top: pct(c.pool[1] - c.pool[2] * 0.11, H),
                width: pct(c.pool[2], W),
                height: pct(c.pool[2] * 0.22, H),
                "--level": c.level,
                "--delay": `${c.delay}s`,
              }}
            />
          ))}
        </div>
        <span className={styles.smoke} aria-hidden="true" />
        <span className={styles.haze} aria-hidden="true" />

        {CAST.map((c) => {
          const action = enrolled ? "Open practice library" : pending ? "Continue signup" : `Start with ${c.instrument.toLowerCase()}`;
          const href = enrolled ? "/member/library" : pending || `/signup?instrument=${encodeURIComponent(c.instrument)}`;
          return (
            <Link
              key={c.key}
              href={href}
              prefetch={false}
              className={styles.player}
              data-stage-instrument={c.key}
              data-on={chosen === c.key || undefined}
              data-edge={c.edge}
              style={{
                left: pct(c.cx - c.w / 2, W),
                bottom: pct(H - c.foot, H),
                width: pct(c.w, W),
                aspectRatio: String(c.ratio),
                "--z": c.z,
                "--rest": c.rest,
                "--soft": `${c.soft ?? 0}px`,
                "--tag": `${c.tag ?? 50}%`,
                "--delay": `${c.delay}s`,
              }}
              onPointerDown={(e) => {
                touched.current = e.pointerType === "touch";
              }}
              onClick={(e) => {
                // A finger has no hover, so its first tap lights the instrument and shows its name;
                // the second tap follows the link. A mouse or a keyboard goes straight there.
                if (touched.current && chosen !== c.key) {
                  e.preventDefault();
                  setChosen(c.key);
                }
                touched.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setChosen(null);
                  e.currentTarget.blur();
                }
              }}
            >
              <span className={styles.art}>
                <c.Art />
              </span>
              <span className={styles.plaque}>
                <span className={styles.name}>{c.name}</span>{" "}
                <span className={styles.go}>
                  {action} <span aria-hidden="true">&rarr;</span>
                </span>
              </span>
            </Link>
          );
        })}

        <span className={styles.bloom} aria-hidden="true" />
        <span className={styles.corners} aria-hidden="true" />
        <span className={styles.grain} aria-hidden="true" />
      </div>
    </div>
  );
}
