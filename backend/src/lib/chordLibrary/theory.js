// The music theory the chord and scale library is built from. Pitch classes run 0-11 from C.
// Everything here is pure and deterministic, so the library can be generated once and cached.

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Interval name -> [letter steps from the root (1-7), semitones].
const INTERVALS = {
  1: [1, 0],
  b2: [2, 1],
  2: [2, 2],
  b3: [3, 3],
  3: [3, 4],
  4: [4, 5],
  "#4": [4, 6],
  b5: [5, 6],
  5: [5, 7],
  "#5": [5, 8],
  b6: [6, 8],
  6: [6, 9],
  bb7: [7, 9],
  b7: [7, 10],
  7: [7, 11],
  b9: [2, 13],
  9: [2, 14],
  "#9": [2, 15],
  11: [4, 17],
  13: [6, 21],
};

// What each interval is called when it's taught.
const INTERVAL_NAMES = {
  1: "root",
  b2: "flat 2nd",
  2: "2nd",
  b3: "minor 3rd",
  3: "major 3rd",
  4: "4th",
  "#4": "sharp 4th",
  b5: "flat 5th",
  5: "5th",
  "#5": "sharp 5th",
  b6: "flat 6th",
  6: "6th",
  bb7: "diminished 7th",
  b7: "flat 7th",
  7: "major 7th",
  b9: "flat 9th",
  9: "9th",
  "#9": "sharp 9th",
  11: "11th",
  13: "13th",
};

// Movable-do solfège, by interval, for singers.
const SOLFEGE = { 1: "Do", b2: "Ra", 2: "Re", b3: "Me", 3: "Mi", 4: "Fa", "#4": "Fi", b5: "Se", 5: "Sol", b6: "Le", 6: "La", bb7: "La", b7: "Te", 7: "Ti" };

// The twelve roots, spelled the way chord charts and key signatures usually spell them.
// Major-sounding chords and keys take flats (Db, Ab), minor ones sharps (C#m, G#m).
const MAJOR_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
// Both names where a black key has two, for the root picker.
const ROOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pc) => {
  const a = MAJOR_NAMES[pc];
  const b = MINOR_NAMES[pc];
  const names = a === b ? [a] : [b, a];
  return { pc, id: a, label: names.join("/") };
});

const mod12 = (n) => ((n % 12) + 12) % 12;

function semitones(interval) {
  const entry = INTERVALS[interval];
  if (!entry) throw new Error(`Unknown interval ${interval}`);
  return entry[1];
}

// "C#" -> 1, "Bb" -> 10, "E#" -> 5. null for anything that isn't a note name.
function pitchClass(name) {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(name || "");
  if (!m) return null;
  const shift = { bb: -2, b: -1, "#": 1, "##": 2 }[m[2]] || 0;
  return mod12(LETTER_PC[m[1]] + shift);
}

// The note an interval above a root, spelled on the right letter: the b7 of Db is Cb, not B.
function spell(rootName, interval) {
  const [steps, semis] = INTERVALS[interval];
  const rootLetter = rootName[0];
  const letter = LETTERS[(LETTERS.indexOf(rootLetter) + steps - 1) % 7];
  const target = mod12(pitchClass(rootName) + semis);
  let shift = mod12(target - LETTER_PC[letter]);
  if (shift > 6) shift -= 12;
  const accidental = { "-2": "bb", "-1": "b", 0: "", 1: "#", 2: "##" }[shift];
  if (accidental === undefined) throw new Error(`Can't spell ${interval} above ${rootName}`);
  return letter + accidental;
}

// Chord charts write the note players read fastest: B rather than Cb, F rather than E#.
const PLAIN = { Cb: "B", Fb: "E", "E#": "F", "B#": "C" };
function plainName(name, preferFlats) {
  if (PLAIN[name]) return PLAIN[name];
  if (name.length === 3) {
    const pc = pitchClass(name);
    return (preferFlats ? MAJOR_NAMES : MINOR_NAMES)[pc];
  }
  return name;
}

// ---------- Chords ----------

