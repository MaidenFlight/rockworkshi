// The drummer's library: grooves and rudiments, written as one bar of steps.
// A groove's rows are strings with one character per step: "x" a hit, "X" an accent, "." a rest.
// `songs` names the school's songs that use the groove, matched to the song list by title.

// What each row is called, top of the kit to bottom, as drum notation stacks them.
const KIT = [
  { id: "crash", name: "Crash" },
  { id: "open", name: "Open hi-hat" },
  { id: "hat", name: "Hi-hat" },
  { id: "tom1", name: "High tom" },
  { id: "rim", name: "Cross-stick" },
  { id: "snare", name: "Snare" },
  { id: "tom2", name: "Mid tom" },
  { id: "floor", name: "Floor tom" },
  { id: "kick", name: "Kick" },
];

// How a bar is counted at each subdivision.
const COUNTS = {
  8: ["1", "&", "2", "&", "3", "&", "4", "&"],
  12: ["1", "&", "a", "2", "&", "a", "3", "&", "a", "4", "&", "a"],
  16: ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"],
};

const GROOVES = [
  {
    id: "rock",
    name: "Rock beat",
    tier: "start",
    steps: 8,
    tempo: 90,
    rows: { hat: "xxxxxxxx", snare: "..x...x.", kick: "x...x..." },
    about: "Eighth notes on the hi-hat, kick on 1 and 3, snare on 2 and 4. Every other groove grows out of this one.",
  },
  {
    id: "rock-and-of-2",
    name: "Rock beat, kick on the and of 2",
    tier: "start",
    steps: 8,
    // Have You Ever Seen the Rain's tempo: its bars are 2.06 seconds long.
    tempo: 116,
    rows: { hat: "xxxxxxxx", snare: "..x...x.", kick: "x..xx..." },
    about: "One extra kick, just before beat 3, and the beat starts to push forward.",
    songs: ["Have You Ever Seen the Rain"],
  },
  {
    id: "four-on-the-floor",
    name: "Four on the floor",
    tier: "start",
    steps: 8,
    tempo: 118,
    rows: { open: ".x.x.x.x", hat: "x.x.x.x.", snare: "..x...x.", kick: "x.x.x.x." },
    about: "The kick on every beat and the hi-hat opening on the ands. Disco, dance-rock and arena choruses.",
  },
  {
    id: "half-time",
    name: "Half-time",
    tier: "next",
    steps: 8,
    tempo: 140,
    rows: { hat: "xxxxxxxx", snare: "....x...", kick: "x.....x." },
    about: "The snare moves to beat 3, so the song feels half as fast while the tempo stays put. Big for ballads and breakdowns.",
  },
  {
    id: "sixteenths",
    name: "16th-note hi-hat",
    tier: "next",
    steps: 16,
    tempo: 88,
    rows: { hat: "XxxxXxxxXxxxXxxx", snare: "....x.......x...", kick: "x.....x.x......." },
    about: "Both hands share the hi-hat, or one hand plays all sixteen. Pop, funk and R&B.",
  },
  {
    id: "shuffle",
    name: "Shuffle",
    tier: "next",
    steps: 12,
    tempo: 100,
    rows: { hat: "x.xx.xx.xx.x", snare: "...x.....x..", kick: "x.....x....." },
    about: "Each beat split in three, playing the first and last: long-short, long-short. Blues and boogie.",
  },
  {
    id: "one-drop",
    name: "One drop",
    tier: "next",
    steps: 12,
    tempo: 76,
    rows: { hat: "x.xx.xx.xx.x", rim: "......x.....", kick: "......x....." },
    about: "Reggae's heartbeat. Nothing on beat 1: the kick and a cross-stick land together on 3.",
    songs: ["Three Little Birds"],
  },
  {
    id: "slow-twelve-eight",
    name: "12/8 slow blues",
    tier: "more",
    steps: 12,
    tempo: 60,
    rows: { hat: "xxxxxxxxxxxx", snare: "...x.....x..", kick: "x.....x.x..." },
    about: "Four big beats, each counted in three. The slow-dance and slow-blues feel.",
  },
  {
    id: "snare-fill",
    name: "Eighth-note snare fill",
    tier: "more",
    steps: 8,
    tempo: 90,
    rows: { snare: "XxxxXxxx", kick: "x...x..." },
    about: "Your first fill: eight even snare hits, then a crash with the kick on the next 1.",
  },
  {
    id: "tom-fill",
    name: "16th-note fill around the kit",
    tier: "more",
    steps: 16,
    tempo: 80,
    rows: { snare: "Xxxx............", tom1: "....Xxxx........", tom2: "........Xxxx....", floor: "............Xxxx" },
    about: "Four hits on each drum, high to low. Start slow and land the crash on the next 1.",
  },
];

// Rudiments as stickings, one stroke per step. ">" before a stroke accents it; lower-case letters
// before a stroke are grace notes (one for a flam, two for a drag); "-" is a rest.
const RUDIMENTS = [
  { id: "single-stroke-roll", name: "Single stroke roll", steps: 16, sticking: "R L R L R L R L R L R L R L R L", tempo: 80, about: "Hand to hand, evenly. The foundation of everything, from fills to blast beats." },
  { id: "double-stroke-roll", name: "Double stroke roll", steps: 16, sticking: "R R L L R R L L R R L L R R L L", tempo: 70, about: "Two strokes per hand. The second should be as loud as the first: let the stick bounce." },
  { id: "single-paradiddle", name: "Single paradiddle", steps: 16, sticking: ">R L R R >L R L L >R L R R >L R L L", tempo: 70, about: "Para-diddle: two singles and a double. It leads with the other hand every time round." },
  { id: "double-paradiddle", name: "Double paradiddle", steps: 12, sticking: ">R L R L R R >L R L R L L", tempo: 70, about: "Four singles and a double, which fits three-note beats: try it as triplets." },
  { id: "paradiddle-diddle", name: "Paradiddle-diddle", steps: 12, sticking: ">R L R R L L >R L R R L L", tempo: 70, about: "Two singles and two doubles. Great around the toms." },
  { id: "triple-stroke-roll", name: "Triple stroke roll", steps: 12, sticking: "R R R L L L R R R L L L", tempo: 60, about: "Three strokes per hand. Keep them even rather than fast." },
  { id: "five-stroke-roll", name: "Five stroke roll", steps: 16, sticking: "R R L L >R - - - L L R R >L - - -", tempo: 70, about: "Two doubles and an accent. The roll is short; the accent is the point." },
  { id: "flam", name: "Flam", steps: 8, sticking: "lR - rL - lR - rL -", tempo: 70, about: "A quiet grace note just before a loud one, so they sound as one fat note." },
  { id: "flam-tap", name: "Flam tap", steps: 16, sticking: "lR R rL L lR R rL L lR R rL L lR R rL L", tempo: 70, about: "A flam, then a tap with the same hand. The flam swaps hands each time." },
  { id: "drag", name: "Drag", steps: 8, sticking: "llR - rrL - llR - rrL -", tempo: 60, about: "Two soft grace notes into a main stroke. A ruff, in older books." },
  { id: "single-stroke-four", name: "Single stroke four", steps: 12, sticking: "R L R >L - - L R L >R - -", tempo: 70, about: "Three quick singles into an accent, a favourite little fill." },
];

module.exports = { KIT, COUNTS, GROOVES, RUDIMENTS };
