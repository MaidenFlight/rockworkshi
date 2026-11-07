// Share links: a whole beat packed into one URL parameter, so a teacher can send a groove or a
// student can send their song. Only the music goes in (tempo, meter, swing, parts, song, the
// beat's name), never anything about the person or this browser's mix. Reading a link rebuilds
// the beat through sanitizeBeat, so a damaged or hand-edited link still opens something playable.
import { GRID_ORDER } from "./kit.js";
import { BEAT_VERSION, sanitizeBeat } from "./beat.js";

export const SHARE_PARAM = "beat";

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  if (typeof text !== "string" || !/^[\w-]{1,20000}$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

// The beat as a compact string: rows of digits (one per step) for the pieces a part uses.
export function encodeBeat(beat) {
  const index = new Map(beat.parts.map((p, i) => [p.id, i]));
  const packed = {
    v: BEAT_VERSION,
    n: beat.name || undefined,
    t: beat.tempo,
    m: beat.meter,
    s: beat.swing || undefined,
    u: beat.swing && beat.swingUnit === 16 ? 16 : undefined,
    p: beat.parts.map((p) => [p.name, Object.fromEntries(GRID_ORDER.filter((k) => p.notes[k]).map((k) => [k, p.notes[k].join("")]))]),
    g: beat.song.map((b) => (b.crash ? [index.get(b.part), b.bars, 1] : [index.get(b.part), b.bars])),
  };
  return toBase64Url(JSON.stringify(packed));
}

// Null when the text isn't a beat at all.
export function decodeBeat(text) {
  const json = fromBase64Url(text);
  if (!json) return null;
  let packed;
  try {
    packed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!packed || typeof packed !== "object" || !Array.isArray(packed.p)) return null;
  const parts = packed.p.slice(0, 64).map((entry, i) => {
    const [name, rows] = Array.isArray(entry) ? entry : [];
    const notes = {};
    if (rows && typeof rows === "object") {
      for (const [piece, digits] of Object.entries(rows)) {
        if (typeof digits === "string" && /^[0-3]{1,64}$/.test(digits)) notes[piece] = [...digits].map(Number);
      }
    }
    return { id: `s${i}`, name, notes };
  });
  const song = (Array.isArray(packed.g) ? packed.g : []).slice(0, 256).map((b) => {
    const [part, bars, crash] = Array.isArray(b) ? b : [];
    return { part: `s${part}`, bars, crash: crash === 1 };
  });
  return sanitizeBeat({ name: packed.n, tempo: packed.t, meter: packed.m, swing: packed.s, swingUnit: packed.u, parts, song });
}

export function shareUrl(beat, origin, path) {
  const url = new URL(path, origin);
  url.searchParams.set(SHARE_PARAM, encodeBeat(beat));
  return url.toString();
}