// The library's chord types, most-played first. `tier` groups them on the page.
// `optional` tones can be left out of a voicing without changing what the chord is.
const QUALITIES = [
  { id: "maj", suffix: "", name: "major", intervals: ["1", "3", "5"], tier: "essentials", about: "Bright and settled. Most songs are built on major chords." },
  { id: "m", suffix: "m", name: "minor", intervals: ["1", "b3", "5"], tier: "essentials", about: "The 3rd drops a fret, and the chord turns dark." },
  { id: "7", suffix: "7", name: "dominant 7th", intervals: ["1", "3", "5", "b7"], tier: "essentials", about: "A major chord with a flat 7th on top. Bluesy, and it wants to move on." },
  { id: "5", suffix: "5", name: "power chord", intervals: ["1", "5"], tier: "essentials", about: "Just the root and 5th, with no 3rd, so it's neither major nor minor. The sound of rock guitar with distortion." },
  { id: "maj7", suffix: "maj7", name: "major 7th", intervals: ["1", "3", "5", "7"], tier: "next", about: "Major with the 7th a fret below the root. Soft and dreamy." },
  { id: "m7", suffix: "m7", name: "minor 7th", intervals: ["1", "b3", "5", "b7"], tier: "next", about: "Minor with a flat 7th. Smooth, and everywhere in soul and funk." },
  { id: "sus2", suffix: "sus2", name: "suspended 2nd", intervals: ["1", "2", "5"], tier: "next", about: "The 3rd is swapped for the 2nd. Open and unresolved." },
  { id: "sus4", suffix: "sus4", name: "suspended 4th", intervals: ["1", "4", "5"], tier: "next", about: "The 3rd is swapped for the 4th. It usually falls back to the major chord." },
  { id: "add9", suffix: "add9", name: "added 9th", intervals: ["1", "3", "5", "9"], tier: "next", about: "A major chord with the 9th added. Shimmery, a favourite on acoustic guitar." },
  { id: "6", suffix: "6", name: "major 6th", intervals: ["1", "3", "5", "6"], tier: "colour", about: "Major with the 6th added. Sweet and old-fashioned, from swing to surf." },
  { id: "m6", suffix: "m6", name: "minor 6th", intervals: ["1", "b3", "5", "6"], tier: "colour", about: "Minor with a major 6th. Moody, a little film noir." },
  { id: "9", suffix: "9", name: "dominant 9th", intervals: ["1", "3", "5", "b7", "9"], tier: "colour", optional: ["5"], about: "A 7th chord with the 9th on top. The funk chord." },
  { id: "m9", suffix: "m9", name: "minor 9th", intervals: ["1", "b3", "5", "b7", "9"], tier: "colour", optional: ["5"], about: "A minor 7th with the 9th added. Lush." },
  { id: "7sus4", suffix: "7sus4", name: "7th suspended 4th", intervals: ["1", "4", "5", "b7"], tier: "colour", about: "A 7th chord with the 4th in place of the 3rd. It pulls toward the plain 7th." },
  { id: "dim", suffix: "dim", name: "diminished", intervals: ["1", "b3", "b5"], tier: "tension", about: "Two minor 3rds stacked. Tense, a chord that passes between two others." },
  { id: "dim7", suffix: "dim7", name: "diminished 7th", intervals: ["1", "b3", "b5", "bb7"], tier: "tension", symmetric: true, about: "Every note a minor 3rd apart, so the same shape works every three frets." },
  { id: "m7b5", suffix: "m7b5", name: "half-diminished", intervals: ["1", "b3", "b5", "b7"], tier: "tension", about: "A diminished chord with a flat 7th. Leads into the V chord of a minor key." },
  { id: "aug", suffix: "aug", name: "augmented", intervals: ["1", "3", "#5"], tier: "tension", symmetric: true, about: "Major with a raised 5th. Every note a major 3rd apart, so the shape repeats every four frets." },
  { id: "7#9", suffix: "7#9", name: "7th sharp 9th", intervals: ["1", "3", "5", "b7", "#9"], tier: "tension", optional: ["5"], about: "Major and minor 3rd at once. The Hendrix chord." },
];
const QUALITY = Object.fromEntries(QUALITIES.map((q) => [q.id, q]));

