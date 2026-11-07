// Grooves and fills to start from: the standard beats every drummer learns, written out by
// hand for this kit. Each row is one bar, a character per grid step:
//   -  nothing   g  ghost note   x  hit   X  accent
// 4/4 has sixteen steps (1 e & a 2 e & a ...), 3/4 twelve, 12/8 twelve and 6/8 six (eighth-note
// triplets, three to a beat). `tempo` and `swing` are where each one sits naturally.
import { BEAT_VERSION, METERS, stepsPerBar } from "./beat.js";

const CHAR_LEVEL = { "-": 0, g: 1, x: 2, X: 3 };

export const STYLES = ["Rock", "Pop", "Ballad", "Half-time", "Shuffle", "Funk", "Punk", "Dance", "Reggae", "Hip-hop", "Waltz", "Fills"];

export const GROOVES = [
  {
    id: "rock-8ths",
    name: "Rock 8ths",
    style: "Rock",
    meter: "4/4",
    tempo: 100,
    note: "The first beat to learn: hi-hat eighths, snare on 2 and 4.",
    rows: {
      hatClosed: "X-x-X-x-X-x-X-x-",
      snare: "----X-------X---",
      kick: "x-------x-x-----",
    },
  },
  {
    id: "rock-open-hat",
    name: "Rock, open hat",
    style: "Rock",
    meter: "4/4",
    tempo: 110,
    note: "The hi-hat opens on the last & and closes on the 1.",
    rows: {
      hatClosed: "X-x-X-x-X-x-X---",
      hatOpen: "--------------x-",
      snare: "----X-------X---",
      kick: "x-----x-x-------",
    },
  },
  {
    id: "rock-ride",
    name: "Ride and rimshots",
    style: "Rock",
    meter: "4/4",
    tempo: 120,
    note: "Bigger: eighths on the ride, rimshots on the backbeat.",
    rows: {
      ride: "x-x-x-x-x-x-x-x-",
      rimshot: "----X-------X---",
      kick: "x-x-----x-x-----",
      hatPedal: "----x-------x---",
    },
  },
  {
    id: "hard-rock",
    name: "Hard rock",
    style: "Rock",
    meter: "4/4",
    tempo: 128,
    note: "Washy open hats and kick eighths for a loud chorus.",
    rows: {
      hatOpen: "x-x-x-x-x-x-x-x-",
      rimshot: "----X-------X---",
      kick: "x-x-x-x-x-x-x-x-",
    },
  },
  {
    id: "pop-16ths",
    name: "Pop sixteenths",
    style: "Pop",
    meter: "4/4",
    tempo: 96,
    note: "One hand on sixteenths, the e and a played softer.",
    rows: {
      hatClosed: "XgxgXgxgXgxgXgxg",
      snare: "----X-------X---",
      kick: "x-------x-x-----",
    },
  },
  {
    id: "motown",
    name: "Four on the snare",
    style: "Pop",
    meter: "4/4",
    tempo: 120,
    note: "The snare on every beat, the old soul way.",
    rows: {
      hatClosed: "x-x-x-x-x-x-x-x-",
      snare: "x---X---x---X---",
      kick: "x-----x-x-------",
    },
  },
  {
    id: "ballad",
    name: "Side-stick ballad",
    style: "Ballad",
    meter: "4/4",
    tempo: 72,
    note: "Soft hats and a side-stick (cross-stick) on 2 and 4.",
    rows: {
      hatClosed: "x-g-x-g-x-g-x-g-",
      sidestick: "----x-------x---",
      kick: "x-----x-x-------",
    },
  },
  {
    id: "half-time",
    name: "Half-time",
    style: "Half-time",
    meter: "4/4",
    tempo: 140,
    note: "The snare moves to beat 3, so the song feels half as fast.",
    rows: {
      hatClosed: "x-x-x-x-x-x-x-x-",
      snare: "--------X-------",
      kick: "x-----x---x-----",
    },
  },
  {
    id: "shuffle",
    name: "Rock shuffle",
    style: "Shuffle",
    meter: "12/8",
    tempo: 104,
    note: "Long-short eighths: the first and last of each triplet.",
    rows: {
      hatClosed: "X-xX-xX-xX-x",
      snare: "---X-----X--",
      kick: "x-----x-x---",
    },
  },
  {
    id: "slow-blues",
    name: "Slow blues",
    style: "Shuffle",
    meter: "12/8",
    tempo: 56,
    note: "All twelve triplets on the ride, the foot on 2 and 4.",
    rows: {
      ride: "XxxXxxXxxXxx",
      snare: "---X-----X--",
      kick: "x-----x-----",
      hatPedal: "---x-----x--",
    },
  },
  {
    id: "funk",
    name: "Funk with ghost notes",
    style: "Funk",
    meter: "4/4",
    tempo: 98,
    note: "Quiet snare notes between the backbeats carry the groove.",
    rows: {
      hatClosed: "XgxgXgxgXgxgXgxg",
      snare: "----X--g-g--X--g",
      kick: "x-x-------x--x--",
    },
  },
  {
    id: "punk",
    name: "Punk",
    style: "Punk",
    meter: "4/4",
    tempo: 180,
    note: "Fast and simple: kick on the beat, snare on every &.",
    rows: {
      hatClosed: "x-x-x-x-x-x-x-x-",
      snare: "--X---X---X---X-",
      kick: "x---x---x---x---",
    },
  },
  {
    id: "four-floor",
    name: "Four on the floor",
    style: "Dance",
    meter: "4/4",
    tempo: 120,
    note: "Kick on every beat and the hi-hat opening on the &s.",
    rows: {
      hatClosed: "x---x---x---x---",
      hatOpen: "--x---x---x---x-",
      snare: "----X-------X---",
      kick: "x---x---x---x---",
    },
  },
  {
    id: "one-drop",
    name: "One drop",
    style: "Reggae",
    meter: "4/4",
    tempo: 76,
    swing: 30,
    note: "Kick and rimshot together on beat 3 only, eighths swung a little.",
    rows: {
      hatClosed: "x-x-x-x-x-x-x-x-",
      rimshot: "--------X-------",
      kick: "--------x-------",
    },
  },
  {
    id: "boom-bap",
    name: "Boom bap",
    style: "Hip-hop",
    meter: "4/4",
    tempo: 90,
    swing: 35,
    swingUnit: 16,
    note: "A laid-back hip-hop beat with a little sixteenth swing.",
    rows: {
      hatClosed: "x-x-x-x-x-x-x-x-",
      snare: "----X-------X---",
      kick: "x------xx-x-----",
    },
  },
  {
    id: "waltz",
    name: "Waltz",
    style: "Waltz",
    meter: "3/4",
    tempo: 120,
    note: "Boom, chick, chick: three beats to the bar.",
    rows: {
      hatClosed: "x-x-x-x-x-x-",
      snare: "----x---x---",
      kick: "x-----------",
    },
  },
  {
    id: "six-eight",
    name: "6/8 ballad",
    style: "Ballad",
    meter: "6/8",
    tempo: 52,
    note: "Two big beats, each split in three.",
    rows: {
      hatClosed: "Xxxxxx",
      snare: "---X--",
      kick: "x----x",
    },
  },
  {
    id: "fill-snare",
    name: "Snare fill on 4",
    style: "Fills",
    meter: "4/4",
    tempo: 100,
    fill: true,
    note: "Three beats of groove, then four sixteenths on the snare.",
    rows: {
      hatClosed: "x-x-x-x-x-x-----",
      snare: "----X-------xxxX",
      kick: "x-------x-x-----",
    },
  },
  {
    id: "fill-toms",
    name: "Down the toms",
    style: "Fills",
    meter: "4/4",
    tempo: 100,
    fill: true,
    note: "Sixteenths from the snare across the toms in the last two beats.",
    rows: {
      hatClosed: "x-x-x-x---------",
      snare: "----X---xxxx----",
      tom1: "------------xx--",
      tom2: "--------------x-",
      floorTom: "---------------x",
      kick: "x-------x-------",
    },
  },
  {
    id: "fill-around",
    name: "Around the kit",
    style: "Fills",
    meter: "4/4",
    tempo: 100,
    fill: true,
    note: "A whole bar of eighths: snare, high tom, mid tom, floor tom.",
    rows: {
      snare: "X-x-------------",
      tom1: "----x-x---------",
      tom2: "--------x-x-----",
      floorTom: "------------x-x-",
      kick: "x---x---x---x---",
    },
  },
  {
    id: "fill-roll",
    name: "Build-up roll",
    style: "Fills",
    meter: "4/4",
    tempo: 100,
    fill: true,
    note: "Sixteenths on the snare for a bar, getting louder.",
    rows: {
      snare: "ggggxxxxxxxxXXXX",
      kick: "x---x---x---x---",
    },
  },
  {
    id: "fill-triplet",
    name: "Triplet fill",
    style: "Fills",
    meter: "12/8",
    tempo: 104,
    fill: true,
    note: "For a shuffle: triplets on the snare and toms.",
    rows: {
      hatClosed: "X-xX-x------",
      snare: "------xxx---",
      tom1: "---------xx-",
      floorTom: "-----------x",
      kick: "x-----x-----",
    },
  },
  {
    id: "count-in",
    name: "Stick count-in",
    style: "Fills",
    meter: "4/4",
    tempo: 100,
    fill: true,
    note: "Four clicks on the rim to count the band in.",
    rows: {
      sidestick: "x---x---x---x---",
    },
  },
  {
    id: "ending",
    name: "Hit and stop",
    style: "Fills",
    meter: "4/4",
    tempo: 100,
    fill: true,
    note: "An ending: crash and kick together on the 1, then silence.",
    rows: {
      crash: "X---------------",
      kick: "x---------------",
    },
  },
];

