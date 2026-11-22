// The stage's drawings: six instruments and the backline behind them.
//
// Each instrument is its own SVG, so the stage can light, dim and focus them one at a time. They
// share one set of gradients (StageDefs), drawn once. Every instrument is generic: drawn in the
// design language of the classics (a carved single-cut guitar, a long-scale bass, a cutaway
// ukulele, an 88-key stage piano, a five-piece kit) at real proportions, with frets at their true
// spacing, and with no maker's name, logo or model text anywhere. The one mark on stage is the
// school's own, on the kick drum, where a band puts its name.
//
// The finishes are the paint on the objects (a honey burst, ocean teal, cherry, oxblood shells,
// aged bronze), so they are written out here and kept dark and matte: the stage lights them, and
// that light is CSS built from the site's tokens. The stage only exists in the Silkie world.

import RockWorksIcon from "@/components/RockWorksIcon";

const svgProps = { "aria-hidden": true, focusable: "false" };

// Coordinates worked out in code are rounded, so the server and every browser print the same path.
const r2 = (n) => Math.round(n * 100) / 100;

function Stop({ o, c, a }) {
  return <stop offset={o} style={{ stopColor: c, stopOpacity: a }} />;
}

// A chrome or steel tube at an angle: a body stroke with a thin highlight riding along it.
function Tube({ d, w = 3, dark = false }) {
  return (
    <>
      <path d={d} fill="none" stroke={dark ? "#050407" : "#24272c"} strokeWidth={w} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={dark ? "#4a4653" : "#b4b9c0"}
        strokeWidth={r2(w * 0.26)}
        strokeLinecap="round"
        transform={`translate(${r2(-w * 0.18)} 0)`}
      />
    </>
  );
}

// The soft dark patch where something meets the floor.
function Contact({ cx, cy, rx, ry, a = 1 }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#rws-shadow)" opacity={a} />;
}

/* ------------------------------------------------------------------ shared gradients */

export function StageDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} {...svgProps}>
      <defs>
        <radialGradient id="rws-shadow">
          <Stop o="0" c="#000" a="0.85" />
          <Stop o="0.55" c="#000" a="0.45" />
          <Stop o="1" c="#000" a="0" />
        </radialGradient>
        {/* A soft sheen, for lacquer and coated heads. */}
        <radialGradient id="rws-sheen">
          <Stop o="0" c="#fff" a="0.5" />
          <Stop o="0.6" c="#fff" a="0.12" />
          <Stop o="1" c="#fff" a="0" />
        </radialGradient>
        {/* Light from above falling off down a face. */}
        <linearGradient id="rws-toplight" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#fff" a="0.14" />
          <Stop o="0.5" c="#fff" a="0" />
          <Stop o="1" c="#000" a="0.3" />
        </linearGradient>

        {/* Upright chrome: mostly dark, with one narrow line of light down it. */}
        <linearGradient id="rws-tube" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#17191c" />
          <Stop o="0.2" c="#8e949c" />
          <Stop o="0.3" c="#e2e5e8" />
          <Stop o="0.46" c="#787f88" />
          <Stop o="0.78" c="#2e3237" />
          <Stop o="1" c="#111214" />
        </linearGradient>
        {/* Chrome lying flat: sky, a dark horizon, the floor coming back up. */}
        <linearGradient id="rws-plate" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#d9dce0" />
          <Stop o="0.42" c="#7e848d" />
          <Stop o="0.5" c="#2a2d32" />
          <Stop o="0.62" c="#646a73" />
          <Stop o="1" c="#a9aeb5" />
        </linearGradient>
        <radialGradient id="rws-ball" cx="0.36" cy="0.3" r="0.82">
          <Stop o="0" c="#e9ebee" />
          <Stop o="0.3" c="#a2a8b0" />
          <Stop o="0.66" c="#4c5159" />
          <Stop o="1" c="#16181b" />
        </radialGradient>
        <linearGradient id="rws-steel" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#050406" />
          <Stop o="0.3" c="#48444f" />
          <Stop o="0.55" c="#1d1a22" />
          <Stop o="1" c="#050406" />
        </linearGradient>

        {/* Drum shells: oxblood, satin rather than gloss. */}
        <linearGradient id="rws-shell" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#100205" />
          <Stop o="0.14" c="#4a0c18" />
          <Stop o="0.27" c="#84212f" />
          <Stop o="0.33" c="#93293a" />
          <Stop o="0.46" c="#611220" />
          <Stop o="0.76" c="#2b070e" />
          <Stop o="1" c="#0b0204" />
        </linearGradient>
        <linearGradient id="rws-hoop" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#6a1626" />
          <Stop o="0.28" c="#3d0b15" />
          <Stop o="1" c="#120306" />
        </linearGradient>
        <linearGradient id="rws-snare" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#141517" />
          <Stop o="0.2" c="#8f959d" />
          <Stop o="0.3" c="#d3d6da" />
          <Stop o="0.48" c="#686e77" />
          <Stop o="0.8" c="#2b2e33" />
          <Stop o="1" c="#0e0f10" />
        </linearGradient>
        {/* Coated heads: off-white, darker toward the back of the drum. */}
        <linearGradient id="rws-head" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#7f796c" />
          <Stop o="1" c="#dcd6c7" />
        </linearGradient>
        <linearGradient id="rws-kick" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#3a3541" />
          <Stop o="0.3" c="#1a171e" />
          <Stop o="1" c="#08070a" />
        </linearGradient>

        {/* Cymbals: aged bronze. */}
        <linearGradient id="rws-brass" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#231805" />
          <Stop o="0.2" c="#75591d" />
          <Stop o="0.42" c="#bf9f52" />
          <Stop o="0.5" c="#e6d298" />
          <Stop o="0.6" c="#a78232" />
          <Stop o="0.86" c="#553e12" />
          <Stop o="1" c="#1e1505" />
        </linearGradient>

        {/* Guitar: a honey burst over a figured top, amber at the bridge and dark at the rim. */}
        <radialGradient id="rws-honey" cx="0.5" cy="0.6" r="0.66">
          <Stop o="0" c="#dc9b36" />
          <Stop o="0.36" c="#b9701f" />
          <Stop o="0.66" c="#6c300e" />
          <Stop o="0.88" c="#2a1206" />
          <Stop o="1" c="#170a04" />
        </radialGradient>
        {/* Ukulele: cherry, warm at the soundhole and deep at the rim. */}
        <radialGradient id="rws-cherry" cx="0.5" cy="0.58" r="0.66">
          <Stop o="0" c="#c9772a" />
          <Stop o="0.34" c="#a2401c" />
          <Stop o="0.66" c="#5c1712" />
          <Stop o="0.9" c="#24080a" />
          <Stop o="1" c="#140506" />
        </radialGradient>
        {/* Bass: deep ocean teal. */}
        <radialGradient id="rws-ocean" cx="0.4" cy="0.34" r="0.9">
          <Stop o="0" c="#2a6a78" />
          <Stop o="0.34" c="#164a57" />
          <Stop o="0.7" c="#0a2b35" />
          <Stop o="1" c="#041318" />
        </radialGradient>
        <linearGradient id="rws-maple" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#6a4a20" />
          <Stop o="0.3" c="#c79f60" />
          <Stop o="0.64" c="#a57d42" />
          <Stop o="1" c="#5a3d18" />
        </linearGradient>
        <linearGradient id="rws-rosewood" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#120a06" />
          <Stop o="0.34" c="#412819" />
          <Stop o="1" c="#0e0704" />
        </linearGradient>
        {/* An ebony-faced headstock. */}
        <linearGradient id="rws-ebony" x1="0" y1="0" x2="1" y2="1">
          <Stop o="0" c="#2f2a35" />
          <Stop o="0.45" c="#131016" />
          <Stop o="1" c="#070608" />
        </linearGradient>
        <linearGradient id="rws-cream" x1="0" y1="0" x2="1" y2="1">
          <Stop o="0" c="#d9cfb4" />
          <Stop o="1" c="#9a8f73" />
        </linearGradient>
        {/* Nickel pickup covers: softer than chrome. */}
        <linearGradient id="rws-nickel" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#c9ccc9" />
          <Stop o="0.5" c="#7c817f" />
          <Stop o="1" c="#3f4342" />
        </linearGradient>
        <radialGradient id="rws-amber-knob" cx="0.38" cy="0.32" r="0.8">
          <Stop o="0" c="#d9a441" />
          <Stop o="0.5" c="#8c5a16" />
          <Stop o="1" c="#33200a" />
        </radialGradient>

        {/* Black plastic, tolex and wood. */}
        <linearGradient id="rws-black" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#2e2a35" />
          <Stop o="0.4" c="#141118" />
          <Stop o="1" c="#060508" />
        </linearGradient>
        <linearGradient id="rws-tolex" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#1b1720" />
          <Stop o="1" c="#070608" />
        </linearGradient>
        <linearGradient id="rws-ivory" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#e4dfd2" />
          <Stop o="1" c="#8d887a" />
        </linearGradient>

        {/* The microphone. */}
        <linearGradient id="rws-handle" x1="0" y1="0" x2="1" y2="0">
          <Stop o="0" c="#0c0a0f" />
          <Stop o="0.3" c="#5a5663" />
          <Stop o="0.52" c="#211e27" />
          <Stop o="1" c="#070608" />
        </linearGradient>
        <pattern id="rws-mesh" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0,0H2.2M0,0V2.2" stroke="#0c0d10" strokeWidth="0.7" opacity="0.7" />
        </pattern>

        {/* The backline and the floor. */}
        <pattern id="rws-cloth" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="#141118" />
          <path d="M0,0H4M0,2H4" stroke="#2a252f" strokeWidth="0.9" />
          <path d="M1,0V4M3,0V4" stroke="#08070a" strokeWidth="0.8" />
        </pattern>
        <pattern id="rws-grate" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#100e14" />
          <circle cx="2.5" cy="2.5" r="1.5" fill="#040305" />
          <path d="M0,0H5" stroke="#34303b" strokeWidth="0.5" />
        </pattern>
        <linearGradient id="rws-riser" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#2a2420" />
          <Stop o="1" c="#141012" />
        </linearGradient>
        {/* The kit's light coming back off the floor in front of the riser. */}
        <linearGradient id="rws-glint" x1="0" y1="0" x2="0" y2="1">
          <Stop o="0" c="#f1c98f" a="0.2" />
          <Stop o="0.5" c="#b4543f" a="0.07" />
          <Stop o="1" c="#b4543f" a="0" />
        </linearGradient>
        <linearGradient id="rws-glint-fade" gradientUnits="userSpaceOnUse" x1="140" y1="0" x2="580" y2="0">
          <Stop o="0" c="#fff" a="0" />
          <Stop o="0.3" c="#fff" a="1" />
          <Stop o="0.7" c="#fff" a="1" />
          <Stop o="1" c="#fff" a="0" />
        </linearGradient>
        <mask id="rws-glint-mask" maskUnits="userSpaceOnUse" x="140" y="640" width="440" height="200">
          <rect x="140" y="640" width="440" height="200" fill="url(#rws-glint-fade)" />
        </mask>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ drums */