// Chord symbols as charts write them, longest first so "m7b5" wins over "m".
const SUFFIXES = [
  ["7#9", "7#9"],
  ["m7b5", "m7b5"],
  ["ø7", "m7b5"],
  ["ø", "m7b5"],
  ["maj7", "maj7"],
  ["M7", "maj7"],
  ["Δ7", "maj7"],
  ["min7", "m7"],
  ["m7", "m7"],
  ["-7", "m7"],
  ["7sus4", "7sus4"],
  ["7sus", "7sus4"],
  ["dim7", "dim7"],
  ["°7", "dim7"],
  ["o7", "dim7"],
  ["add9", "add9"],
  ["add2", "add9"],
  ["sus2", "sus2"],
  ["sus4", "sus4"],
  ["sus", "sus4"],
  ["min", "m"],
  ["dim", "dim"],
  ["aug", "aug"],
  ["m9", "m9"],
  ["m6", "m6"],
  ["°", "dim"],
  ["o", "dim"],
  ["+", "aug"],
  ["-", "m"],
  ["m", "m"],
  ["9", "9"],
  ["7", "7"],
  ["6", "6"],
  ["5", "5"],
  ["", "maj"],
];

// Chords with a minor 3rd take sharp roots (C#m), the rest flat ones (Db).
function isMinorish(quality) {
  return QUALITY[quality].intervals.includes("b3");
}

function rootName(pc, quality) {
  return (isMinorish(quality) ? MINOR_NAMES : MAJOR_NAMES)[mod12(pc)];
}

function chordName(root, quality, bass = null) {
  const base = rootName(root, quality) + QUALITY[quality].suffix;
  if (bass === null) return base;
  // A bass note from the chord keeps the chord's spelling: A/C#, not A/Db.
  const own = chordNotes(root, quality).notes.find((n) => n.pc === mod12(bass));
  return `${base}/${own ? own.name : MAJOR_NAMES[mod12(bass)]}`;
}

// "Am/G" -> { root: 9, quality: "m", bass: 7 }. null for a symbol we don't know.
function parseChord(symbol) {
  const m = /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/.exec(String(symbol || "").trim());
  if (!m) return null;
  const root = pitchClass(m[1]);
  const entry = SUFFIXES.find(([suffix]) => suffix === m[2]);
  if (root === null || !entry) return null;
  const bass = m[3] ? pitchClass(m[3]) : null;
  return { root, quality: entry[1], bass: bass === root ? null : bass };
}

// A stable id for a chord, so the same chord written two ways ("C#m", "Dbm") is one entry.
function chordId(root, quality, bass = null) {
  return `${mod12(root)}:${quality}${bass === null ? "" : `/${mod12(bass)}`}`;
}

// The notes of a chord, spelled for its root and simplified for reading.
function chordNotes(root, quality, bass = null) {
  const name = rootName(root, quality);
  const preferFlats = !isMinorish(quality) || name.includes("b");
  const notes = QUALITY[quality].intervals.map((iv) => ({
    interval: iv,
    name: plainName(spell(name, iv), preferFlats),
    pc: mod12(root + semitones(iv)),
  }));
  if (bass === null) return { notes, bass: null };
  const own = notes.find((n) => n.pc === mod12(bass));
  return { notes, bass: { name: own ? own.name : MAJOR_NAMES[mod12(bass)], pc: mod12(bass), inChord: Boolean(own) } };
}

// Pitch classes a voicing must contain, and the ones it may contain. A plain 5th adds nothing a
// four-note chord needs (the open C7 and C6 leave it out), so it's optional there too.
function chordTones(root, quality) {
  const q = QUALITY[quality];
  const all = new Set(q.intervals.map((iv) => mod12(root + semitones(iv))));
  const optionalIntervals = [...(q.optional || []), ...(q.intervals.length >= 4 && q.intervals.includes("5") ? ["5"] : [])];
  const optional = new Set(optionalIntervals.map((iv) => mod12(root + semitones(iv))));
  const required = new Set([...all].filter((pc) => !optional.has(pc)));
  return { all, required };
}

