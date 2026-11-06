// Helpers for the transcribed parts in a song's chart.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// A four-string bass in standard tuning.
const BASS_STRINGS = [
  { name: "E", open: 28 },
  { name: "A", open: 33 },
  { name: "D", open: 38 },
  { name: "G", open: 43 },
];
const HIGHEST_FRET = 12;

export function pitchClassName(midi) {
  return NAMES[midi % 12];
}

// C4 is middle C.
export function noteName(midi) {
  return `${pitchClassName(midi)}${Math.floor(midi / 12) - 1}`;
}

// Where to play each note: as the chart says if it says, otherwise wherever the hand has least
// distance to move from the last one.
export function assignBassFrets(notes) {
  let hand = 3;
  return notes.map((note) => {
    if (note.string && Number.isInteger(note.fret)) {
      if (note.fret > 0) hand = note.fret;
      return note;
    }
    let best = null;
    for (const string of BASS_STRINGS) {
      const fret = note.midi - string.open;
      if (fret < 0 || fret > HIGHEST_FRET) continue;
      // An open string needs no fretting at all, so it costs little wherever the hand is.
      const cost = fret === 0 ? 1 : Math.abs(fret - hand);
      if (!best || cost < best.cost) best = { cost, fret, string: string.name };
    }
    if (!best) return { ...note, fret: note.midi - 28, string: "E" };
    if (best.fret > 0) hand = best.fret;
    return { ...note, fret: best.fret, string: best.string };
  });
}