// A drum seen from just above its rim: shell, lugs and tension rods, both hoops, the batter head.
// tilt turns it on its mount, the way toms are angled toward the player.
function Drum({ x, y, w, h, ry, lugs = [0.16, 0.39, 0.61, 0.84], shell = "url(#rws-shell)", tilt = 0 }) {
  const rx = w / 2;
  const cx = x + rx;
  const curve = (t) => Math.sqrt(1 - (2 * t - 1) ** 2);
  return (
    <g transform={tilt ? `rotate(${tilt} ${cx} ${y + h / 2})` : undefined}>
      <path d={`M${x},${y}V${y + h}A${rx},${ry} 0 0 0 ${x + w},${y + h}V${y}Z`} fill={shell} />
      {/* The shell falls into shade under the rim. */}
      <path d={`M${x},${y}A${rx},${ry} 0 0 0 ${x + w},${y}v12A${rx},${ry} 0 0 1 ${x},${y + 12}Z`} fill="#050102" opacity="0.5" />
      {lugs.map((t) => {
        const lx = r2(x + w * t);
        const drop = r2(ry * curve(t));
        const lw = r2(4.6 * (0.5 + 0.5 * curve(t)));
        return (
          <g key={t}>
            <rect x={r2(lx - 0.4)} y={r2(y + drop + 3)} width="0.8" height={h - 4} fill="#8b9199" opacity="0.75" />
            <rect x={r2(lx - lw / 2)} y={r2(y + drop + h / 2 - 6.5)} width={lw} height="13" rx="1.6" fill="url(#rws-tube)" />
            {/* The square heads of the tension rods, on both hoops. */}
            <rect x={r2(lx - 1.1)} y={r2(y + drop + 1.6)} width="2.2" height="3.4" rx="0.5" fill="#c3c8ce" />
            <rect x={r2(lx - 1.1)} y={r2(y + drop + h - 5.6)} width="2.2" height="3.4" rx="0.5" fill="#9da3ab" />
          </g>
        );
      })}
      <path d={`M${x},${y + h - 4}A${rx},${ry} 0 0 0 ${x + w},${y + h - 4}v4A${rx},${ry} 0 0 1 ${x},${y + h}Z`} fill="url(#rws-tube)" />
      <path d={`M${x - 1.2},${y}A${rx + 1.2},${ry + 1.2} 0 0 0 ${x + w + 1.2},${y}v4.6A${rx + 1.2},${ry + 1.2} 0 0 1 ${x - 1.2},${y + 4.6}Z`} fill="url(#rws-tube)" />
      <ellipse cx={cx} cy={y} rx={rx + 1.2} ry={ry + 1.2} fill="url(#rws-tube)" />
      <ellipse cx={cx} cy={y + 0.4} rx={rx - 2.6} ry={ry - 1.8} fill="url(#rws-head)" />
      <ellipse cx={r2(cx - rx * 0.1)} cy={r2(y + ry * 0.3)} rx={r2(rx * 0.5)} ry={r2(ry * 0.34)} fill="url(#rws-sheen)" opacity="0.5" />
    </g>
  );
}

function Cymbal({ cx, cy, rx, ry, tilt = 0 }) {
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy + 1.3} rx={rx} ry={ry} fill="#1a1204" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#rws-brass)" />
      <ellipse cx={cx} cy={cy} rx={r2(rx * 0.8)} ry={r2(ry * 0.8)} fill="none" stroke="#2e2108" strokeOpacity="0.4" strokeWidth="0.5" />
      <ellipse cx={cx} cy={cy} rx={r2(rx * 0.6)} ry={r2(ry * 0.6)} fill="none" stroke="#2e2108" strokeOpacity="0.34" strokeWidth="0.5" />
      <ellipse cx={cx} cy={cy} rx={r2(rx * 0.4)} ry={r2(ry * 0.4)} fill="none" stroke="#2e2108" strokeOpacity="0.3" strokeWidth="0.5" />
      {/* The line of light a turned cymbal throws from its bell to its edge. */}
      <path d={`M${cx},${cy}L${r2(cx - rx * 0.92)},${r2(cy - ry * 0.1)}L${r2(cx - rx * 0.86)},${r2(cy + ry * 0.36)}Z`} fill="#fff3cf" opacity="0.3" />
      <path d={`M${cx},${cy}L${r2(cx + rx * 0.9)},${r2(cy + ry * 0.12)}L${r2(cx + rx * 0.86)},${r2(cy - ry * 0.3)}Z`} fill="#fff3cf" opacity="0.12" />
      <path
        d={`M${r2(cx - rx * 0.17)},${cy}C${r2(cx - rx * 0.14)},${r2(cy - ry - 2.6)} ${r2(cx + rx * 0.14)},${r2(cy - ry - 2.6)} ${r2(cx + rx * 0.17)},${cy}Z`}
        fill="url(#rws-brass)"
      />
      <rect x={cx - 2.4} y={r2(cy - ry - 4.6)} width="4.8" height="2.4" rx="1" fill="#0d0b10" />
      <path d={`M${cx - 3.4},${r2(cy - ry - 7.4)}h6.8l-1.6,2.8h-3.6Z`} fill="url(#rws-plate)" />
    </g>
  );
}

// The kick is seen a little from one side, so its shell shows: a front hoop, and the back one
// behind it and to the left.
const KF = { cx: 236, cy: 244, r: 85 };
const KB = { cx: 214, cy: 237, r: 82 };

