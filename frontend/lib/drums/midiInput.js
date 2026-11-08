// Playing the kit from a MIDI drum kit, pad controller or keyboard, through the browser's Web MIDI.
//
// The top half is pure: which note plays which drum, and how a velocity becomes a recording and a
// volume. `MidiLink` below it holds the connection (permission, devices coming and going) and is a
// small store for React. Neither touches the audio or the DOM: the page hands each note to the engine.
//
// Listens to every device and every channel: pads and keyboards send on channel 1, drum modules on 10.
import { LEVEL, PIECE_BY_ID, PIECE_IDS, layerLevel } from "./kit.js";
import { VELOCITY } from "./midi.js";

// "Play nothing": a note someone has silenced.
export const NO_DRUM = "none";

// What a note plays out of the box. General MIDI's drum notes, which nearly every pad controller and
// electronic kit starts from, folded onto this kit's thirteen sounds, plus the notes Roland-style
// modules send for a rim or a cymbal's edge. Anything else can be set on the page.
export const DEFAULT_NOTES = Object.freeze({
  22: "hatClosed", // closed hi-hat, edge
  26: "hatOpen", // open hi-hat, edge
  35: "kick",
  36: "kick",
  37: "sidestick",
  38: "snare",
  39: "rimshot", // General MIDI's hand clap: there is no clap on this kit
  40: "rimshot", // the snare's rim
  41: "floorTom",
  42: "hatClosed",
  43: "floorTom", // the third tom on most electronic kits
  44: "hatPedal",
  45: "tom2",
  46: "hatOpen",
  47: "tom2", // the second tom's rim
  48: "tom1",
  49: "crash",
  50: "tom1", // the first tom's rim
  51: "ride",
  52: "crash", // china, or the second crash's edge
  53: "rideBell",
  55: "crash", // splash, or the crash's edge
  57: "crash", // the second crash
  58: "floorTom", // the third tom's rim
  59: "ride", // the ride's edge
});

// A note-on in a raw MIDI message, or null. Clock ticks, note-offs and controllers all land here
// too, and a note-on with velocity 0 is how many devices say note-off.
export function noteOn(data) {
  if (!data || data.length < 3) return null;
  const [status, note, velocity] = data;
  if ((status & 0xf0) !== 0x90 || velocity === 0) return null;
  return { note, velocity, channel: (status & 0x0f) + 1 };
}

// The drum a note plays, or null. `notes` holds this browser's own changes.
export function drumForNote(note, notes) {
  const chosen = notes?.[note];
  if (chosen === NO_DRUM) return null;
  return chosen || DEFAULT_NOTES[note] || null;
}

// The level changes halfway between the velocities the MIDI download writes for each level, so a
// file played back in records the same ghosts and accents it was written with.
const GHOST_BELOW = (VELOCITY[LEVEL.ghost] + VELOCITY[LEVEL.normal]) / 2;
const ACCENT_FROM = (VELOCITY[LEVEL.normal] + VELOCITY[LEVEL.accent]) / 2;

// How a velocity plays: `level` picks the recording (and is what Record writes down), `gain` sets
// the volume on top of it. Volume follows the General MIDI curve, the square of the velocity, with
// a normal hit at 92 as 1. Dividing by how loud the chosen recording already is keeps that one
// smooth line from the softest tap to the hardest hit, across the changes of recording.
export function hitForVelocity(piece, velocity) {
  const level = velocity < GHOST_BELOW ? LEVEL.ghost : velocity < ACCENT_FROM ? LEVEL.normal : LEVEL.accent;
  const want = (velocity / VELOCITY[LEVEL.normal]) ** 2;
  return { level, gain: want / layerLevel(PIECE_BY_ID[piece], level) };
}

// What this browser keeps: whether to reconnect on the next visit, and the notes changed by hand.
// A change that matches the standard note isn't kept, so resetting has nothing to leave behind.
export const DEFAULT_MIDI_PREFS = Object.freeze({ on: false, notes: Object.freeze({}) });

export function sanitizeMidiPrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const notes = {};
  for (const [key, drum] of Object.entries(r.notes && typeof r.notes === "object" ? r.notes : {})) {
    const note = Number(key);
    if (!Number.isInteger(note) || note < 0 || note > 127) continue;
    if (drum !== NO_DRUM && !PIECE_IDS.includes(drum)) continue;
    if ((DEFAULT_NOTES[note] || NO_DRUM) !== drum) notes[note] = drum;
  }
  return { on: r.on === true, notes };
}

