// A beat as a Standard MIDI File, for taking it into GarageBand, a DAW or another drum program.
// The notes come from the same Sequencer that plays the beat, so swing, crashes and every part
// land exactly where they are heard. General MIDI drums on channel 10, 480 ticks a quarter note.
import { PIECE_BY_ID } from "./kit.js";
import { meterOf, songLength } from "./beat.js";
import { Sequencer } from "./sequencer.js";

const PPQ = 480;
const VELOCITY = [0, 46, 92, 120];
const NOTE_TICKS = 60;
const TIME_SIGNATURE = { "4/4": [4, 2, 24], "3/4": [3, 2, 24], "12/8": [12, 3, 36], "6/8": [6, 3, 36] };

function vlq(n) {
  const bytes = [n & 0x7f];
  for (let v = n >>> 7; v > 0; v >>>= 7) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

// What to write: the whole song once, or (with `part`) that part for `bars` bars.
export function beatToMidi(beat, { part = null, bars = 4 } = {}) {
  const meter = meterOf(beat);
  const quarterPerBeat = meter.pulse === "dotted" ? 1.5 : 1;
  const ticksPerSecond = (PPQ * quarterPerBeat * beat.tempo) / 60;
  const useSong = !part && songLength(beat) > 0;
  const mode = useSong ? { type: "song", loop: false, from: 0 } : { type: "part", part: part || beat.parts[0].id };
  const limit = useSong ? songLength(beat) : Math.max(1, bars);
  const seq = new Sequencer(() => beat, mode, 0);

  const notes = [];
  let endTick = 0;
  for (let e = seq.take(); e; e = seq.take()) {
    if (e.type === "end") {
      endTick = Math.round(e.t * ticksPerSecond);
      break;
    }
    if (e.bar >= limit) {
      endTick = Math.round(e.t * ticksPerSecond);
      break;
    }
    if (e.type !== "hit") continue;
    notes.push({ tick: Math.round(e.t * ticksPerSecond), note: PIECE_BY_ID[e.piece].midi, velocity: VELOCITY[e.level] });
  }

  const events = [];
  for (const n of notes) {
    events.push({ tick: n.tick, order: 1, bytes: [0x99, n.note, n.velocity] });
    events.push({ tick: n.tick + NOTE_TICKS, order: 0, bytes: [0x89, n.note, 0] });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const name = new TextEncoder().encode(beat.name || "Rock Works beat");
  const usPerQuarter = Math.round(60000000 / (beat.tempo * quarterPerBeat));
  const [num, pow, clocks] = TIME_SIGNATURE[meter.id];
  const track = [
    0, 0xff, 0x03, ...vlq(name.length), ...name,
    0, 0xff, 0x51, 0x03, (usPerQuarter >>> 16) & 0xff, (usPerQuarter >>> 8) & 0xff, usPerQuarter & 0xff,
    0, 0xff, 0x58, 0x04, num, pow, clocks, 8,
  ];
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  track.push(...vlq(Math.max(0, endTick - last)), 0xff, 0x2f, 0x00);

  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >>> 8) & 0xff, PPQ & 0xff];
  return new Uint8Array([...header, 0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track]);
}

// A file name from the beat's name: "my-beat.mid".
export function midiFileName(beat) {
  const slug = (beat.name || "rock-works-beat")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 40);
  return `${slug || "rock-works-beat"}.mid`;
}