// A five-piece kit as the room sees it: floor tom and ride on the left, snare and hats on the right.
export function DrumKit() {
  const on = (c, deg, r = c.r) => [r2(c.cx + r * Math.cos((deg * Math.PI) / 180)), r2(c.cy + r * Math.sin((deg * Math.PI) / 180))];
  const claws = Array.from({ length: 8 }, (_, i) => 22.5 + i * 45);
  const rods = [142, 180, 218];
  return (
    <svg viewBox="0 0 500 340" {...svgProps}>
      <defs>
        <clipPath id="rws-kick-face">
          <circle cx={KF.cx} cy={KF.cy} r="75" />
        </clipPath>
        <linearGradient id="rws-kick-shell" gradientUnits="userSpaceOnUse" x1="128" y1="0" x2="250" y2="0">
          <Stop o="0" c="#0b0204" />
          <Stop o="0.45" c="#3d0b15" />
          <Stop o="0.8" c="#84212f" />
          <Stop o="1" c="#611220" />
        </linearGradient>
      </defs>

      <Contact cx={252} cy={332} rx={244} ry={7} />

      {/* Stands at the back. Ride: a boom stand behind the floor tom. */}
      <rect x="56.6" y="150" width="2.8" height="84" fill="url(#rws-tube)" />
      <rect x="55.8" y="230" width="4.4" height="86" fill="url(#rws-tube)" />
      <Tube d="M58,154L88,106" w={2.6} />
      <circle cx="58" cy="153" r="3" fill="url(#rws-ball)" />
      {/* Crash: a boom stand behind the snare. */}
      <rect x="392.6" y="112" width="2.8" height="110" fill="url(#rws-tube)" />
      <rect x="391.8" y="218" width="4.4" height="98" fill="url(#rws-tube)" />
      <Tube d="M394,116L372,64" w={2.6} />
      <circle cx="394" cy="115" r="3" fill="url(#rws-ball)" />
      <rect x="390.2" y="262" width="7.6" height="6" rx="1.4" fill="url(#rws-tube)" />
      <Tube d="M394,306L370,332" />
      <Tube d="M394,306L418,332" />
      {/* Hi-hat stand: its rod, its legs and the pedal out front. */}
      <rect x="438.6" y="140" width="2.8" height="176" fill="url(#rws-tube)" />
      <rect x="439.2" y="118" width="1.6" height="26" fill="url(#rws-tube)" />
      <rect x="436.2" y="236" width="7.6" height="6" rx="1.4" fill="url(#rws-tube)" />
      <Tube d="M440,300L416,332" />
      <Tube d="M440,300L464,332" />
      <path d="M428,335l5,-19h14l5,19Z" fill="#1f1c25" />
      <path d="M433,316h14" stroke="#5c5764" strokeWidth="0.9" />
      <path d="M440,300v16" stroke="#8b9199" strokeWidth="0.9" />

      {/* Kick drum: the back hoop, the shell between, its rods and lugs. */}
      <Tube d="M176,302L150,332" />
      <Tube d="M296,302L322,332" />
      <circle cx={KB.cx} cy={KB.cy} r={KB.r} fill="#1a0509" />
      <path d="M261.8,163L238.8,158.9A82,82 0 0 0 189.2,315.1L210.2,325A85,85 0 0 1 261.8,163Z" fill="url(#rws-kick-shell)" />
      <path d="M238.8,158.9A82,82 0 0 0 189.2,315.1" fill="none" stroke="#4a0c18" strokeWidth="5" />
      <path d="M238.8,158.9A82,82 0 0 0 189.2,315.1" fill="none" stroke="#93293a" strokeOpacity="0.5" strokeWidth="0.8" />
      {rods.map((deg) => {
        const [fx, fy] = on(KF, deg);
        const [bx, by] = on(KB, deg);
        const turn = r2((Math.atan2(fy - by, fx - bx) * 180) / Math.PI);
        return (
          <g key={deg}>
            <path d={`M${bx},${by}L${fx},${fy}`} stroke="#9da3ab" strokeWidth="0.9" />
            <rect x="-6.5" y="-2.6" width="13" height="5.2" rx="1.6" fill="url(#rws-plate)" transform={`translate(${r2((fx + bx) / 2)} ${r2((fy + by) / 2)}) rotate(${turn})`} />
          </g>
        );
      })}
      {/* The front hoop and a black head with the school's mark on it. */}
      <circle cx={KF.cx} cy={KF.cy} r={KF.r} fill="url(#rws-hoop)" />
      <circle cx={KF.cx} cy={KF.cy} r="81.4" fill="none" stroke="#93293a" strokeOpacity="0.4" strokeWidth="0.7" />
      <circle cx={KF.cx} cy={KF.cy} r="77.4" fill="#040305" />
      <circle cx={KF.cx} cy={KF.cy} r="75" fill="url(#rws-kick)" />
      <g clipPath="url(#rws-kick-face)">
        {/* The toms' shadow across the top of the head, and the light the head still catches. */}
        <ellipse cx={KF.cx} cy="174" rx="106" ry="27" fill="#000" opacity="0.6" />
        <ellipse cx="212" cy="222" rx="46" ry="30" fill="url(#rws-sheen)" opacity="0.2" transform="rotate(-24 212 222)" />
        <circle cx={KF.cx} cy={KF.cy} r="72.6" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="0.9" />
      </g>
      <g transform="translate(203 214)" opacity="0.9">
        <RockWorksIcon size={66} color="#d6ccb3" />
      </g>
      {claws.map((deg) => {
        const [x, y] = on(KF, deg);
        return (
          <g key={deg} transform={`translate(${x} ${y}) rotate(${deg + 90})`}>
            <rect x="-3" y="-6" width="6" height="12" rx="1.6" fill="url(#rws-tube)" />
            <rect x="-4.6" y="-1.2" width="9.2" height="2.4" rx="1.2" fill="#9da3ab" />
          </g>
        );
      })}

      {/* Floor tom on its legs, in front of the kick's shell. */}
      <Tube d="M21,258L15,332" w={2.8} />
      <Tube d="M135,258L141,332" w={2.8} />
      <Drum x={16} y={206} w={124} h={106} ry={17} lugs={[0.13, 0.33, 0.5, 0.67, 0.87]} />
      <rect x="15.4" y="252" width="9.2" height="13" rx="1.6" fill="url(#rws-tube)" />
      <rect x="131.4" y="252" width="9.2" height="13" rx="1.6" fill="url(#rws-tube)" />
      <rect x="11.6" y="329" width="6.8" height="5" rx="1.8" fill="#070608" />
      <rect x="137.6" y="329" width="6.8" height="5" rx="1.8" fill="#070608" />

      {/* Snare in its basket: a steel shell, ten lugs round it. */}
      <rect x="370.4" y="254" width="3.2" height="52" fill="url(#rws-tube)" />
      <Tube d="M372,272L334,250" w={2.4} />
      <Tube d="M372,272L410,250" w={2.4} />
      <Tube d="M372,304L348,332" />
      <Tube d="M372,304L396,332" />
      <Drum x={318} y={206} w={108} h={36} ry={14} shell="url(#rws-snare)" lugs={[0.1, 0.3, 0.5, 0.7, 0.9]} />

      {/* Rack toms on their holder, each turned toward the player. */}
      <rect x="219" y="140" width="4" height="34" rx="1.2" fill="url(#rws-tube)" />
      <rect x="249" y="142" width="4" height="32" rx="1.2" fill="url(#rws-tube)" />
      <rect x="213" y="168" width="46" height="8" rx="2" fill="url(#rws-plate)" />
      <Drum x={136} y={110} w={100} h={66} ry={14} tilt={-4} />
      <Drum x={246} y={114} w={90} h={60} ry={13} tilt={5} />

      {/* Cymbals last: they hang over everything. A 20-inch ride, a 16-inch crash, 14-inch hats. */}
      <Cymbal cx={88} cy={104} rx={77} ry={10.4} tilt={-12} />
      <Cymbal cx={372} cy={62} rx={62} ry={8.4} tilt={10} />
      <ellipse cx="440" cy="172" rx="50" ry="6.6" fill="#2a1e08" />
      <ellipse cx="440" cy="170.6" rx="50" ry="6.6" fill="#75591d" />
      <Cymbal cx={440} cy={165} rx={50} ry={6.6} />
    </svg>
  );
}

/* ------------------------------------------------------------------ strings */

const fretsFor = (nut, scale, count) =>
  Array.from({ length: count }, (_, i) => r2(nut + scale * (1 - 2 ** (-(i + 1) / 12))));

