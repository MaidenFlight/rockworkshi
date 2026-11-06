"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { metal } from "./mixer/styles";

// A reel-to-reel tape deck around the record key. The tape is the song: it runs whenever the song
// plays, at the song's speed, from the left reel to the right one, so the packs show how far in
// you are. Each reel turns as real tape would turn it, faster the less tape it holds. The meter
// shows the mic whenever it's open (listening): while you record, or while you check it.
const REELS = [
  { x: 84, y: 80 },
  { x: 276, y: 80 },
];
const ROLLERS = [
  { x: 24, y: 172 },
  { x: 336, y: 172 },
];
const FLANGE = 70;
const CORE = 18; // the hub the tape winds onto
const FULL = 60; // a full pack, just inside the windows' outer edge
const ROLLER = 7;
const TAPE_SPEED = 120; // drawing units of tape per second of song: a half-full reel turns about twice a second
const TAPE = "#4a3426"; // ferric oxide brown
const DASHES = [1, 13]; // faint marks on the tape, so you can see it move
const DASH_PERIOD = DASHES[0] + DASHES[1];
const VU = { x: 66, y: 78 }; // the needle's pivot, just below the meter's face
const VU_SWING = 42; // degrees either side of upright

// label is written on the take-up reel's sticker: the take's number or the name it was given.
export default function TapeDeck({ getPosition, position, duration, running, recording, listening = recording, level, label = "Take 1", children }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const nodes = useRef({ packs: [], rotors: [], tape: null, dash: null, needle: null });
  const motion = useRef({ angles: [0, 0], tape: 0, needle: -VU_SWING });
  const getRef = useRef(getPosition);
  useEffect(() => {
    getRef.current = getPosition;
  });

  // Stopped: draw where the song is, with the needle at rest.
  useLayoutEffect(() => {
    if (running || listening) return;
    motion.current.needle = -VU_SWING;
    paint(nodes.current, motion.current, position, duration);
  }, [running, listening, position, duration]);

  // Running: turn the reels by however far the song really moved since the last frame, so the
  // speed buttons, the count-in and pausing all show on the deck without being told about.
  useEffect(() => {
    if (!running && !listening) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const m = motion.current;
    let last = getRef.current();
    let then = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const p = getRef.current();
      const moved = p - last;
      const dt = Math.min(0.1, (now - then) / 1000);
      last = p;
      then = now;
      // A seek jumps the tape rather than winding it.
      if (!still && moved > 0 && moved < 0.5) {
        packsAt(p, duration).forEach((r, i) => {
          // Both reels turn anticlockwise in play.
          m.angles[i] = (m.angles[i] - ((TAPE_SPEED * moved) / r) * (180 / Math.PI)) % 360;
        });
        m.tape = (m.tape + TAPE_SPEED * moved) % (DASH_PERIOD * 100);
      }
      const target = listening ? vuAngle(levelToVu(level.current)) : -VU_SWING;
      m.needle += (target - m.needle) * (1 - Math.exp(-dt / 0.09)); // about a VU meter's 300 ms
      paint(nodes.current, m, p, duration);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, listening, duration, level]);

  return (
    <div style={{ ...metal, width: "100%", maxWidth: 440, boxSizing: "border-box", padding: "12px 14px 14px" }}>
      <svg viewBox="0 0 360 206" width="100%" style={{ display: "block" }} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--rw-chrome-hi)" />
            <stop offset="0.55" stopColor="var(--rw-chrome-mid)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--rw-chrome-hi) 70%, var(--rw-chrome-mid))" />
          </linearGradient>
        </defs>

        {REELS.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y})`}>
            {/* The back flange, seen through the windows, and the tape wound between. */}
            <circle r={FLANGE} fill="color-mix(in srgb, var(--rw-chrome-mid) 70%, var(--rw-chrome-lo))" />
            <circle ref={(el) => (nodes.current.packs[i] = el)} data-pack={i} fill={TAPE} stroke="color-mix(in srgb, #4a3426 75%, white)" strokeWidth={0.8} />
          </g>
        ))}

        <path ref={(el) => (nodes.current.tape = el)} fill="none" stroke={TAPE} strokeWidth={3} />
        <path ref={(el) => (nodes.current.dash = el)} data-tape="true" fill="none" stroke="color-mix(in srgb, #4a3426 72%, white)" strokeWidth={2} strokeDasharray={DASHES.join(" ")} />

        {REELS.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y})`}>
            <g ref={(el) => (nodes.current.rotors[i] = el)} data-reel={i}>
              <path d={FLANGE_PATH} fill={`url(#${id}-metal)`} fillRule="evenodd" stroke="var(--rw-chrome-lo)" strokeWidth={0.8} strokeLinejoin="round" />
              {[-30, 90, 210].map((a) => (
                <circle key={a} cx={30 * Math.cos((a * Math.PI) / 180)} cy={30 * Math.sin((a * Math.PI) / 180)} r={1.8} fill="var(--rw-chrome-lo)" />
              ))}
              {i === 1 && (
                <g data-reel-label={label}>
                  <rect x={-21} y={39} width={42} height={12} rx={1.5} fill="var(--rw-sand)" />
                  <text x={0} y={47.5} fontSize={7} fontWeight={700} textAnchor="middle" fill="var(--rw-orange-deep)">
                    {label.length > 13 ? `${label.slice(0, 12)}…` : label}
                  </text>
                </g>
              )}
              <circle r={16} fill="var(--rw-ink)" />
              <circle r={13.5} fill="none" stroke="color-mix(in srgb, var(--rw-ink) 60%, white)" strokeWidth={2} strokeDasharray="1.4 1.6" />
              {[90, 210, 330].map((a) => (
                <rect key={a} x={-2} y={-9} width={4} height={6} fill="var(--rw-chrome-mid)" transform={`rotate(${a})`} />
              ))}
              <circle r={3} fill="var(--rw-chrome-mid)" />
            </g>
          </g>
        ))}

        {/* The counter, and the lamp that lights while recording. */}
        <rect x={158} y={22} width={44} height={18} rx={2} fill="var(--rw-ink)" />
        <text x={180} y={35} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" letterSpacing={1} fill="var(--rw-chrome-hi)">
          {clock(position)}
        </text>
        {recording && <circle cx={180} cy={56} r={9} fill="var(--rw-flare)" opacity={0.3} />}
        <circle data-rec-lamp={recording ? "on" : "off"} cx={180} cy={56} r={4} fill={recording ? "var(--rw-flare)" : "color-mix(in srgb, var(--rw-orange) 25%, var(--rw-chrome-mid))"} />
        <text x={180} y={74} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--rw-meta)">
          Rec
        </text>

        {/* Guide rollers, the head cover, the heads, and the capstan with its pinch roller. */}
        {ROLLERS.map((r) => (
          <g key={r.x}>
            <circle cx={r.x} cy={r.y} r={ROLLER} fill={`url(#${id}-metal)`} stroke="var(--rw-chrome-lo)" strokeWidth={0.8} />
            <circle cx={r.x} cy={r.y} r={1.6} fill="var(--rw-chrome-lo)" />
          </g>
        ))}
        <rect x={128} y={150} width={104} height={22} rx={8} fill={`url(#${id}-metal)`} stroke="var(--rw-chrome-lo)" strokeWidth={0.8} />
        <text x={180} y={165} textAnchor="middle" fontSize={9} fontFamily="var(--rw-font-display)" fontWeight={800} fill="var(--rw-chrome-lo)">
          Rock Works
        </text>
        {[160, 176, 192].map((x) => (
          <rect key={x} x={x - 5.5} y={180.5} width={11} height={9} rx={2} fill="var(--rw-ink)" />
        ))}
        <circle cx={214} cy={171.5} r={6} fill="var(--rw-ink)" />
        <circle cx={214} cy={184} r={3} fill="var(--rw-chrome-mid)" stroke="var(--rw-chrome-lo)" strokeWidth={0.6} />
      </svg>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        <VuMeter id={id} needleRef={(el) => (nodes.current.needle = el)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
      </div>
    </div>
  );
}

