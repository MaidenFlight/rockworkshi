// Chords and scales for piano and voice. Notes are MIDI numbers (60 is middle C).
const { QUALITY, chordNotes, mod12, semitones, scaleNotes } = require("./theory");

const INVERSIONS = ["Root position", "1st inversion", "2nd inversion", "3rd inversion"];

// The lowest MIDI note of a pitch class at or above `floor`.
function above(pc, floor) {
  return floor + mod12(pc - floor);
}

// Right-hand fingers for a close chord, from where its smallest gaps fall: neighbouring fingers
// take a 2nd, and the thumb and little finger take the outside notes.
function rightHand(midi) {
  const gaps = midi.slice(1).map((m, i) => m - midi[i]);
  if (midi.length === 2) return [1, 5];
  if (midi.length === 3) {
    if (gaps[1] <= 2) return [1, 4, 5];
    // A 4th or wider on top (a first inversion) leaves the middle finger nothing to reach for.
    return gaps[1] >= 5 ? [1, 2, 5] : [1, 3, 5];
  }
  return gaps[2] <= 2 ? [1, 2, 4, 5] : [1, 2, 3, 5];
}

// Stack pitch classes upward from a starting octave, each above the last.
function stack(pcs, floor) {
  const out = [];
  let last = floor - 1;
  for (const pc of pcs) {
    last = above(pc, last + 1);
    out.push(last);
  }
  return out;
}

// Ways to play a chord on piano: the left hand on the bass note, the right hand on the chord in
// close position, through every inversion. Five-note chords are too wide for one hand, so the
// right hand drops the root, as pianists play them: two voicings, 3-5-7-9 and 7-9-3-5.
function pianoVoicings(chord) {
  const q = QUALITY[chord.quality];
  const pcs = [...new Set(q.intervals.map((iv) => mod12(chord.root + semitones(iv))))];
  const bassPc = chord.bass ?? chord.root;
  const left = [above(bassPc, 40)];
  const out = [];

  if (pcs.length > 4) {
    const upper = q.intervals.filter((iv) => iv !== "1").map((iv) => mod12(chord.root + semitones(iv)));
    // 3 5 b7 9 and b7 9 3 5 (the 5th is dropped when there are already four upper notes)
    const four = upper.length > 4 ? upper.filter((pc) => pc !== mod12(chord.root + 7)) : upper;
    const a = four;
    const b = [...four.slice(2), ...four.slice(0, 2)];
    for (const [order, label] of [
      [a, "Left hand root, right hand from the 3rd"],
      [b, "Left hand root, right hand from the 7th"],
    ]) {
      const right = stack(order, 55);
      out.push({ label, left, right, fingers: rightHand(right) });
    }
    return out;
  }

  if (pcs.length === 2) {
    // A power chord: root and 5th, then with the octave on top.
    const [r, f] = stack(pcs, 53);
    out.push({ label: "Root and 5th", left, right: [r, f], fingers: [1, 5] });
    out.push({ label: "Root, 5th and octave", left, right: [r, f, r + 12], fingers: [1, 2, 5] });
    return out;
  }

  for (let k = 0; k < pcs.length; k++) {
    const order = [...pcs.slice(k), ...pcs.slice(0, k)];
    // The bottom note sits between F3 and E4, so every inversion stays near middle C.
    const right = stack(order, 53);
    out.push({ label: INVERSIONS[k], left, right, fingers: rightHand(right), bottom: k });
  }
  return out;
}

// What a singer gets for a chord: its notes to sing as an arpeggio, low and high, and which
// notes make a harmony against the root.
function voiceChord(chord) {
  const { notes } = chordNotes(chord.root, chord.quality, chord.bass);
  const offsets = QUALITY[chord.quality].intervals.map(semitones).filter((s) => s < 12);
  const sequence = [...offsets, 12, ...offsets.slice().reverse()];
  const run = (floor) => {
    const root = above(chord.root, floor);
    return sequence.map((s) => root + s);
  };
  return {
    // Roots from A2 for lower voices and from A3 for higher ones.
    arpeggio: { low: run(45), high: run(57) },
    harmony: notes.filter((n) => n.interval !== "1").map((n) => ({ name: n.name, interval: n.interval })),
  };
}