// The fretboard: the board itself, frets at their real spacing, the position markers and the nut.
// blocks draws the markers as pearl blocks, not dots; bound adds a cream edge down both sides.
function Fretboard({ cx, nut, end, scale, count, nutHalf, endHalf, dots, blocks = false, bound = false }) {
  const frets = fretsFor(nut, scale, count);
  const half = (y) => nutHalf + ((endHalf - nutHalf) * (y - nut)) / (end - nut);
  const fretAt = (n) => (n === 0 ? nut : frets[n - 1]);
  const between = (n) => (fretAt(n - 1) + fretAt(n)) / 2;
  return (
    <g>
      <path
        d={`M${r2(cx - nutHalf)},${nut}H${r2(cx + nutHalf)}L${r2(cx + endHalf)},${end}H${r2(cx - endHalf)}Z`}
        fill="url(#rws-rosewood)"
      />
      {dots.map((n) => {
        const y = between(n);
        if (blocks) {
          const tall = Math.min((fretAt(n) - fretAt(n - 1)) * 0.52, 5.4);
          const wide = half(y) * 1.24;
          return <rect key={n} x={r2(cx - wide / 2)} y={r2(y - tall / 2)} width={r2(wide)} height={r2(tall)} rx="0.4" fill="#cfc6ad" opacity="0.9" />;
        }
        return n === 12 ? (
          <g key={n}>
            <circle cx={r2(cx - half(y) * 0.46)} cy={r2(y)} r="1.1" fill="#c9bfa6" />
            <circle cx={r2(cx + half(y) * 0.46)} cy={r2(y)} r="1.1" fill="#c9bfa6" />
          </g>
        ) : (
          <circle key={n} cx={cx} cy={r2(y)} r="1.1" fill="#c9bfa6" />
        );
      })}
      {frets.map((y) => (
        <rect key={y} x={r2(cx - half(y))} y={r2(y - 0.35)} width={r2(half(y) * 2)} height="0.7" fill="#9da3ab" />
      ))}
      {bound && (
        <>
          <path d={`M${r2(cx - nutHalf)},${nut}L${r2(cx - endHalf)},${end}`} stroke="#d9cfb4" strokeOpacity="0.8" strokeWidth="0.7" />
          <path d={`M${r2(cx + nutHalf)},${nut}L${r2(cx + endHalf)},${end}`} stroke="#d9cfb4" strokeOpacity="0.8" strokeWidth="0.7" />
        </>
      )}
      <rect x={r2(cx - nutHalf - 0.2)} y={nut - 1.4} width={r2(nutHalf * 2 + 0.4)} height="2" rx="0.5" fill="#d9d0b8" />
    </g>
  );
}

// A low A-frame stand: two legs and a prop behind, a cradle bar under the body. The rubber arms
// in front are drawn by AFrameArms, after the instrument.
function AFrame({ cx, rest, foot, spread = 34 }) {
  return (
    <g>
      <Tube dark w={3.8} d={`M${cx},${rest - 4}L${cx - spread},${foot}`} />
      <Tube dark w={3.8} d={`M${cx},${rest - 4}L${cx + spread},${foot}`} />
      <Tube dark w={3.8} d={`M${cx},${rest - 4}L${cx},${foot - 6}`} />
      <rect x={cx - spread * 0.74} y={rest + 0.6} width={spread * 1.48} height="5" rx="2.5" fill="#060508" />
      <rect x={cx - spread - 5} y={foot - 2.4} width="8" height="4.8" rx="2.2" fill="#060508" />
      <rect x={cx + spread - 3} y={foot - 2.4} width="8" height="4.8" rx="2.2" fill="#060508" />
    </g>
  );
}

function AFrameArms({ cx, rest, spread = 34, lift = 0 }) {
  const reach = spread * 0.78;
  return (
    <g>
      <rect x={r2(cx - reach)} y={rest - 9} width="5" height="14" rx="2.5" fill="#0a090c" />
      <rect x={r2(cx + reach - 5)} y={rest - 11 - lift} width="5" height={16 + lift} rx="2.5" fill="#0a090c" />
      <rect x={r2(cx - reach + 0.8)} y={rest - 8} width="1" height="7" rx="0.5" fill="#4a4653" />
      <rect x={r2(cx + reach - 4.2)} y={rest - 10 - lift} width="1" height="7" rx="0.5" fill="#4a4653" />
    </g>
  );
}

/* ------------------------------------------------------------------ guitar */

// A carved single-cut body: round shoulders, a narrow waist, one short horn on the treble side.
const GUITAR_BODY =
  "M62,174C56,172 46,172 41,177C36,182 34,190 35,199C36,210 43,218 43,228C43,240 21,246 21,268C21,290 42,304 70,304C98,304 119,290 119,268C119,246 97,240 97,228C97,219 103,212 104,203C105,194 102,186 97,182C94,179 90,180 89,184C87,190 84,196 78,196Z";

// The electric guitar: a single cutaway, two humbuckers, a bridge and stop bar, four knobs and a
// toggle, three keys a side. Scale 628 mm, the neck meeting the body at the sixteenth fret. It
// has been set down mid-rehearsal in a low stand, a little askew.
export function Guitar() {
  const cx = 70;
  const nut = 60;
  // Six strings, heaviest on the left as the guitar faces the room.
  const strings = [0.95, 0.82, 0.68, 0.52, 0.42, 0.36];
  const posts = [
    [62.6, 43],
    [62.4, 32],
    [62.6, 21],
    [77.4, 21],
    [77.6, 32],
    [77.4, 43],
  ];
  const flame = [198, 208, 218, 229, 240, 251, 262, 273, 284, 294];
  return (
    <svg viewBox="0 0 140 346" {...svgProps}>
      <defs>
        <clipPath id="rws-guitar-body">
          <path d={GUITAR_BODY} />
        </clipPath>
      </defs>
      <Contact cx={76} cy={339} rx={50} ry={5.5} />
      <AFrame cx={76} rest={306} foot={338} />

      <g transform="translate(4 2) rotate(-5 70 304)">
        {/* Body: a honey burst over a figured top, bound in cream. */}
        <path d={GUITAR_BODY} fill="url(#rws-honey)" />
        <g clipPath="url(#rws-guitar-body)">
          {flame.map((y, i) => (
            <path key={y} d={`M14,${y}q14,${i % 2 ? 3 : -3} 28,0t28,0t28,0t28,0`} fill="none" stroke="#ffe9b8" strokeOpacity="0.07" strokeWidth="2.6" />
          ))}
          <rect x="14" y="170" width="112" height="138" fill="url(#rws-toplight)" />
          <ellipse cx="34" cy="262" rx="7" ry="30" fill="url(#rws-sheen)" opacity="0.36" transform="rotate(8 34 262)" />
        </g>
        <path d={GUITAR_BODY} fill="none" stroke="#d9cfb4" strokeOpacity="0.85" strokeWidth="1.3" />
        <path d={GUITAR_BODY} fill="none" stroke="#050201" strokeWidth="0.5" />

        {/* A slim cream guard beside the pickups, and the toggle on its plate. */}
        <path d="M85.4,201.4L90.6,200C93.6,201.4 94.6,204.6 94.2,208.4L91.4,233C91,236.4 88.6,237.6 86.4,237L85.4,236.6Z" fill="url(#rws-cream)" stroke="#4a4233" strokeWidth="0.4" opacity="0.92" />
        <circle cx="47" cy="197" r="5.4" fill="url(#rws-cream)" stroke="#4a4233" strokeWidth="0.4" />
        <circle cx="47" cy="197" r="2.2" fill="url(#rws-ball)" />
        <path d="M47,197l-2.4,-4.6" stroke="#c3c8ce" strokeWidth="1.2" strokeLinecap="round" />

        {/* Two humbuckers under nickel covers, in cream rings. */}
        {[
          [206, -3.2],
          [232, 3.2],
        ].map(([y, screws]) => (
          <g key={y}>
            <rect x={cx - 14.6} y={y - 6.9} width="29.2" height="13.8" rx="1.6" fill="url(#rws-cream)" stroke="#4a4233" strokeWidth="0.4" />
            <rect x={cx - 11.2} y={y - 5} width="22.4" height="10" rx="1.3" fill="url(#rws-nickel)" stroke="#2a2d32" strokeWidth="0.35" />
            {[-8.5, -5.1, -1.7, 1.7, 5.1, 8.5].map((dx) => (
              <circle key={dx} cx={cx + dx} cy={y + screws} r="0.75" fill="#3f4342" />
            ))}
          </g>
        ))}

        {/* Bridge on its two posts, and the stop bar the strings anchor in. */}
        <circle cx={cx - 14.6} cy="247" r="2" fill="url(#rws-ball)" />
        <circle cx={cx + 14.6} cy="247" r="2" fill="url(#rws-ball)" />
        <rect x={cx - 14} y="244.6" width="28" height="4.8" rx="2" fill="url(#rws-plate)" stroke="#16181b" strokeWidth="0.35" />
        {[-9.2, -5.5, -1.8, 1.8, 5.5, 9.2].map((dx) => (
          <rect key={dx} x={r2(cx + dx - 1)} y="245.2" width="2" height="3.6" rx="0.4" fill="#c3c8ce" />
        ))}
        <rect x={cx - 15} y="256.4" width="30" height="5.6" rx="2.8" fill="url(#rws-plate)" stroke="#16181b" strokeWidth="0.35" />
        <circle cx={cx - 13} cy="259.2" r="1.7" fill="#2a2d32" />
        <circle cx={cx + 13} cy="259.2" r="1.7" fill="#2a2d32" />

        {/* Two volumes, two tones. */}
        {[
          [93, 259],
          [104, 268],
          [90, 277],
          [101, 286],
        ].map(([x, y]) => (
          <g key={y}>
            <circle cx={x} cy={y + 0.8} r="4.5" fill="#000" opacity="0.5" />
            <circle cx={x} cy={y} r="4.3" fill="url(#rws-amber-knob)" stroke="#231505" strokeWidth="0.4" />
            <circle cx={x} cy={y} r="2.2" fill="none" stroke="#e2b765" strokeOpacity="0.5" strokeWidth="0.5" />
          </g>
        ))}
        <circle cx="40.4" cy="178.6" r="1.7" fill="url(#rws-ball)" />

        {/* Neck: a bound rosewood board with block markers, an ebony-faced head, three keys a side. */}
        <path
          d="M63.4,60C62,54 58,50 57.4,44L56.2,18C56,11 60,8 66,7.4L74,7.4C80,8 84,11 83.8,18L82.6,44C82,50 78,54 76.6,60Z"
          fill="url(#rws-ebony)"
          stroke="#d9cfb4"
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />
        {posts.map(([x, y], i) => {
          const left = i < 3;
          const bx = left ? x - 12.4 : x + 7.2;
          return (
            <g key={`${x}-${y}`}>
              <rect x={left ? x - 8 : x} y={y - 0.7} width="8" height="1.4" fill="#6c727b" />
              <rect x={bx} y={y - 3.2} width="5.2" height="6.4" rx="1.3" fill="url(#rws-cream)" stroke="#4a4233" strokeWidth="0.35" />
              <circle cx={x} cy={y} r="1.9" fill="url(#rws-ball)" />
            </g>
          );
        })}
        <Fretboard cx={cx} nut={nut} end={197} scale={187} count={22} nutHalf={6.4} endHalf={8.4} dots={[3, 5, 7, 9, 12, 15, 17, 19, 21]} blocks bound />
        {strings.map((w, i) => {
          const top = r2(cx + (i - 2.5) * 2.0);
          const foot = r2(cx + (i - 2.5) * 3.68);
          const post = posts[i];
          return (
            <g key={i} stroke="#c9cdd2" strokeOpacity="0.85" strokeWidth={w} strokeLinecap="round">
              <path d={`M${top},${nut}L${foot},247L${foot},258`} fill="none" />
              <path d={`M${top},${nut - 1}L${post[0]},${post[1]}`} strokeWidth={r2(w * 0.85)} />
            </g>
          );
        })}
      </g>
      <AFrameArms cx={76} rest={306} lift={2} />
    </svg>
  );
}