export const GROOVE_BY_ID = Object.fromEntries(GROOVES.map((g) => [g.id, g]));

// A groove's rows as notes on its meter's grid.
export function grooveNotes(groove) {
  const steps = stepsPerBar(METERS[groove.meter]);
  const notes = {};
  for (const [piece, text] of Object.entries(groove.rows)) {
    const row = Array.from({ length: steps }, (_, i) => CHAR_LEVEL[text[i]] ?? 0);
    if (row.some(Boolean)) notes[piece] = row;
  }
  return notes;
}

// What a first visit opens on: a short song that shows every idea at once (parts, a fill, a crash
// into the chorus), ready for Play.
// Its ids are fixed, so the page renders the same on the server and in the browser.
export function starterBeat() {
  const part = (id, name, groove) => ({ id, name, notes: grooveNotes(GROOVE_BY_ID[groove]) });
  const verse = part("p-verse", "Verse", "rock-8ths");
  const chorus = part("p-chorus", "Chorus", "rock-ride");
  const fill = part("p-fill", "Fill", "fill-toms");
  const block = (n, p, bars, crash = false) => ({ id: `b-${n}`, part: p.id, bars, crash });
  return {
    v: BEAT_VERSION,
    name: "",
    tempo: 100,
    meter: "4/4",
    swing: 0,
    swingUnit: 8,
    parts: [verse, chorus, fill],
    song: [block(1, verse, 3), block(2, fill, 1), block(3, chorus, 3, true), block(4, fill, 1)],
  };
}