// Common one-octave fingerings, ascending, written from the root. Major in every key, natural minor
// in every key. Teachers vary; these keep thumbs off the black keys.
const FINGERING = {
  major: {
    0: ["12312345", "54321321"],
    1: ["23123412", "32143213"],
    2: ["12312345", "54321321"],
    3: ["31234123", "32143213"],
    4: ["12312345", "54321321"],
    5: ["12341234", "54321321"],
    6: ["23412312", "43213214"],
    7: ["12312345", "54321321"],
    8: ["34123123", "32143213"],
    9: ["12312345", "54321321"],
    10: ["41231234", "32143213"],
    11: ["12312345", "43214321"],
  },
  minor: {
    0: ["12312345", "54321321"],
    1: ["34123123", "32143213"],
    2: ["12312345", "54321321"],
    3: ["31234123", "21432132"],
    4: ["12312345", "54321321"],
    5: ["12341234", "54321321"],
    6: ["34123123", "43213214"],
    7: ["12312345", "54321321"],
    8: ["34123123", "32132143"],
    9: ["12312345", "54321321"],
    10: ["41231234", "21321432"],
    11: ["12312345", "43214321"],
  },
};

// A scale for piano: one octave up from the root, with fingers where there's a common fingering.
function pianoScale(root, scaleId) {
  const notes = scaleNotes(root, scaleId);
  const start = above(root, 60);
  const right = [...notes.map((n) => start + mod12(n.pc - root)), start + 12];
  const table = FINGERING[scaleId]?.[mod12(root)];
  return {
    right,
    left: right.map((m) => m - 12),
    fingers: table ? { right: [...table[0]].map(Number), left: [...table[1]].map(Number) } : null,
  };
}

// A scale for singing: up and back down, from a low and a high starting note, with solfège.
function voiceScale(root, scaleId) {
  const notes = scaleNotes(root, scaleId);
  const run = (floor) => {
    const start = above(root, floor);
    const up = [...notes.map((n) => start + mod12(n.pc - root)), start + 12];
    return [...up, ...up.slice(0, -1).reverse()];
  };
  return { up: { low: run(45), high: run(57) }, syllables: [...notes.map((n) => n.solfege), notes[0].solfege] };
}

// Warm-ups, as steps of the major scale (0 = Do). The page starts each on a note the singer picks
// and walks it up a half step at a time.
const WARMUPS = [
  { id: "five", name: "Five-note scale", steps: [0, 2, 4, 5, 7, 5, 4, 2, 0], about: "Do re mi fa sol and back. The first warm-up of the day, on an easy \"mah\"." },
  { id: "triad", name: "Arpeggio", steps: [0, 4, 7, 12, 7, 4, 0], about: "Do mi sol do. Keep the top note as relaxed as the bottom one." },
  { id: "three", name: "Three-note slide", steps: [0, 2, 4, 2, 0], about: "Small steps for a cold voice. Try it on a lip trill." },
  { id: "octave", name: "Octave and back", steps: [0, 12, 11, 9, 7, 5, 4, 2, 0], about: "A leap up, then the scale back down. Builds an even voice from bottom to top." },
  { id: "nine", name: "Nine-note run", steps: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0], about: "Up past the octave and home. For when the voice is warm." },
];

// Intervals singers learn by ear, each with a tune whose opening has it. Ascending.
const INTERVALS = [
  { semitones: 1, name: "Minor 2nd", tune: "Jaws (the shark theme)" },
  { semitones: 2, name: "Major 2nd", tune: "Happy Birthday (\"Hap-py\")" },
  { semitones: 3, name: "Minor 3rd", tune: "Greensleeves (\"A-las\")" },
  { semitones: 4, name: "Major 3rd", tune: "When the Saints Go Marching In (\"Oh when\")" },
  { semitones: 5, name: "Perfect 4th", tune: "Here Comes the Bride (\"Here comes\")" },
  { semitones: 6, name: "Tritone", tune: "The Simpsons (\"The Simp-\")" },
  { semitones: 7, name: "Perfect 5th", tune: "Twinkle Twinkle Little Star (\"Twinkle, twin-\")" },
  { semitones: 8, name: "Minor 6th", tune: "The Entertainer (the jump into the tune)" },
  { semitones: 9, name: "Major 6th", tune: "My Bonnie Lies over the Ocean (\"My Bon-\")" },
  { semitones: 10, name: "Minor 7th", tune: "Somewhere, from West Side Story (\"There's a\")" },
  { semitones: 11, name: "Major 7th", tune: "Take On Me (the leap in the chorus)" },
  { semitones: 12, name: "Octave", tune: "Somewhere over the Rainbow (\"Some-where\")" },
];

module.exports = { pianoVoicings, voiceChord, pianoScale, voiceScale, WARMUPS, INTERVALS, FINGERING };