export const MIDI_OFF = Object.freeze({ status: "off", devices: Object.freeze([]) });
const MIDI_UNSUPPORTED = Object.freeze({ status: "unsupported", devices: Object.freeze([]) });

const nameOf = (port) => (port.name || "").trim() || (port.manufacturer || "").trim() || "MIDI device";
const noop = () => {};

// The connection. `status` is one of: unsupported, off, asking (the browser's prompt is up),
// blocked, failed, on. `nav` is the browser's navigator, or a stand-in in the tests.
export class MidiLink {
  constructor(nav) {
    this.nav = nav;
    this.state = typeof nav?.requestMIDIAccess === "function" ? MIDI_OFF : MIDI_UNSUPPORTED;
    this.listeners = new Set();
    this.access = null;
    this.ports = new Set();
    this.attempt = 0; // turning off while a connection is on its way cancels it
    this.notes = {};
    this.onNote = null;
    this.last = null;
    this.lastListeners = new Set();
  }

  // ---- for React's useSyncExternalStore ----

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  // The last note has its own store: only the line that shows it redraws on every hit.
  subscribeNote = (fn) => {
    this.lastListeners.add(fn);
    return () => this.lastListeners.delete(fn);
  };

  getLastNote = () => this.last;

  setState(state) {
    this.state = state;
    this.listeners.forEach((fn) => fn());
  }

  setLast(last) {
    this.last = last;
    this.lastListeners.forEach((fn) => fn());
  }

  // ---- settings ----

  setNotes(notes) {
    this.notes = notes || {};
  }

  // Called with { note, velocity, channel, drum } for every note-on; `drum` is null if it plays nothing.
  setNoteHandler(fn) {
    this.onNote = fn;
  }

  // ---- connecting ----

  // Opens MIDI, showing the browser's permission prompt if it hasn't been answered yet, so this is
  // for a button press. Resolves true once connected.
  async connect() {
    const { status } = this.state;
    if (status === "on") return true;
    if (status === "unsupported" || status === "asking") return false;
    this.attempt += 1;
    const attempt = this.attempt;
    this.setState({ status: "asking", devices: [] });
    let access;
    try {
      access = await this.nav.requestMIDIAccess({ sysex: false });
    } catch (error) {
      if (attempt !== this.attempt) return false;
      const refused = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      this.setState({ status: refused ? "blocked" : "failed", devices: [] });
      return false;
    }
    if (attempt !== this.attempt) return false;
    this.access = access;
    access.onstatechange = this.sync;
    this.setState({ status: "on", devices: [] });
    this.sync();
    return true;
  }

  // For a return visit: reconnects only if the browser already allows it, so opening the page
  // never puts up a prompt.
  async resume() {
    if (this.state.status !== "off") return false;
    const attempt = this.attempt;
    let allowed = false;
    try {
      allowed = (await this.nav.permissions.query({ name: "midi", sysex: false })).state === "granted";
    } catch {
      // A browser that can't say gets the button.
    }
    if (!allowed || attempt !== this.attempt) return false;
    return this.connect();
  }

  // Lets go of every device, so another program can use it.
  disconnect() {
    this.attempt += 1;
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    for (const port of [...this.ports]) this.release(port);
    if (this.last) this.setLast(null);
    if (this.state.status !== "unsupported") this.setState(MIDI_OFF);
  }

  // Runs when a device is plugged in or pulled out, and once on connecting.
  sync = () => {
    if (!this.access) return;
    const present = new Set();
    for (const port of this.access.inputs.values()) {
      if (port.state !== "connected") continue;
      present.add(port);
      if (!this.ports.has(port)) {
        this.ports.add(port);
        port.onmidimessage = this.receive; // setting this opens the port
      }
    }
    for (const port of [...this.ports]) if (!present.has(port)) this.release(port);
    const devices = [...this.ports].map((port) => ({ id: port.id, name: nameOf(port) }));
    const before = this.state.devices;
    const same = before.length === devices.length && before.every((d, i) => d.id === devices[i].id && d.name === devices[i].name);
    if (!same) this.setState({ status: "on", devices });
  };

  release(port) {
    this.ports.delete(port);
    port.onmidimessage = null;
    Promise.resolve()
      .then(() => port.close())
      .catch(noop);
  }

  receive = (event) => {
    const note = noteOn(event.data);
    if (!note) return;
    const played = { ...note, drum: drumForNote(note.note, this.notes) };
    this.setLast(played);
    this.onNote?.(played);
  };
}
