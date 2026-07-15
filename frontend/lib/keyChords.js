const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function parseKey(key) {
  const m = /^([A-G]#?)(m?)$/.exec(key || "C");
  if (!m) return { root: 0, minor: false };
  const root = NOTE_NAMES.indexOf(m[1]);
  return { root: root === -1 ? 0 : root, minor: m[2] === "m" };
}

export function diatonicChords(key) {
  const { root, minor } = parseKey(key);
  const steps = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const qualities = minor ? ["m", "dim", "", "m", "m", "", ""] : ["", "m", "m", "", "", "m", "dim"];
  return steps.map((s, i) => NOTE_NAMES[(root + s) % 12] + qualities[i]);
}

// A simple I-V-vi-IV style pop progression built from the key's diatonic triads.
export function progressionFor(key) {
  const chords = diatonicChords(key);
  return [chords[0], chords[4], chords[5], chords[3]];
}
