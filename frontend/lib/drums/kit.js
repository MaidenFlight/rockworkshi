// The drum kit: thirteen sounds from DRSKit, an acoustic kit recorded with 13 mics by Jes Eiler of
// DRSDrums and the DrumGizmo team (CC BY 4.0, drumgizmo.org). Each hit is mixed from the drum's
// close mics, the overheads and the room mics and rendered to a short MP3 by
// scripts/make-drum-kit.mjs; see docs/beat-maker.md.
//
// Pure data and small helpers only: nothing here touches the audio or the DOM, so the
// sequencer, the grid and the tests can all read it.

// How hard a note is played. 0 is no note. The grid, the pads, the sequencer and stored beats all
// use these numbers.
export const LEVEL = { off: 0, ghost: 1, normal: 2, accent: 3 };
export const LEVEL_NAMES = ["Off", "Ghost", "Hit", "Accent"];

// The four places on the kit, in the order the pads lay them out. `piece` ids are load-bearing:
// stored beats, share links and MIDI export use them.
export const GROUPS = [
  { id: "cymbals", name: "Cymbals" },
  { id: "toms", name: "Toms" },
  { id: "hats", name: "Hi-hat" },
  { id: "snare", name: "Snare" },
  { id: "kick", name: "Kick" },
];

// `files`: the recordings for each layer, round robins in order. A level without its own layer
// plays the main one louder or softer (`ACCENT_GAIN`, `GHOST_GAIN`). `layerDb`: how loud a piece's
// own soft and hard recordings are against its main ones, measured from the shipped files (the
// loudest 100 ms, averaged across round robins), so a MIDI velocity can play them at the right level. `voices`: how many hits of
// one sound may ring at once before the oldest fades. `chokes`: what this hit silences, as a real
// closing hi-hat stops an open one. `code`: the physical key (KeyboardEvent.code) that plays it;
// `label` is what a QWERTY keyboard prints on that key.
export const PIECES = [
  { id: "crash", name: "Crash", short: "Crash", group: "cymbals", code: "KeyW", label: "W", midi: 49, voices: 3, files: { main: ["crash-1"], accent: ["crash-hard-1"] }, layerDb: { accent: 4.9 } },
  { id: "ride", name: "Ride", short: "Ride", group: "cymbals", code: "KeyO", label: "O", midi: 51, voices: 4, files: { main: ["ride-1", "ride-2"], accent: ["ride-hard-1"] }, layerDb: { accent: 3.4 } },
  { id: "rideBell", name: "Ride bell", short: "Bell", group: "cymbals", code: "KeyI", label: "I", midi: 53, voices: 3, files: { main: ["ride-bell-1", "ride-bell-2"] } },
  { id: "hatOpen", name: "Open hi-hat", short: "Open hat", group: "hats", code: "KeyS", label: "S", midi: 46, voices: 2, files: { main: ["hat-open-1", "hat-open-2"] } },
  {
    id: "hatClosed",
    name: "Closed hi-hat",
    short: "Closed hat",
    group: "hats",
    code: "KeyD",
    label: "D",
    midi: 42,
    voices: 2,
    chokes: ["hatOpen"],
    files: {
      ghost: ["hat-closed-soft-1", "hat-closed-soft-2"],
      main: ["hat-closed-1", "hat-closed-2", "hat-closed-3"],
      accent: ["hat-closed-hard-1", "hat-closed-hard-2"],
    },
    layerDb: { ghost: -10.8, accent: 4.6 },
  },
  { id: "hatPedal", name: "Hi-hat pedal", short: "Pedal", group: "hats", code: "KeyA", label: "A", midi: 44, voices: 2, chokes: ["hatOpen"], files: { main: ["hat-pedal-1", "hat-pedal-2"] } },
  { id: "tom1", name: "High tom", short: "Tom 1", group: "toms", code: "KeyK", label: "K", midi: 48, voices: 3, files: { main: ["tom-1-1", "tom-1-2"], accent: ["tom-1-hard-1"] }, layerDb: { accent: 3.1 } },
  { id: "tom2", name: "Mid tom", short: "Tom 2", group: "toms", code: "KeyL", label: "L", midi: 45, voices: 3, files: { main: ["tom-2-1", "tom-2-2"], accent: ["tom-2-hard-1"] }, layerDb: { accent: 3.2 } },
  {
    id: "floorTom",
    name: "Floor tom",
    short: "Floor",
    group: "toms",
    code: "Semicolon",
    label: ";",
    midi: 41,
    voices: 3,
    files: { main: ["floor-tom-1", "floor-tom-2"], accent: ["floor-tom-hard-1"] },
    layerDb: { accent: 3.0 },
  },
  { id: "rimshot", name: "Rimshot", short: "Rimshot", group: "snare", code: "KeyR", label: "R", midi: 40, voices: 3, files: { main: ["rimshot-1", "rimshot-2"] } },
  {
    id: "snare",
    name: "Snare",
    short: "Snare",
    group: "snare",
    code: "KeyF",
    label: "F",
    midi: 38,
    voices: 4,
    files: { ghost: ["snare-soft-1", "snare-soft-2"], main: ["snare-1", "snare-2", "snare-3"], accent: ["snare-hard-1", "snare-hard-2"] },
    layerDb: { ghost: -12, accent: 2.8 },
  },
  { id: "sidestick", name: "Side-stick", short: "Side-stick", group: "snare", code: "KeyE", label: "E", midi: 37, voices: 3, files: { main: ["sidestick-1", "sidestick-2"] } },
  {
    id: "kick",
    name: "Kick",
    short: "Kick",
    group: "kick",
    code: "KeyJ",
    label: "J",
    midi: 36,
    voices: 3,
    files: { ghost: ["kick-soft-1", "kick-soft-2"], main: ["kick-1", "kick-2", "kick-3"], accent: ["kick-hard-1", "kick-hard-2"] },
    layerDb: { ghost: -5.8, accent: 2.8 },
  },
];