// ---------- Scales ----------

// `family` decides spelling: a major-type scale on C# would need E# and B#, so it's Db instead.
const SCALES = [
  { id: "minor-pentatonic", name: "Minor pentatonic", intervals: ["1", "b3", "4", "5", "b7"], family: "minor", tier: "start", about: "Five notes, and the first lead scale most rock and blues players learn. It's hard to hit a wrong note.", over: "Minor chords, and the 7th chords of a blues." },
  { id: "major", name: "Major", intervals: ["1", "2", "3", "4", "5", "6", "7"], family: "major", tier: "start", about: "Do re mi. Every other scale here is described against it.", over: "Major keys. Its seven chords are the chords of the key." },
  { id: "major-pentatonic", name: "Major pentatonic", intervals: ["1", "2", "3", "5", "6"], family: "major", tier: "start", about: "The major scale without its two tense notes. Sweet and safe over a major key, from country to reggae.", over: "Major chords and major keys." },
  { id: "minor", name: "Natural minor", intervals: ["1", "2", "b3", "4", "5", "b6", "b7"], family: "minor", tier: "start", about: "The minor key's own scale, also called Aeolian. Same notes as the major scale a minor 3rd up.", over: "Minor keys." },
  { id: "blues", name: "Blues", intervals: ["1", "b3", "4", "b5", "5", "b7"], family: "minor", tier: "next", about: "Minor pentatonic plus the flat 5th, the blue note. Slide through it, don't sit on it.", over: "Blues, and rock riffs in a minor or dominant key." },
  { id: "mixolydian", name: "Mixolydian", intervals: ["1", "2", "3", "4", "5", "6", "b7"], family: "major", tier: "next", about: "Major with a flat 7th. Classic rock lives here.", over: "Dominant 7th chords, and rock songs that use the flat-VII chord." },
  { id: "dorian", name: "Dorian", intervals: ["1", "2", "b3", "4", "5", "6", "b7"], family: "minor", tier: "next", about: "Minor with a bright major 6th. Funky and soulful rather than sad.", over: "Minor 7th chords and minor jams." },
  { id: "major-blues", name: "Major blues", intervals: ["1", "2", "b3", "3", "5", "6"], family: "major", tier: "next", about: "Major pentatonic plus the minor 3rd, to slide up into the major 3rd. Country and Southern rock.", over: "Major and dominant 7th chords." },
  { id: "harmonic-minor", name: "Harmonic minor", intervals: ["1", "2", "b3", "4", "5", "b6", "7"], family: "minor", tier: "more", about: "Natural minor with a raised 7th. Dramatic, a little neoclassical.", over: "Minor keys, especially over the V chord." },
  { id: "phrygian", name: "Phrygian", intervals: ["1", "b2", "b3", "4", "5", "b6", "b7"], family: "minor", tier: "more", about: "Minor with a flat 2nd. Dark and Spanish-sounding, loved by metal.", over: "Minor chords with a half-step above the root." },
  { id: "lydian", name: "Lydian", intervals: ["1", "2", "3", "#4", "5", "6", "7"], family: "major", tier: "more", about: "Major with a raised 4th. Floating, the sound of film scores.", over: "Major 7th chords." },
  { id: "locrian", name: "Locrian", intervals: ["1", "b2", "b3", "4", "b5", "b6", "b7"], family: "minor", tier: "more", about: "The darkest mode, built on a diminished chord. Mostly for knowing what it is.", over: "Half-diminished chords." },
];
const SCALE = Object.fromEntries(SCALES.map((s) => [s.id, s]));

function scaleRootName(pc, scaleId) {
  return (SCALE[scaleId].family === "minor" ? MINOR_NAMES : MAJOR_NAMES)[mod12(pc)];
}