/* ------------------------------------------------------------------ ukulele */

// A small single-cut body with a round soundhole: the guitar's little cousin.
const UKE_BODY =
  "M43.4,110C38,108.6 30,109.5 27.4,114C24.6,118.6 25,125 27,131C28.6,135.4 29,137 28.6,140C27.6,146 19,150 19,165C19,180 32,191 50,191C68,191 81,180 81,165C81,150 72.4,146 71.4,140C71,136 73.6,132 74.6,127C75.4,122 73.4,117.6 70,116.4C67.6,115.6 65.4,117 65,119.6C64.4,123 61.6,124.6 57.2,124.4Z";

// The ukulele: tenor scale (432 mm), four nylon strings, a tie bridge, two keys a side.
export function Ukulele() {
  const cx = 50;
  const nut = 43;
  const posts = [
    [45.2, 33],
    [45, 20.6],
    [55, 20.6],
    [54.8, 33],
  ];
  return (
    <svg viewBox="0 0 100 236" {...svgProps}>
      <defs>
        <clipPath id="rws-uke-body">
          <path d={UKE_BODY} />
        </clipPath>
      </defs>
      <Contact cx={50} cy={229} rx={38} ry={4.6} />
      <AFrame cx={50} rest={192} foot={228} spread={26} />

      <g transform="rotate(4 50 191)">
        {/* Body: cherry over a warm centre, bound in cream. */}
        <path d={UKE_BODY} fill="url(#rws-cherry)" />
        <g clipPath="url(#rws-uke-body)">
          <rect x="16" y="106" width="68" height="88" fill="url(#rws-toplight)" />
          <ellipse cx="27" cy="164" rx="5" ry="20" fill="url(#rws-sheen)" opacity="0.34" transform="rotate(8 27 164)" />
        </g>
        <path d={UKE_BODY} fill="none" stroke="#d9cfb4" strokeOpacity="0.85" strokeWidth="1.1" />
        <path d={UKE_BODY} fill="none" stroke="#050201" strokeWidth="0.45" />

        {/* Soundhole and its rosette. */}
        <circle cx={cx} cy="139" r="11.4" fill="none" stroke="#120504" strokeOpacity="0.7" strokeWidth="0.5" />
        <circle cx={cx} cy="139" r="10.2" fill="none" stroke="#d9cfb4" strokeOpacity="0.7" strokeWidth="0.6" />
        <circle cx={cx} cy="139" r="8.6" fill="#070403" />
        <path d="M43.4,133.6A8.6,8.6 0 0 1 56.6,133.6" fill="none" stroke="#4a2414" strokeWidth="1" strokeLinecap="round" />

        {/* A small cream guard under the cutaway. */}
        <path d="M61.6,128.4L66.2,126.4C69,128.6 70,133 69.4,138L67.4,151C66.8,154 64.4,154.6 62.6,153.2C61.4,149 61.8,145 61,141Z" fill="url(#rws-cream)" stroke="#4a4233" strokeWidth="0.4" />

        {/* A tie bridge with a bone saddle. */}
        <rect x={cx - 14} y="159.8" width="28" height="6.6" rx="1" fill="#1a0e08" stroke="#070403" strokeWidth="0.4" />
        <rect x={cx - 11} y="160.8" width="22" height="1.3" rx="0.4" fill="#d9d0b8" />
        <rect x={cx - 12} y="163.4" width="24" height="1.8" fill="#0b0604" />

        {/* Neck: a rosewood board, an ebony-faced head, two keys a side. */}
        <path
          d="M44.8,43C44,39 41.6,36 41.2,31L40.4,16C40.2,11 43.4,8.6 48,8.2L52,8.2C56.6,8.6 59.8,11 59.6,16L58.8,31C58.4,36 56,39 55.2,43Z"
          fill="url(#rws-ebony)"
          stroke="#d9cfb4"
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />
        {posts.map(([x, y], i) => {
          const left = i < 2;
          return (
            <g key={`${x}-${y}`}>
              <rect x={left ? x - 7.4 : x} y={y - 0.7} width="7.4" height="1.4" fill="#6c727b" />
              <ellipse cx={left ? x - 9 : x + 9} cy={y} rx="2.8" ry="2.2" fill="url(#rws-plate)" stroke="#16181b" strokeWidth="0.35" />
              <circle cx={x} cy={y} r="1.8" fill="url(#rws-ball)" />
            </g>
          );
        })}
        <Fretboard cx={cx} nut={nut} end={124} scale={120} count={19} nutHalf={5.2} endHalf={7.2} dots={[5, 7, 10, 12, 15]} bound />
        {[0, 1, 2, 3].map((i) => {
          const top = r2(cx + (i - 1.5) * 2.35);
          const foot = r2(cx + (i - 1.5) * 4.6);
          const post = posts[i];
          return (
            <g key={i} stroke="#e4dfd2" strokeOpacity="0.8" strokeWidth="0.8" strokeLinecap="round">
              <path d={`M${top},${nut}L${foot},161.4L${foot},164`} fill="none" />
              <path d={`M${top},${nut - 1}L${post[0]},${post[1]}`} strokeWidth="0.7" />
            </g>
          );
        })}
      </g>
      <AFrameArms cx={50} rest={192} spread={26} />
    </svg>
  );
}

/* ------------------------------------------------------------------ bass */