export const PIECE_IDS = PIECES.map((p) => p.id);
export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));
export const PIECE_BY_CODE = Object.fromEntries(PIECES.map((p) => [p.code, p]));

// The grid's rows, top to bottom, the way drum parts are written: cymbals high, kick low.
export const GRID_ORDER = ["crash", "ride", "rideBell", "hatOpen", "hatClosed", "hatPedal", "tom1", "tom2", "floorTom", "rimshot", "snare", "sidestick", "kick"];

// Pads by place on the kit.
export function piecesIn(group) {
  return PIECES.filter((p) => p.group === group);
}

export const SAMPLE_DIR = "/samples/drums";
export const sampleUrl = (file) => `${SAMPLE_DIR}/${file}.mp3`;

// Every recording the kit can play, for loading ahead of the first tap.
export function allSampleFiles() {
  return PIECES.flatMap((p) => Object.values(p.files).flat());
}

export const ACCENT_GAIN = 10 ** (3 / 20); // +3 dB where there's no harder recording
export const GHOST_GAIN = 10 ** (-11 / 20); // -11 dB where there's no softer one

// Which recordings and how loud, for a level. A piece's own soft or hard layer is used where it
// has one; otherwise the main layer is turned up or down.
export function layerFor(piece, level) {
  const files = piece.files;
  if (level === LEVEL.accent) return files.accent ? { files: files.accent, gain: 1 } : { files: files.main, gain: ACCENT_GAIN };
  if (level === LEVEL.ghost) return files.ghost ? { files: files.ghost, gain: 1 } : { files: files.main, gain: GHOST_GAIN };
  return { files: files.main, gain: 1 };
}

// How loud a level's recordings already are against the main ones (1 is the same).
export function layerLevel(piece, level) {
  if (level === LEVEL.accent) return piece.files.accent ? 10 ** ((piece.layerDb?.accent ?? 0) / 20) : ACCENT_GAIN;
  if (level === LEVEL.ghost) return piece.files.ghost ? 10 ** ((piece.layerDb?.ghost ?? 0) / 20) : GHOST_GAIN;
  return 1;
}

// Picks a round robin: never the one just played, so a fast roll doesn't sound like a machine gun.
export function nextRoundRobin(count, last, random = Math.random) {
  if (count <= 1) return 0;
  const pick = Math.floor(random() * (count - 1));
  return last === undefined || last === null || pick < last ? pick : pick + 1;
}