// A scale's notes, one per letter where the scale has seven (E# in F# major is right, so it stays).
function scaleNotes(root, scaleId) {
  const scale = SCALE[scaleId];
  const name = scaleRootName(root, scaleId);
  const preferFlats = scale.family === "major" || name.includes("b");
  return scale.intervals.map((iv) => {
    let note = spell(name, iv);
    // Double sharps and flats only turn up in a few awkward keys; nobody reads them happily.
    if (note.length === 3 || scale.intervals.length < 7) note = plainName(note, preferFlats);
    return { interval: iv, name: note, pc: mod12(root + semitones(iv)), solfege: SOLFEGE[iv] };
  });
}

// Whole and half steps between the notes, with the octave on the end: W W H W W W H.
function stepPattern(scaleId) {
  const semis = SCALE[scaleId].intervals.map(semitones);
  semis.push(12);
  return semis.slice(1).map((s, i) => {
    const gap = s - semis[i];
    return { 1: "H", 2: "W", 3: "W+H", 4: "2W" }[gap] || String(gap);
  });
}

// ---------- Keys ----------

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

function keyName(tonic, mode) {
  return `${(mode === "minor" ? MINOR_NAMES : MAJOR_NAMES)[mod12(tonic)]} ${mode}`;
}

// The seven chords of a key, as triads and as 7th chords.
function diatonicChords(tonic, mode) {
  const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  const triads = mode === "minor" ? ["m", "dim", "maj", "m", "m", "maj", "maj"] : ["maj", "m", "m", "maj", "maj", "m", "dim"];
  const sevenths = mode === "minor" ? ["m7", "m7b5", "maj7", "m7", "m7", "maj7", "7"] : ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"];
  return steps.map((step, i) => {
    const root = mod12(tonic + step);
    return {
      degree: i + 1,
      numeral: numeralFor(i, triads[i]),
      triad: { root, quality: triads[i], name: chordName(root, triads[i]) },
      seventh: { root, quality: sevenths[i], name: chordName(root, sevenths[i]) },
    };
  });
}

function numeralFor(index, quality, accidental = "") {
  const roman = ROMAN[index];
  const lower = isMinorish(quality);
  const base = accidental + (lower ? roman.toLowerCase() : roman);
  const mark = { dim: "°", m7b5: "ø7", dim7: "°7", aug: "+" }[quality];
  if (mark) return base + mark;
  const suffix = { maj: "", m: "", "7": "7", maj7: "maj7", m7: "7", "5": "5", sus2: "sus2", sus4: "sus4", add9: "add9", "6": "6", m6: "6", "9": "9", m9: "9", "7sus4": "7sus4", "7#9": "7#9" }[quality];
  return base + (suffix ?? "");
}

// Where a chord sits in a key: "IV", "vi", "bVII", and "I/7" for C/B in C (the bass on step 7).
function romanFor(chord, tonic, mode) {
  const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  const offset = mod12(chord.root - tonic);
  let index = steps.indexOf(offset);
  let accidental = "";
  if (index === -1) {
    // Not in the key: name it from the step above with a flat, as rock charts do (bVII, bIII).
    index = steps.indexOf(mod12(offset + 1));
    accidental = "b";
    if (index === -1) {
      index = steps.indexOf(mod12(offset - 1));
      accidental = "#";
    }
  }
  let numeral = numeralFor(index, chord.quality, accidental);
  if (chord.bass !== null && chord.bass !== undefined) {
    const bassStep = steps.indexOf(mod12(chord.bass - tonic));
    numeral += bassStep === -1 ? `/${MAJOR_NAMES[mod12(chord.bass)]}` : `/${bassStep + 1}`;
  }
  return numeral;
}

// The key that fits a song's chords best. Counts how many of the chords' notes fall in each
// major and minor key, weighted by how often each chord is played; ties go to the key whose
// home chord is played most. Returns { tonic, mode, name } or null with nothing to go on.
function detectKey(chords) {
  const counted = chords.filter((c) => c.chord);
  if (!counted.length) return null;
  let best = null;
  for (const mode of ["major", "minor"]) {
    const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
    for (let tonic = 0; tonic < 12; tonic++) {
      const inKey = new Set(steps.map((s) => mod12(tonic + s)));
      let fit = 0;
      let home = 0;
      for (const { chord, count } of counted) {
        const tones = [...chordTones(chord.root, chord.quality).all];
        fit += (tones.filter((pc) => inKey.has(pc)).length / tones.length) * count;
        const homeQuality = mode === "minor" ? isMinorish(chord.quality) : !isMinorish(chord.quality);
        if (chord.root === tonic && homeQuality) home += count;
      }
      const score = fit * 1000 + home;
      if (!best || score > best.score) best = { tonic, mode, score };
    }
  }
  return { tonic: best.tonic, mode: best.mode, name: keyName(best.tonic, best.mode) };
}

