const SEMITONE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

function triad(root, quality) {
  const r = SEMITONE[root];
  const shapes = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
  };
  return shapes[quality].map((offset) => r + offset);
}

export const chordLibrary = {
  Guitar: [
    {
      group: "Major (open)",
      chords: [
        { name: "C", frets: [-1, 3, 2, 0, 1, 0], base: 1 },
        { name: "A", frets: [-1, 0, 2, 2, 2, 0], base: 1 },
        { name: "G", frets: [3, 2, 0, 0, 0, 3], base: 1 },
        { name: "E", frets: [0, 2, 2, 1, 0, 0], base: 1 },
        { name: "D", frets: [-1, -1, 0, 2, 3, 2], base: 1 },
      ],
    },
    {
      group: "Minor (open)",
      chords: [
        { name: "Am", frets: [-1, 0, 2, 2, 1, 0], base: 1 },
        { name: "Em", frets: [0, 2, 2, 0, 0, 0], base: 1 },
        { name: "Dm", frets: [-1, -1, 0, 2, 3, 1], base: 1 },
      ],
    },
    {
      group: "Dominant 7th",
      chords: [
        { name: "A7", frets: [-1, 0, 2, 0, 2, 0], base: 1 },
        { name: "D7", frets: [-1, -1, 0, 2, 1, 2], base: 1 },
        { name: "E7", frets: [0, 2, 0, 1, 0, 0], base: 1 },
        { name: "G7", frets: [3, 2, 0, 0, 0, 1], base: 1 },
        { name: "C7", frets: [-1, 3, 2, 3, 1, 0], base: 1 },
      ],
    },
    {
      group: "Major 7th & Sus",
      chords: [
        { name: "Cmaj7", frets: [-1, 3, 2, 0, 0, 0], base: 1 },
        { name: "Dsus2", frets: [-1, -1, 0, 2, 3, 0], base: 1 },
        { name: "Dsus4", frets: [-1, -1, 0, 2, 3, 3], base: 1 },
        { name: "Asus2", frets: [-1, 0, 2, 2, 0, 0], base: 1 },
        { name: "Asus4", frets: [-1, 0, 2, 2, 3, 0], base: 1 },
      ],
    },
  ],
  Ukulele: [
    {
      group: "Major",
      chords: [
        { name: "C", frets: [0, 0, 0, 3], base: 1 },
        { name: "G", frets: [0, 2, 3, 2], base: 1 },
        { name: "F", frets: [2, 0, 1, 0], base: 1 },
        { name: "D", frets: [2, 2, 2, 0], base: 1 },
        { name: "A", frets: [2, 1, 0, 0], base: 1 },
      ],
    },
    {
      group: "Minor",
      chords: [
        { name: "Am", frets: [2, 0, 0, 0], base: 1 },
        { name: "Em", frets: [0, 4, 3, 2], base: 1 },
        { name: "Dm", frets: [2, 2, 1, 0], base: 1 },
      ],
    },
    {
      group: "7th",
      chords: [
        { name: "C7", frets: [0, 0, 0, 1], base: 1 },
        { name: "G7", frets: [0, 2, 1, 2], base: 1 },
        { name: "A7", frets: [0, 1, 0, 0], base: 1 },
        { name: "D7", frets: [2, 2, 2, 3], base: 1 },
      ],
    },
  ],
  Bass: [
    {
      group: "Root shapes",
      chords: [
        { name: "E", frets: [0, -1, -1, -1], base: 1 },
        { name: "A", frets: [-1, 0, -1, -1], base: 1 },
        { name: "D", frets: [-1, -1, 0, -1], base: 1 },
        { name: "G", frets: [-1, -1, -1, 0], base: 1 },
        { name: "C", frets: [-1, 3, -1, -1], base: 1 },
        { name: "F", frets: [1, -1, -1, -1], base: 1 },
        { name: "B", frets: [-1, 2, -1, -1], base: 1 },
      ],
    },
  ],
  Piano: [
    {
      group: "Major triads",
      chords: ["C", "D", "E", "F", "G", "A", "B"].map((n) => ({ name: n, notes: triad(n, "major") })),
    },
    {
      group: "Minor triads",
      chords: ["A", "D", "E", "C", "G"].map((n) => ({ name: `${n}m`, notes: triad(n, "minor") })),
    },
    {
      group: "Dominant 7th",
      chords: ["C", "G", "D", "A"].map((n) => ({ name: `${n}7`, notes: triad(n, "dom7") })),
    },
    {
      group: "Major 7th",
      chords: ["C", "F", "G"].map((n) => ({ name: `${n}maj7`, notes: triad(n, "maj7") })),
    },
  ],
};

// Shapes for a song's chart. Slash chords and the barre F are as on the song's chord sheet.
const SONG_GUITAR = {
  C: { frets: [-1, 3, 2, 0, 1, 0], base: 1 },
  G: { frets: [3, 2, 0, 0, 0, 3], base: 1 },
  F: { frets: [1, 3, 3, 2, 1, 1], base: 1 },
  Am: { frets: [-1, 0, 2, 2, 1, 0], base: 1 },
  "C/B": { frets: [-1, 2, 0, 0, 1, 0], base: 1 },
  "Am/G": { frets: [3, -1, 2, 2, 1, 0], base: 1 },
};
// Close together so the right hand barely moves between chords, with the bass note in the left.
const SONG_KEYS = {
  C: { left: [48], right: [60, 64, 67] },
  G: { left: [43], right: [59, 62, 67] },
  F: { left: [41], right: [60, 65, 69] },
  Am: { left: [45], right: [60, 64, 69] },
  "C/B": { left: [47], right: [60, 64, 67] },
  "Am/G": { left: [43], right: [60, 64, 69] },
};

// The ukulele has no song sheet of its own, so its shapes are the chord library's. A chord the library
// doesn't have (a slash chord, say) gets no diagram rather than a borrowed one.
const SONG_UKULELE = Object.fromEntries(chordLibrary.Ukulele.flatMap((g) => g.chords).map((c) => [c.name, { frets: c.frets, base: c.base }]));

// voicing is "guitar", "keys" or "ukulele" (true still means keys). Returns { frets, base } for the
// fretted instruments or { left, right } MIDI notes for keys, or null if we have no shape for it.
export function songChordShape(name, voicing = "guitar") {
  const kind = voicing === true ? "keys" : voicing || "guitar";
  return ({ guitar: SONG_GUITAR, keys: SONG_KEYS, ukulele: SONG_UKULELE }[kind] || {})[name] || null;
}