// A tubular stand, drawn in two passes: what sits behind the instrument, and the rubber tips in front.
function StandBack({ cx, yoke, rest, foot }) {
  return (
    <g>
      <Tube dark w={3.8} d={`M${cx},${rest + 6}L${cx - 37},${foot}`} />
      <Tube dark w={3.8} d={`M${cx},${rest + 6}L${cx + 37},${foot}`} />
      <Tube dark w={3.8} d={`M${cx},${rest + 6}L${cx},${foot - 5}`} />
      <rect x={cx - 2.2} y={yoke + 10} width="4.4" height={rest - yoke} fill="url(#rws-steel)" />
      <path
        d={`M${cx - 15},${yoke - 4}v6q0,7.5 7.5,7.5h15q7.5,0 7.5,-7.5v-6`}
        fill="none"
        stroke="#060508"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <rect x={cx - 24} y={rest} width="48" height="5" rx="2.5" fill="#060508" />
      <rect x={cx - 41} y={foot - 2.4} width="8" height="4.8" rx="2.2" fill="#060508" />
      <rect x={cx + 33} y={foot - 2.4} width="8" height="4.8" rx="2.2" fill="#060508" />
    </g>
  );
}

function StandFront({ cx, rest }) {
  return (
    <g>
      <rect x={cx - 25} y={rest - 8.4} width="5" height="13.4" rx="2.5" fill="#0a090c" />
      <rect x={cx + 20} y={rest - 8.4} width="5" height="13.4" rx="2.5" fill="#0a090c" />
      <rect x={cx - 24.2} y={rest - 7.4} width="1" height="7" rx="0.5" fill="#4a4653" />
      <rect x={cx + 20.8} y={rest - 7.4} width="1" height="7" rx="0.5" fill="#4a4653" />
    </g>
  );
}

// An offset body with a long upper horn that reaches the twelfth fret, as a bass needs to balance.
const BASS_BODY =
  "M59.4,226C57,214 51,200 44,191C41,186 35,183.6 31.6,187.6C27,194 27.4,212 30,228C32,240 33.6,250 31.6,259C28.6,272 16.6,280 16.6,306C16.6,332 38,351 66,351C96,351 120.4,333 120.4,306C120.4,286 108.4,275 106,261C104.4,251 108.4,243 110.6,235C112.6,227 109,220.6 103,221.4C95.4,222.4 89.6,227.6 85,232C82,234.6 79.6,235 77,235Z";

const BASS_GUARD =
  "M49,220C45,232 44.6,247 48.6,259C52.6,271 59,285 69,299C81,313 104,316 111,300C110,285 101.4,274 99.4,260C97.6,248 101.4,240 100.4,231C95.6,227 89.6,230.6 83.6,234.6L60.4,231.6C55.6,228 52,221.4 49,220Z";

// The bass: long scale (864 mm, a third longer than the guitar's), four heavy strings, two
// pickups, a broad bridge and two big keys a side.
export function Bass() {
  const cx = 68;
  const nut = 66;
  const strings = [1.7, 1.45, 1.2, 0.95];
  const posts = [
    [57.4, 43],
    [57.6, 24],
    [79.6, 26],
    [79.2, 45],
  ];
  return (
    <svg viewBox="0 0 136 388" {...svgProps}>
      <defs>
        <clipPath id="rws-bass-body">
          <path d={BASS_BODY} />
        </clipPath>
      </defs>
      <Contact cx={cx} cy={381} rx={48} ry={5.5} />
      <StandBack cx={cx} yoke={136} rest={352} foot={381} />

      <g transform="rotate(1.4 68 351)">
        {/* Body: ocean teal, bound in cream, under a parchment guard. */}
        <path d={BASS_BODY} fill="url(#rws-ocean)" />
        <g clipPath="url(#rws-bass-body)">
          <rect x="10" y="182" width="116" height="172" fill="url(#rws-toplight)" />
          <ellipse cx="29" cy="300" rx="7" ry="38" fill="url(#rws-sheen)" opacity="0.36" transform="rotate(6 29 300)" />
        </g>
        <path d={BASS_BODY} fill="none" stroke="#d9cfb4" strokeOpacity="0.6" strokeWidth="1.1" />
        <path d={BASS_BODY} fill="none" stroke="#010506" strokeWidth="0.5" />

        <path d={BASS_GUARD} fill="url(#rws-cream)" stroke="#4a4233" strokeWidth="0.45" />
        {[
          [50.6, 224],
          [48.4, 254],
          [68, 295],
          [107, 301],
          [100.6, 262],
          [98.6, 233.4],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.65" fill="#5c5f66" />
        ))}

        {/* Neck pickup under a chrome cover; bridge pickup in a chrome surround. */}
        <rect x={cx - 14.6} y="250" width="29.2" height="10.6" rx="1.6" fill="url(#rws-plate)" stroke="#16181b" strokeWidth="0.4" />
        {[-9.3, -3.1, 3.1, 9.3].map((dx) => (
          <circle key={dx} cx={cx + dx} cy="255.3" r="1" fill="#2a2d32" />
        ))}
        <rect x={cx - 17} y="288.6" width="34" height="15.4" rx="2.2" fill="url(#rws-plate)" stroke="#16181b" strokeWidth="0.4" />
        <rect x={cx - 14.6} y="291" width="29.2" height="10.6" rx="1.6" fill="url(#rws-black)" stroke="#000" strokeWidth="0.4" />
        {[-10.4, -8, -4.2, -1.8, 1.8, 4.2, 8, 10.4].map((dx) => (
          <circle key={dx} cx={cx + dx} cy="296.3" r="0.9" fill="#6c727b" />
        ))}

        {/* A broad bridge: four saddles on a heavy plate, the strings anchored at its tail. */}
        <rect x={cx - 18} y="312" width="36" height="24" rx="2" fill="url(#rws-plate)" stroke="#16181b" strokeWidth="0.4" />
        {[-10.8, -3.6, 3.6, 10.8].map((dx) => (
          <g key={dx}>
            <rect x={r2(cx + dx - 2.2)} y="319" width="4.4" height="7.6" rx="2.2" fill="url(#rws-tube)" stroke="#16181b" strokeWidth="0.3" />
            <circle cx={r2(cx + dx)} cy="332" r="1.2" fill="#16181b" />
          </g>
        ))}

        {/* Two volumes, two tones, on the guard. */}
        {[
          [94.6, 271],
          [101.6, 284],
          [93, 292.6],
          [100, 305],
        ].map(([x, y]) => (
          <g key={y}>
            <circle cx={x} cy={y + 0.9} r="4.3" fill="#000" opacity="0.45" />
            <circle cx={x} cy={y} r="4" fill="url(#rws-ball)" stroke="#111214" strokeWidth="0.4" />
            <circle cx={x} cy={y} r="2.2" fill="url(#rws-plate)" />
          </g>
        ))}
        <circle cx="33.2" cy="186.4" r="1.8" fill="url(#rws-ball)" />

        {/* Neck: a bound rosewood board, an aged maple head, two big keys a side. */}
        <path
          d="M61.9,66C60,58 52,54 51,44L52,18C52,11 57,7 64,8L76,9.5C83,10.5 86,15 85.5,21L84,44C83,54 76,58 74.1,66Z"
          fill="url(#rws-maple)"
          stroke="#2c1c0a"
          strokeWidth="0.7"
        />
        <path d="M53.5,19C53.8,13.4 58,10.2 64,10.8L76,12.2" fill="none" stroke="#f1d6a0" strokeOpacity="0.5" strokeWidth="0.7" />
        {posts.map(([x, y], i) => {
          const left = i < 2;
          const kx = left ? x - 15.5 : x + 15.5;
          return (
            <g key={`${x}-${y}`}>
              <rect x={left ? x - 11 : x} y={y - 0.9} width="11" height="1.8" fill="#6c727b" />
              <path
                d={`M${kx},${y - 4.8}c4.4,0 6.6,2.3 6.6,4.8s-2.2,4.8 -6.6,4.8s-6.6,-2.3 -6.6,-4.8s2.2,-4.8 6.6,-4.8Z`}
                fill="url(#rws-plate)"
                stroke="#16181b"
                strokeWidth="0.4"
              />
              <circle cx={x} cy={y} r="2.6" fill="url(#rws-ball)" stroke="#111214" strokeWidth="0.35" />
            </g>
          );
        })}
        <Fretboard cx={cx} nut={nut} end={245} scale={257} count={20} nutHalf={6.2} endHalf={9.6} dots={[3, 5, 7, 9, 12, 15, 17, 19]} bound />
        {strings.map((w, i) => {
          const top = r2(cx + (i - 1.5) * 3.1);
          const foot = r2(cx + (i - 1.5) * 7.2);
          return (
            <g key={i} stroke="#b9bdc3" strokeWidth={w} strokeLinecap="round">
              <path d={`M${top},${nut}L${foot},322L${foot},332`} fill="none" />
              <path d={`M${top},${nut - 1}L${posts[i][0]},${posts[i][1]}`} strokeWidth={r2(w * 0.85)} />
              <path d={`M${top},${nut}L${foot},322`} stroke="#33373d" strokeWidth={r2(w * 0.34)} transform="translate(0.4 0)" />
            </g>
          );
        })}
      </g>
      <StandFront cx={cx} rest={352} />
    </svg>
  );
}