// The record key, a brushed-metal key that stays down while recording.
export function deckKey(latched) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    padding: "0 18px",
    borderRadius: "var(--rw-radius-sm)",
    border: "1px solid var(--rw-chrome-lo)",
    background: latched
      ? "linear-gradient(180deg, var(--rw-chrome-mid), var(--rw-chrome-hi))"
      : "linear-gradient(180deg, var(--rw-chrome-hi), color-mix(in srgb, var(--rw-chrome-mid) 70%, var(--rw-chrome-hi)))",
    boxShadow: latched ? "inset 0 2px 4px rgba(12, 9, 16, 0.3)" : "0 2px 0 var(--rw-chrome-lo), inset 0 1px 0 var(--rw-chrome-hi)",
    transform: latched ? "translateY(2px)" : "none",
    color: "var(--rw-ink)",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
  };
}

function VuMeter({ id, needleRef }) {
  const at = (vu, r) => {
    const a = ((vuAngle(vu) - 90) * Math.PI) / 180;
    return [VU.x + r * Math.cos(a), VU.y + r * Math.sin(a)];
  };
  const arc = (from, to, r) => `M ${at(from, r).join(" ")} A ${r} ${r} 0 0 1 ${at(to, r).join(" ")}`;
  const labels = { [-20]: "20", [-10]: "10", [-5]: "5", [-3]: "3", 0: "0", 3: "3" };
  return (
    <svg viewBox="0 0 132 70" width={176} height={93} aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.95" r="0.8">
          <stop offset="0" stopColor="var(--rw-gold)" stopOpacity={0.55} />
          <stop offset="1" stopColor="var(--rw-gold)" stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${id}-face`}>
          <rect x={4} y={4} width={124} height={62} rx={2} />
        </clipPath>
      </defs>
      <rect width={132} height={70} rx={4} fill="var(--rw-ink-deep)" />
      <rect x={4} y={4} width={124} height={62} rx={2} fill="var(--rw-sand)" />
      <rect x={4} y={4} width={124} height={62} rx={2} fill={`url(#${id}-glow)`} />
      <path d={arc(-20, 0, 50)} fill="none" stroke="var(--rw-ink)" strokeWidth={0.8} />
      <path d={arc(0, 3, 50)} fill="none" stroke="var(--rw-orange)" strokeWidth={2.5} />
      {[-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3].map((vu) => {
        const [x1, y1] = at(vu, 50);
        const [x2, y2] = at(vu, labels[vu] ? 55 : 53);
        return <line key={vu} x1={x1} y1={y1} x2={x2} y2={y2} stroke={vu > 0 ? "var(--rw-orange)" : "var(--rw-ink)"} strokeWidth={0.8} />;
      })}
      {Object.entries(labels).map(([vu, text]) => {
        const [x, y] = at(Number(vu), 63);
        return (
          <text key={vu} x={x} y={y + 2} textAnchor="middle" fontSize={8} fontWeight={700} fill={Number(vu) > 0 ? "var(--rw-orange)" : "var(--rw-ink)"}>
            {text}
          </text>
        );
      })}
      <text x={VU.x} y={50} textAnchor="middle" fontSize={9} fontWeight={800} fill="var(--rw-ink)">
        VU
      </text>
      <text x={10} y={61} fontSize={8} fontWeight={700} fill="var(--rw-meta)">
        Mic
      </text>
      <g clipPath={`url(#${id}-face)`}>
        <g ref={needleRef} data-needle="true">
          <line x1={VU.x} y1={VU.y} x2={VU.x} y2={VU.y - 60} stroke="var(--rw-ink)" strokeWidth={1.2} />
        </g>
      </g>
    </svg>
  );
}

// The front flange: a disc with three windows onto the tape.
const FLANGE_PATH = (() => {
  const pt = (r, deg) => `${(r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
  let d = `M ${FLANGE} 0 A ${FLANGE} ${FLANGE} 0 1 1 ${-FLANGE} 0 A ${FLANGE} ${FLANGE} 0 1 1 ${FLANGE} 0 Z`;
  for (const mid of [-90, 30, 150]) {
    d += ` M ${pt(60, mid - 25)} A 60 60 0 0 1 ${pt(60, mid + 25)} L ${pt(25, mid + 25)} A 25 25 0 0 0 ${pt(25, mid - 25)} Z`;
  }
  return d;
})();

// How much tape each reel holds at a point in the song, as the radius of its pack.
function packsAt(position, duration) {
  const done = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const radius = (share) => Math.sqrt(CORE * CORE + (FULL * FULL - CORE * CORE) * share);
  return [radius(1 - done), radius(done)];
}

// The tape's path: off the outside of the left pack, round the left roller, past the heads, round
// the right roller and onto the outside of the right pack.
function tapePath(packs) {
  const [l1, l2] = tangent(REELS[0], packs[0], ROLLERS[0], ROLLER, -1);
  const [r1, r2] = tangent(REELS[1], packs[1], ROLLERS[1], ROLLER, 1);
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  return [
    `M ${f(l1)} L ${f(l2)}`,
    `A ${ROLLER} ${ROLLER} 0 0 0 ${ROLLERS[0].x} ${ROLLERS[0].y + ROLLER}`,
    `L ${ROLLERS[1].x} ${ROLLERS[1].y + ROLLER}`,
    `A ${ROLLER} ${ROLLER} 0 0 0 ${f(r2)} L ${f(r1)}`,
  ].join(" ");
}

// The outer tangent between two circles on one side (-1 left, 1 right), as its two touching points.
function tangent(a, ra, b, rb, side) {
  const base = Math.atan2(b.y - a.y, b.x - a.x);
  const turn = Math.acos((ra - rb) / Math.hypot(b.x - a.x, b.y - a.y));
  const normals = [base + turn, base - turn].map((t) => [Math.cos(t), Math.sin(t)]);
  const [nx, ny] = normals.sort((p, q) => side * (q[0] - p[0]))[0];
  return [
    [a.x + ra * nx, a.y + ra * ny],
    [b.x + rb * nx, b.y + rb * ny],
  ];
}

function paint(n, m, position, duration) {
  const packs = packsAt(position, duration);
  packs.forEach((r, i) => {
    n.packs[i]?.setAttribute("r", r.toFixed(2));
    n.rotors[i]?.setAttribute("transform", `rotate(${m.angles[i].toFixed(2)})`);
  });
  const d = tapePath(packs);
  n.tape?.setAttribute("d", d);
  n.dash?.setAttribute("d", d);
  n.dash?.setAttribute("stroke-dashoffset", (-m.tape).toFixed(2));
  n.needle?.setAttribute("transform", `rotate(${m.needle.toFixed(2)} ${VU.x} ${VU.y})`);
}

// A VU meter reads 0 at -18 dBFS, and its scale is linear in voltage, so the low end is cramped.
function levelToVu(rms) {
  return Math.min(3, Math.max(-20, 20 * Math.log10(Math.max(rms, 1e-5)) + 18));
}

function vuAngle(vu) {
  const v = (x) => 10 ** (x / 20);
  return -VU_SWING + 2 * VU_SWING * ((v(vu) - v(-20)) / (v(3) - v(-20)));
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