// Progressions worth knowing by name. Steps are [semitones above the key's home note, chord type].
// Songs are matched against these.
const PROGRESSIONS = [
  { id: "I-IV-V", mode: "major", name: "I–IV–V", steps: [[0, "maj"], [5, "maj"], [7, "maj"]], about: "Three chords and the truth. The backbone of rock and roll, blues, folk and reggae." },
  { id: "I-V-vi-IV", mode: "major", name: "I–V–vi–IV", steps: [[0, "maj"], [7, "maj"], [9, "m"], [5, "maj"]], about: "The pop progression. Hundreds of hits loop these four chords." },
  { id: "vi-IV-I-V", mode: "major", name: "vi–IV–I–V", steps: [[9, "m"], [5, "maj"], [0, "maj"], [7, "maj"]], about: "The pop progression started on the minor chord, which makes it sound more serious." },
  { id: "I-vi-IV-V", mode: "major", name: "I–vi–IV–V", steps: [[0, "maj"], [9, "m"], [5, "maj"], [7, "maj"]], about: "The 1950s progression, from doo-wop ballads to stadium rock." },
  { id: "IV-V-I", mode: "major", name: "IV–V–I", steps: [[5, "maj"], [7, "maj"], [0, "maj"]], about: "The strongest way home: a lift, a push, and the home chord." },
  { id: "ii-V-I", mode: "major", name: "ii–V–I", steps: [[2, "m"], [7, "maj"], [0, "maj"]], about: "Jazz's favourite move, and a smooth one in pop and soul." },
  { id: "I-bVII-IV", mode: "major", name: "I–bVII–IV", steps: [[0, "maj"], [10, "maj"], [5, "maj"]], about: "The classic-rock borrowed chord. The flat VII comes from the Mixolydian mode, outside the key." },
  // Minor keys are numbered from the natural minor scale, as their chord lists are, so VII is a whole step down.
  { id: "i-VII-VI", mode: "minor", name: "i–VII–VI", steps: [[0, "m"], [10, "maj"], [8, "maj"]], about: "A minor rock descent. Add the major V chord on the end and it's the Andalusian cadence." },
  { id: "i-iv-v", mode: "minor", name: "i–iv–v", steps: [[0, "m"], [5, "m"], [7, "m"]], about: "I–IV–V in a minor key. Moody blues and folk." },
  { id: "i-VI-III-VII", mode: "minor", name: "i–VI–III–VII", steps: [[0, "m"], [8, "maj"], [3, "maj"], [10, "maj"]], about: "The epic-pop loop: the same four chords as I–V–vi–IV, started on the minor one." },
];

// The twelve-bar blues, one numeral per bar.
const TWELVE_BAR = ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"];

// A progression's chords in a key: steps are [semitones above the tonic, quality].
function progressionIn(progression, tonic) {
  return progression.steps.map(([step, quality]) => {
    const root = mod12(tonic + step);
    return { root, quality, name: chordName(root, quality) };
  });
}

module.exports = {
  ROOTS,
  MAJOR_NAMES,
  MINOR_NAMES,
  INTERVAL_NAMES,
  QUALITIES,
  QUALITY,
  SCALES,
  SCALE,
  PROGRESSIONS,
  TWELVE_BAR,
  mod12,
  semitones,
  pitchClass,
  spell,
  rootName,
  chordName,
  chordId,
  parseChord,
  chordNotes,
  chordTones,
  scaleRootName,
  scaleNotes,
  stepPattern,
  keyName,
  diatonicChords,
  romanFor,
  detectKey,
  progressionIn,
};