/* ------------------------------------------------------------------ keys */

// An 88-key stage piano on a table stand, seen from the front and a little above so its keys
// show. Everything on its top face is drawn flat, in a 400 x 100 space (about 3.2 mm a unit),
// and laid onto the slanted face by one matrix. Fifty-two white keys from A to C and thirty-six
// black ones in their twos and threes; behind them the felt, then the panel.
export function Keys() {
  const whites = 52;
  const keyW = 381 / whites;
  const first = 9.5;
  const sharps = Array.from({ length: whites - 1 }, (_, i) => i).filter((i) => "ACDFG".includes("ABCDEFG"[i % 7]));
  const knobRow = (x0, count, gap, t, r = 2.4) =>
    Array.from({ length: count }, (_, i) => (
      <g key={`${x0}-${t}-${i}`}>
        <circle cx={x0 + i * gap} cy={t} r={r} fill="#050406" />
        <circle cx={x0 + i * gap} cy={t + 0.5} r={r * 0.68} fill="#3c3844" />
      </g>
    ));
  return (
    <svg viewBox="0 0 460 384" {...svgProps}>
      <Contact cx={236} cy={376} rx={214} ry={8} />

      {/* Table stand: two posts on long feet, braced, set a fifth of the way in from each end. */}
      <Tube dark w={4.4} d="M150,128L128,90" />
      <Tube dark w={4.4} d="M366,128L344,90" />
      <rect x="131" y="124" width="6" height="226" fill="url(#rws-steel)" />
      <rect x="347" y="124" width="6" height="226" fill="url(#rws-steel)" />
      <Tube dark w={4} d="M134,296L350,296" />
      <Tube dark w={6} d="M152,374L120,322" />
      <Tube dark w={6} d="M368,374L336,322" />
      <rect x="147" y="371" width="10" height="5.6" rx="2.4" fill="#040305" />
      <rect x="363" y="371" width="10" height="5.6" rx="2.4" fill="#040305" />

      {/* Case: the front edge and the end nearest the room, then the top face. */}
      <path d="M40,110H440V126H40Z" fill="url(#rws-black)" />
      <path d="M40,110L10,58V74L40,126Z" fill="#0d0b10" />
      <path d="M40,110L10,58" stroke="#5c5764" strokeWidth="0.8" />
      <path d="M49.5,110H430.5V116.6H49.5Z" fill="#a7a294" />
      {Array.from({ length: whites - 1 }, (_, i) => (
        <rect key={i} x={r2(40 + first + (i + 1) * keyW - 0.3)} y="110" width="0.6" height="6.6" fill="#4a4638" />
      ))}
      <rect x="49.5" y="116.6" width="381" height="1.4" fill="#000" opacity="0.6" />

      <g transform="matrix(1 0 -0.3 -0.52 40 110)">
        <rect width="400" height="100" fill="#1a1720" />
        <rect x="9" y="2.4" width="382" height="44.4" fill="#050406" />
        <rect x={first} y="3" width="381" height="43" fill="url(#rws-ivory)" />
        {Array.from({ length: whites - 1 }, (_, i) => (
          <rect key={i} x={r2(first + (i + 1) * keyW - 0.35)} y="3" width="0.7" height="43" fill="#4a463e" />
        ))}
        {sharps.map((i) => {
          const x = r2(first + (i + 1) * keyW - 2.1);
          return (
            <g key={i}>
              <rect x={r2(x - 0.9)} y="16" width="4.2" height="30" fill="#000" opacity="0.35" />
              <rect x={x} y="17.5" width="4.2" height="28.5" fill="#0d0b10" />
              <rect x={x} y="17.5" width="4.2" height="3.4" fill="#3c3844" />
            </g>
          );
        })}
        {/* The felt strip behind the keys. */}
        <rect x="9" y="46" width="382" height="1.8" fill="#5a1220" />

        {/* The panel, left to right: wheels, drawbars, piano, a small display, synth, effects. */}
        <rect x="15" y="58" width="5.4" height="28" rx="1.2" fill="#050406" />
        <rect x="15.8" y="68" width="3.8" height="10" rx="1" fill="#48444f" />
        <rect x="25" y="58" width="5.4" height="28" rx="1.2" fill="#050406" />
        <rect x="25.8" y="62" width="3.8" height="10" rx="1" fill="#48444f" />
        {[44, 118, 182, 234, 306].map((x) => (
          <rect key={x} x={x} y="54" width="0.6" height="40" fill="#34303b" />
        ))}
        {[26, 20, 14, 28, 16, 22, 12, 24, 18].map((len, i) => (
          <g key={i}>
            <rect x={54 + i * 6.6} y="58" width="3.2" height="30" fill="#050406" />
            <rect x={54 + i * 6.6} y={88 - len} width="3.2" height={len} fill="#2e2a35" />
            <rect x={53.6 + i * 6.6} y={86 - len} width="4" height="4.4" rx="0.8" fill={[2, 4, 7].includes(i) ? "#17141c" : "#b9b3a4"} />
          </g>
        ))}
        {knobRow(128, 4, 13, 66)}
        {knobRow(128, 4, 13, 82)}
        <rect x="190" y="60" width="36" height="24" rx="1.2" fill="#07090c" stroke="#050406" strokeWidth="0.6" />
        <rect x="192" y="62" width="32" height="20" fill="#7f95a6" opacity="0.26" />
        <rect x="194" y="76" width="14" height="1.6" fill="#b9c6cf" opacity="0.5" />
        <rect x="194" y="71" width="22" height="1.6" fill="#b9c6cf" opacity="0.34" />
        <rect x="194" y="66" width="10" height="1.6" fill="#b9c6cf" opacity="0.26" />
        {[190, 199.4, 208.8, 218.2].map((x) => (
          <rect key={x} x={x} y="88" width="7.6" height="4" rx="0.8" fill="#2e2a35" />
        ))}
        {knobRow(246, 5, 12, 66)}
        {knobRow(246, 5, 12, 82)}
        {knobRow(318, 6, 11.6, 62, 2.1)}
        {knobRow(318, 6, 11.6, 74, 2.1)}
        {knobRow(318, 6, 11.6, 86, 2.1)}
        {[
          [122, 92, "#b23a3a"],
          [174, 60, "#c98a2e"],
          [240, 92, "#b23a3a"],
          [300, 60, "#c98a2e"],
          [386, 92, "#b23a3a"],
        ].map(([x, t, c]) => (
          <rect key={`${x}-${t}`} x={x} y={t} width="2.4" height="2.4" fill={c} opacity="0.8" />
        ))}
      </g>
      <path d="M10,58H410" stroke="#5c5764" strokeWidth="0.8" />
      <path d="M440,110L410,58" stroke="#34303b" strokeWidth="0.7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ microphone */

// A vocal mic on a straight stand, at its real size against the instruments.
export function Mic() {
  const x = 42;
  return (
    <svg viewBox="0 0 84 360" {...svgProps}>
      <defs>
        <clipPath id="rws-mic-ball">
          <circle cx={x} cy="30" r="9.4" />
        </clipPath>
      </defs>

      {/* Weighted round base. */}
      <Contact cx={x} cy={353} rx={38} ry={6} />
      <ellipse cx={x} cy="351" rx="27" ry="6.2" fill="#040305" />
      <ellipse cx={x} cy="348.8" rx="26.2" ry="5.6" fill="url(#rws-black)" />
      <path d="M17.4,348A26.2,5.6 0 0 1 48,343.4" fill="none" stroke="#6a6474" strokeOpacity="0.7" strokeWidth="0.7" strokeLinecap="round" />
      <ellipse cx={x} cy="347.4" rx="5.4" ry="1.5" fill="#040305" />

      {/* Two-section pole and its clutch. */}
      <rect x={x - 2.1} y="206" width="4.2" height="142" fill="url(#rws-tube)" />
      <rect x={x - 1.4} y="78" width="2.8" height="130" fill="url(#rws-tube)" />
      <rect x={x - 3.8} y="198" width="7.6" height="15" rx="2" fill="url(#rws-black)" />
      <rect x={x - 3.8} y="202" width="7.6" height="0.9" fill="#4a4653" />
      <rect x={x - 3.8} y="205.4" width="7.6" height="0.9" fill="#4a4653" />
      <rect x={x - 3.8} y="208.8" width="7.6" height="0.9" fill="#4a4653" />

      {/* Cable: off the tail, down the pole, away across the floor. */}
      <path
        d="M49,93C55,118 46.6,150 45,184C43.4,226 48,272 45,312C43.4,334 56,344 80,349"
        fill="none"
        stroke="#040305"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M49,93C55,118 46.6,150 45,184C43.4,226 48,272 45,312C43.4,334 56,344 80,349"
        fill="none"
        stroke="#3c3844"
        strokeWidth="0.55"
        strokeLinecap="round"
        transform="translate(-0.55 0)"
      />

      {/* The microphone in its clip, tipped back toward the singer. */}
      <g transform={`rotate(-24 ${x} 78)`}>
        <path d={`M${x - 2.6},78h5.2l-0.5,9h-4.2Z`} fill="url(#rws-handle)" />
        <rect x={x - 2.2} y="87" width="4.4" height="5.6" rx="0.8" fill="#1f1c25" />
        <path d={`M${x - 3},78h6L${x + 4.3},42h-8.6Z`} fill="url(#rws-handle)" />
        <path d={`M${x - 4.2},77h8.4l-0.7,-14h-7Z`} fill="#0d0b10" />
        <path d={`M${x - 4.2},77l0.7,-14`} stroke="#4a4653" strokeWidth="0.7" />
        <circle cx={x} cy="78" r="3.2" fill="url(#rws-ball)" stroke="#060508" strokeWidth="0.5" />
        <rect x={x - 4.8} y="39.4" width="9.6" height="3.4" rx="0.9" fill="url(#rws-tube)" />
        <circle cx={x} cy="30" r="9.4" fill="url(#rws-ball)" />
        <circle cx={x} cy="30" r="9.4" fill="url(#rws-mesh)" />
        <g clipPath="url(#rws-mic-ball)">
          <rect x={x - 10} y="29.4" width="20" height="2.8" fill="url(#rws-tube)" />
          <path d={`M${x - 10},35Q${x},44 ${x + 10},35V42H${x - 10}Z`} fill="#000" opacity="0.4" />
        </g>
        <ellipse cx={x - 3.2} cy="25.4" rx="3.4" ry="2.4" fill="url(#rws-sheen)" opacity="0.8" transform={`rotate(-30 ${x - 3.2} 25.4)`} />
        <circle cx={x} cy="30" r="9.4" fill="none" stroke="#0c0d10" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ the room: backline and riser */

// The guitarist's combo: tolex, a dark grille, a strip of controls and a pilot light.
function Combo({ x, y }) {
  return (
    <g>
      <Contact cx={x + 75} cy={y + 131} rx={92} ry={6} />
      <rect x={x} y={y} width="150" height="130" rx="4" fill="url(#rws-tolex)" />
      <rect x={x + 9} y={y + 34} width="132" height="88" rx="2" fill="url(#rws-cloth)" />
      <circle cx={x + 44} cy={y + 78} r="34" fill="#000" opacity="0.34" />
      <circle cx={x + 106} cy={y + 78} r="34" fill="#000" opacity="0.34" />
      <circle cx={x + 44} cy={y + 78} r="11" fill="#000" opacity="0.3" />
      <circle cx={x + 106} cy={y + 78} r="11" fill="#000" opacity="0.3" />
      <rect x={x + 9} y={y + 34} width="132" height="88" rx="2" fill="none" stroke="#8c7d58" strokeOpacity="0.28" strokeWidth="0.8" />
      <rect x={x + 9} y={y + 10} width="132" height="17" rx="1.4" fill="#0b090d" />
      <rect x={x + 9} y={y + 10} width="132" height="1" fill="#6a6474" opacity="0.4" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <circle cx={x + 24 + i * 15} cy={y + 18.6} r="3.6" fill="url(#rws-ball)" />
          <path d={`M${x + 24 + i * 15},${y + 18.6}l${(i % 3) - 1.3},-2.8`} stroke="#0b090d" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      ))}
      <circle cx={x + 128} cy={y + 18.6} r="4.4" fill="#d2552a" opacity="0.16" />
      <circle cx={x + 128} cy={y + 18.6} r="1.9" fill="#d2552a" opacity="0.9" />
      {/* The top edge catches the light. */}
      <rect x={x + 3} y={y + 0.6} width="144" height="1.1" fill="#b99b7a" opacity="0.26" />
      <rect x={x + 50} y={y - 3} width="50" height="3.8" rx="1.9" fill="#050406" />
      {[
        [x, y],
        [x + 140, y],
        [x, y + 120],
        [x + 140, y + 120],
      ].map(([cx, cy]) => (
        <rect key={`${cx}-${cy}`} x={cx} y={cy} width="10" height="10" rx="3" fill="#24212b" />
      ))}
    </g>
  );
}

// The bass rig: a head on a 4 x 10 cabinet behind a steel grille.
function BassRig({ x, y }) {
  return (
    <g>
      <Contact cx={x + 66} cy={y + 191} rx={84} ry={6} />
      <rect x={x} y={y + 38} width="132" height="152" rx="4" fill="url(#rws-tolex)" />
      <rect x={x + 8} y={y + 46} width="116" height="136" rx="2" fill="url(#rws-grate)" />
      {[
        [x + 37, y + 80],
        [x + 95, y + 80],
        [x + 37, y + 146],
        [x + 95, y + 146],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="26" fill="#000" opacity="0.4" />
      ))}
      <rect x={x + 8} y={y + 46} width="116" height="136" rx="2" fill="none" stroke="#6a6474" strokeOpacity="0.3" strokeWidth="0.8" />
      <rect x={x + 3} y={y + 38.6} width="126" height="1.1" fill="#9a8fa8" opacity="0.22" />
      {[
        [x, y + 38],
        [x + 122, y + 38],
        [x, y + 180],
        [x + 122, y + 180],
      ].map(([cx, cy]) => (
        <rect key={`${cx}-${cy}`} x={cx} y={cy} width="10" height="10" rx="3" fill="#24212b" />
      ))}
      <rect x={x + 4} y={y} width="124" height="37" rx="3" fill="url(#rws-tolex)" />
      <rect x={x + 7} y={y + 0.6} width="118" height="1.1" fill="#9a8fa8" opacity="0.24" />
      <rect x={x + 11} y={y + 10} width="110" height="18" rx="1.4" fill="#17151b" />
      <rect x={x + 11} y={y + 10} width="110" height="1" fill="#6a6474" opacity="0.45" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <circle cx={x + 24 + i * 13.5} cy={y + 19} r="3.6" fill="url(#rws-ball)" />
          <path d={`M${x + 24 + i * 13.5},${y + 19}l${1.5 - (i % 3)},-2.8`} stroke="#0b090d" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      ))}
      <circle cx={x + 109} cy={y + 19} r="1.7" fill="#d9b25a" opacity="0.85" />
    </g>
  );
}

// Everything that does not move and cannot be chosen: the riser, and the two amps against the
// back wall, the guitar's on the left and the bass rig on the right, behind the piano.
export function Scenery({ className }) {
  return (
    <svg viewBox="0 0 720 840" className={className} {...svgProps}>
      <g transform="translate(22 512) scale(0.82)">
        <Combo x={0} y={0} />
      </g>
      <g transform="translate(606 452) scale(0.82)">
        <BassRig x={0} y={0} />
      </g>

      {/* Drum riser: a low black platform, its top catching the kit's lamp. */}
      <Contact cx={354} cy={662} rx={240} ry={12} a={0.9} />
      <path d="M180,612H530L556,636H154Z" fill="url(#rws-riser)" />
      <path d="M154,636H556V656H154Z" fill="#0a080b" />
      <path d="M154,636H556V637.2H154Z" fill="#d3b48c" opacity="0.3" />

      {/* What the kit's light does on a dark, polished floor. */}
      <g mask="url(#rws-glint-mask)">
        <rect x="140" y="656" width="440" height="150" fill="url(#rws-glint)" />
      </g>
    </svg>
  );
}
