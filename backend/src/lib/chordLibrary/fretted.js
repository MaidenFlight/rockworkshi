// Chord voicings and scale positions for guitar, bass and ukulele.
//
// Chord shapes are written once, in open position, and moved up the neck: that is the CAGED
// system, and moving five shapes is how every chord gets every position. A shape is only kept
// where it really makes the chord (tests/chordLibrary.test.js checks every note) and where a
// hand can play it: assignFingers() finds fingers for it, or the position is dropped.
const { QUALITY, SCALE, chordTones, mod12, semitones, parseChord, scaleNotes } = require("./theory");

const TUNINGS = {
  Guitar: { strings: ["E", "A", "D", "G", "B", "E"], midi: [40, 45, 50, 55, 59, 64], frets: 15 },
  Bass: { strings: ["E", "A", "D", "G"], midi: [28, 33, 38, 43], frets: 15 },
  // Re-entrant: the G string is tuned above the C string, so the lowest note isn't on string one.
  Ukulele: { strings: ["G", "C", "E", "A"], midi: [67, 60, 64, 69], frets: 12, reentrant: true },
};

// "x32010" -> [-1, 3, 2, 0, 1, 0]. Templates only use frets 0-9.
const frets = (s) => [...s].map((c) => (c === "x" ? -1 : Number(c)));

// Shapes by chord type: { shape, frets } where frets is the open-position form. `moved` replaces it
// once it's moved off the nut (the open C7's high E can't come along), and `openOnly` keeps a shape
// that has no playable barre version.
const GUITAR_SHAPES = {
  maj: [
    { shape: "C", frets: "x32010" },
    { shape: "A", frets: "x02220" },
    { shape: "G", frets: "320003" },
    { shape: "E", frets: "022100" },
    { shape: "D", frets: "xx0232" },
  ],
  m: [
    { shape: "Am", frets: "x02210" },
    { shape: "Em", frets: "022000" },
    { shape: "Dm", frets: "xx0231" },
    { shape: "Cm", frets: "x3101x" },
  ],
  7: [
    { shape: "C7", frets: "x32310", moved: "x3231x" },
    { shape: "A7", frets: "x02020" },
    { shape: "G7", frets: "320001" },
    { shape: "E7", frets: "020100" },
    { shape: "D7", frets: "xx0212" },
  ],
  5: [
    { shape: "E5", frets: "022xxx" },
    { shape: "A5", frets: "x022xx" },
    { shape: "D5", frets: "xx023x" },
  ],
  maj7: [
    { shape: "Cmaj7", frets: "x32000" },
    { shape: "Amaj7", frets: "x02120" },
    { shape: "Gmaj7", frets: "320002", openOnly: true },
    { shape: "Emaj7", frets: "021100" },
    { shape: "Dmaj7", frets: "xx0222" },
  ],
  m7: [
    { shape: "Am7", frets: "x02010" },
    { shape: "Em7", frets: "020000" },
    { shape: "Dm7", frets: "xx0211" },
    { shape: "Cm7", frets: "x3131x" },
  ],
  sus2: [
    { shape: "Asus2", frets: "x02200" },
    { shape: "Dsus2", frets: "xx0230" },
  ],
  sus4: [
    { shape: "Asus4", frets: "x02230" },
    { shape: "Dsus4", frets: "xx0233" },
    { shape: "Esus4", frets: "022200" },
  ],
  add9: [
    { shape: "Cadd9", frets: "x32030" },
    { shape: "Eadd9", frets: "022102", openOnly: true },
    { shape: "D string", frets: "xx2102" },
  ],
  6: [
    { shape: "C6", frets: "x32210", moved: "x3221x" },
    { shape: "A6", frets: "x02222" },
    { shape: "E6", frets: "022120" },
    { shape: "G6", frets: "320000", openOnly: true },
    { shape: "D6", frets: "xx0202" },
  ],
  m6: [
    { shape: "Am6", frets: "x02212" },
    { shape: "Em6", frets: "022020" },
    { shape: "Dm6", frets: "xx0201" },
  ],
  9: [
    { shape: "C9", frets: "x32333" },
    { shape: "E9", frets: "020102" },
  ],
  m9: [
    { shape: "Em9", frets: "020002" },
    { shape: "Cm9", frets: "x3133x" },
  ],
  "7sus4": [
    { shape: "A7sus4", frets: "x02030" },
    { shape: "E7sus4", frets: "020200" },
    { shape: "D7sus4", frets: "xx0213" },
  ],
  dim: [
    { shape: "D string", frets: "xx0131" },
    { shape: "A string", frets: "x0121x" },
    { shape: "E string", frets: "0120xx" },
  ],
  dim7: [
    { shape: "D string", frets: "xx0101" },
    { shape: "A string", frets: "x12020" },
    { shape: "E string", frets: "1x010x" },
  ],
  m7b5: [
    { shape: "A string", frets: "x0101x" },
    { shape: "E string", frets: "1x110x" },
    { shape: "D string", frets: "xx0111" },
  ],
  aug: [
    { shape: "C", frets: "x32110", moved: "x3211x" },
    { shape: "E", frets: "032110" },
    { shape: "D", frets: "xx0332" },
  ],
  "7#9": [{ shape: "A string", frets: "x1012x" }],
};

// Well-known open chords that aren't one of the moving shapes, and the common slash chords.
const GUITAR_EXTRAS = [
  { chord: "G", frets: "320033", label: "Open, with the D on top" },
  { chord: "F", frets: "xx3211", label: "Small F, before the full barre" },
  { chord: "Fmaj7", frets: "xx3210", label: "Open" },
  { chord: "B7", frets: "x21202", label: "Open" },
  { chord: "Csus2", frets: "x30033", label: "Open" },
  { chord: "Gsus2", frets: "300033", label: "Open" },
  { chord: "Csus4", frets: "x33011", label: "Open" },
  { chord: "Gsus4", frets: "330013", label: "Open" },
  { chord: "Gadd9", frets: "320203", label: "Open" },
  { chord: "Em7", frets: "022030", label: "Open, fuller" },
  { chord: "Am7", frets: "x02213", label: "Open, fuller" },
  { chord: "E7#9", frets: "076780", label: "With the open E strings" },
  { chord: "C/B", frets: "x22010", label: "Open" },
  { chord: "C/G", frets: "332010", label: "Open" },
  { chord: "C/E", frets: "032010", label: "Open" },
  { chord: "D/F#", frets: "200232", label: "Open, thumb or first finger on the F#" },
  { chord: "G/B", frets: "x20003", label: "Open" },
  { chord: "Am/G", frets: "3x2210", label: "Open" },
  { chord: "F/C", frets: "x33211", label: "Open" },
  { chord: "D/A", frets: "x00232", label: "Open" },
  { chord: "A/C#", frets: "x42220", label: "Open" },
  { chord: "G/F#", frets: "2x0003", label: "Open" },
];

// Ukulele shapes in open position. Moving them works the same way; the re-entrant G string means
// none of them needs the root at the bottom.
const UKULELE_SHAPES = {
  maj: [
    { shape: "C", frets: "0003" },
    { shape: "A", frets: "2100" },
    { shape: "G", frets: "0232" },
    { shape: "F", frets: "2010" },
    { shape: "D", frets: "2220" },
  ],
  m: [
    { shape: "Am", frets: "2000" },
    { shape: "Em", frets: "0432" },
    { shape: "Dm", frets: "2210" },
    { shape: "Cm", frets: "0333" },
    { shape: "Gm", frets: "0231" },
    { shape: "Fm", frets: "1013" },
  ],
  7: [
    { shape: "C7", frets: "0001" },
    { shape: "A7", frets: "0100" },
    { shape: "G7", frets: "0212" },
    { shape: "D7", frets: "2223" },
    { shape: "E7", frets: "1202" },
  ],
  5: [
    { shape: "C5", frets: "0033" },
    { shape: "A5", frets: "2400" },
    { shape: "G5", frets: "023x" },
  ],
  maj7: [
    { shape: "Cmaj7", frets: "0002" },
    { shape: "Amaj7", frets: "1100" },
    { shape: "Gmaj7", frets: "0222" },
    { shape: "Dmaj7", frets: "2224" },
  ],
  m7: [
    { shape: "Am7", frets: "0000" },
    { shape: "Em7", frets: "0202" },
    { shape: "Dm7", frets: "2213" },
    { shape: "Gm7", frets: "0211" },
    { shape: "Cm7", frets: "3333" },
  ],
  sus2: [
    { shape: "Csus2", frets: "0233" },
    { shape: "Dsus2", frets: "2200" },
    { shape: "Gsus2", frets: "0230" },
    { shape: "Fsus2", frets: "0013" },
  ],
  sus4: [
    { shape: "Csus4", frets: "0013" },
    { shape: "Dsus4", frets: "0230" },
    { shape: "Gsus4", frets: "0233" },
    { shape: "Asus4", frets: "2200" },
  ],
  add9: [
    { shape: "Cadd9", frets: "0203" },
    { shape: "Gadd9", frets: "2232" },
    { shape: "Fadd9", frets: "0010" },
  ],
  6: [
    { shape: "C6", frets: "0000" },
    { shape: "G6", frets: "0202" },
    { shape: "D6", frets: "2222" },
    { shape: "A6", frets: "2120" },
  ],
  m6: [
    { shape: "Am6", frets: "2020" },
    { shape: "Dm6", frets: "2212" },
    { shape: "Em6", frets: "0102" },
    { shape: "Cm6", frets: "2333" },
  ],
  // Five-note chords lose their root on four strings: G9 is played as the notes of Bm7b5.
  9: [
    { shape: "C9", frets: "0201" },
    { shape: "G9", frets: "2212" },
  ],
  m9: [
    { shape: "Am9", frets: "2032" },
    { shape: "Dm9", frets: "2413" },
  ],
  "7sus4": [
    { shape: "A7sus4", frets: "0200" },
    { shape: "G7sus4", frets: "0213" },
    { shape: "C7sus4", frets: "0011" },
    { shape: "E7sus4", frets: "2202" },
  ],
  dim: [
    { shape: "Cdim", frets: "5323" },
    { shape: "Bdim", frets: "4212" },
    { shape: "G#dim", frets: "4242" },
  ],
  dim7: [{ shape: "dim7", frets: "2323" }],
  m7b5: [
    { shape: "Bm7b5", frets: "2212" },
    { shape: "Am7b5", frets: "2333" },
    { shape: "Em7b5", frets: "3435" },
  ],
  aug: [{ shape: "aug", frets: "1003" }],
  "7#9": [
    { shape: "E7#9", frets: "1232" },
    { shape: "A7#9", frets: "0103" },
  ],
};

const UKULELE_EXTRAS = [
  { chord: "E", frets: "1402", label: "Open" },
  { chord: "Eb", frets: "0331", label: "Open" },
  { chord: "F#m", frets: "2120", label: "Open" },
];

const SHAPES = { Guitar: GUITAR_SHAPES, Ukulele: UKULELE_SHAPES };
const EXTRAS = { Guitar: GUITAR_EXTRAS, Ukulele: UKULELE_EXTRAS };

// ---------- Fingers ----------

// Fingers 1-4 for a voicing, plus any barres, or null if no hand could play it.
// One finger per fret from the lowest fretted note, and a barre where the lowest fret is held
// across strings: always with more than four notes, and up the neck whenever the lowest fret
// takes an outside string. An open chord keeps separate fingers, as the open D does. A run of
// same-fret strings goes under one finger only when four fingers aren't otherwise enough.
function assignFingers(fs) {
  const fretted = fs.map((f, i) => [f, i]).filter(([f]) => f > 0);
  const fingers = fs.map(() => 0);
  if (!fretted.length) return { fingers, barres: [] };
  const lowest = Math.min(...fretted.map(([f]) => f));
  const highest = Math.max(...fretted.map(([f]) => f));
  if (highest - lowest > 3) return null;

  const atLowest = fretted.filter(([f]) => f === lowest).map(([, i]) => i);
  const lo = Math.min(...atLowest);
  const hi = Math.max(...atLowest);
  const played = fs.map((f, i) => (f >= 0 ? i : null)).filter((i) => i !== null);
  const outside = lo === played[0] || hi === played[played.length - 1];
  const open = fs.some((f) => f === 0);
  const canBarre = atLowest.length >= 2 && fs.slice(lo, hi + 1).every((f) => f > 0);
  const contiguous = atLowest.length === hi - lo + 1;
  const barre =
    canBarre && (fretted.length > 4 || (!open && outside) || (contiguous && hi === played[played.length - 1]));

  const barres = [];
  let rest = fretted;
  if (barre) {
    barres.push({ fret: lowest, from: lo, to: hi, finger: 1 });
    for (let i = lo; i <= hi; i++) if (fs[i] === lowest) fingers[i] = 1;
    rest = fretted.filter(([f, i]) => !(f === lowest && i >= lo && i <= hi));
  }
  rest = [...rest].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const first = barre ? 2 : 1;

  // A single note in open position takes the finger for its fret, as the open C's ring finger does.
  if (!barre && rest.length === 1) {
    const [f, i] = rest[0];
    fingers[i] = f <= 3 ? f : 1;
    return { fingers, barres };
  }

  const tries = [
    // One finger per fret, pushed up when two notes want the same one.
    () => {
      let prev = first - 1;
      return rest.map(([f]) => (prev = Math.max(1 + (f - lowest), prev + 1)));
    },
    // In order, low fret to high.
    () => rest.map((_, k) => first + k),
  ];
  for (const attempt of tries) {
    const got = attempt();
    if (Math.max(...got) <= 4) {
      rest.forEach(([, i], k) => (fingers[i] = got[k]));
      return { fingers, barres };
    }
  }

  // Last resort: one finger across a run of neighbouring strings at the same fret.
  const groups = [];
  for (const [f, i] of rest) {
    const last = groups[groups.length - 1];
    if (last && last.fret === f && last.to === i - 1 && fs.slice(last.from, i + 1).every((x) => x === f)) last.to = i;
    else groups.push({ fret: f, from: i, to: i });
  }
  // Each group still takes the finger for its fret where it can (a ring-finger barre two frets up).
  let prev = first - 1;
  const assigned = groups.map((g) => (prev = Math.max(prev + 1, Math.min(1 + (g.fret - lowest), 4 - (groups.length - 1 - groups.indexOf(g))))));
  if (Math.max(...assigned) > 4) return null;
  groups.forEach((g, k) => {
    const finger = assigned[k];
    for (let i = g.from; i <= g.to; i++) fingers[i] = finger;
    if (g.to > g.from) barres.push({ fret: g.fret, from: g.from, to: g.to, finger });
  });
  return { fingers, barres };
}

// ---------- Chords ----------

function sounding(fs, tuning) {
  return fs.map((f, i) => (f < 0 ? null : tuning.midi[i] + f)).filter((m) => m !== null);
}

// Whether a set of frets makes the chord: only its notes, all the ones it can't do without, and
// on guitar the root (or the slash chord's bass) at the bottom. Symmetric chords have no real
// root, so any of their notes may be the lowest.
function makesChord(fs, tuning, chord) {
  const notes = sounding(fs, tuning);
  if (notes.length < 2) return false;
  const pcs = new Set(notes.map(mod12));
  const { all, required } = chordTones(chord.root, chord.quality);
  if (chord.bass !== null) all.add(chord.bass);
  for (const pc of pcs) if (!all.has(pc)) return false;
  // A ukulele's four strings can't hold five-note chords, so their root can go; the bass has it.
  const fiveOnUke = tuning.reentrant && QUALITY[chord.quality].intervals.length > 4;
  for (const pc of required) if (!pcs.has(pc) && !(fiveOnUke && pc === mod12(chord.root))) return false;
  if (tuning.reentrant) return true;
  const bottom = mod12(Math.min(...notes));
  if (chord.bass !== null) return bottom === chord.bass;
  return QUALITY[chord.quality].symmetric ? true : bottom === mod12(chord.root);
}

function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return `${n}${suffix}`;
}

// The window a diagram shows: from the nut when everything fits in the first four frets.
function windowFor(fs) {
  const fretted = fs.filter((f) => f > 0);
  if (!fretted.length) return { base: 1, span: 4 };
  const low = Math.min(...fretted);
  const high = Math.max(...fretted);
  const base = high <= 4 ? 1 : low;
  return { base, span: Math.max(4, high - base + 1) };
}

function voicing(fs, tuning, label, shape) {
  const hand = assignFingers(fs);
  if (!hand) return null;
  const { base, span } = windowFor(fs);
  return { frets: fs, fingers: hand.fingers, barres: hand.barres, base, span, label, shape: shape || null, midi: sounding(fs, tuning) };
}

// Every position of a chord on guitar or ukulele, low on the neck first.
function chordVoicings(instrument, chord) {
  const tuning = TUNINGS[instrument];
  const out = [];
  const seen = new Set();
  const add = (v) => {
    const key = v && v.frets.join(",");
    if (!v || seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  for (const extra of EXTRAS[instrument]) {
    const parsed = parseChord(extra.chord);
    const same = parsed && parsed.root === chord.root && parsed.quality === chord.quality && parsed.bass === chord.bass;
    if (same && makesChord(frets(extra.frets), tuning, chord)) add(voicing(frets(extra.frets), tuning, extra.label));
  }

  if (chord.bass === null) {
    // A symmetric chord fits its shapes every few frets; the first place each one fits is enough,
    // and the page says how far apart the repeats are.
    const once = QUALITY[chord.quality].symmetric;
    for (const tpl of SHAPES[instrument][chord.quality] || []) {
      for (let b = 0; b < 12; b++) {
        if (b > 0 && tpl.openOnly) break;
        const source = frets(b > 0 && tpl.moved ? tpl.moved : tpl.frets);
        const fs = source.map((f) => (f < 0 ? -1 : f + b));
        if (Math.max(...fs) > tuning.frets) continue;
        if (!makesChord(fs, tuning, chord)) continue;
        const open = fs.some((f) => f === 0);
        const lowest = Math.min(...fs.filter((f) => f > 0));
        const shapeName = instrument === "Guitar" && /string$/.test(tpl.shape) ? `Root on the ${tpl.shape}` : `${tpl.shape} shape`;
        const label = open ? "Open position" : `${shapeName} · ${ordinal(lowest)} fret`;
        const v = voicing(fs, tuning, label, tpl.shape);
        add(v);
        if (once && v) break;
      }
    }
  }

  // Open chords first, then up the neck.
  const position = (v) => (v.frets.some((f) => f === 0) ? 0 : Math.min(...v.frets.filter((f) => f > 0)));
  return out.sort((a, b) => position(a) - position(b));
}

// ---------- Bass ----------

// A chord on bass is its arpeggio: the chord's notes in order from a root, inside one hand
// position. Roots on the E and A strings, the two places a bass line lives. A slash chord's
// bass note is the player's note, so its arpeggio starts there.
function bassVoicings(chord) {
  const tuning = TUNINGS.Bass;
  const q = QUALITY[chord.quality];
  const start = chord.bass !== null ? chord.bass : chord.root;
  const tones = q.intervals.map((iv) => ({ iv, semis: semitones(iv) }));
  // Chord tones above the starting note, in order, ending on the octave.
  const offsets = tones
    .map((t) => ({ ...t, from: mod12(chord.root + t.semis - start) + (t.semis >= 12 ? 12 : 0) }))
    .filter((t) => t.from > 0)
    .sort((a, b) => a.from - b.from);
  const startLabel = chord.bass !== null ? (tones.find((t) => mod12(chord.root + t.semis) === start)?.iv ?? "bass") : "1";
  // Low to high, so a 9th lands after the octave rather than before it.
  const sequence = [{ iv: startLabel, from: 0 }, ...offsets, { iv: startLabel, from: 12 }].sort((a, b) => a.from - b.from);

  const out = [];
  for (const string of [0, 1]) {
    const fret = mod12(start - tuning.midi[string]);
    const low = Math.max(0, fret - 2);
    const high = fret === 0 ? 4 : fret + 4;
    const base = tuning.midi[string] + fret;
    const dots = [];
    let current = string;
    for (const step of sequence) {
      const pitch = base + step.from;
      let best = null;
      for (let s = current; s < tuning.midi.length; s++) {
        const f = pitch - tuning.midi[s];
        if (f < low || f > high) continue;
        if (!best || Math.abs(f - fret) < Math.abs(best.fret - fret)) best = { string: s, fret: f };
      }
      if (!best) continue;
      current = best.string;
      dots.push({ string: best.string, fret: best.fret, interval: step.iv, midi: pitch });
    }
    const name = tuning.strings[string];
    out.push({
      label: `${chord.bass !== null ? "Bass note" : "Root"} on the ${name} string${fret === 0 ? " (open)" : `, ${ordinal(fret)} fret`}`,
      dots,
      from: Math.min(...dots.map((d) => d.fret)),
      to: Math.max(...dots.map((d) => d.fret)),
      midi: dots.map((d) => d.midi),
    });
  }
  return out;
}

// ---------- Scales ----------

// Positions that take the same number of notes on every string, each starting on the next note
// of the scale on the low E string: two a string makes the five pentatonic boxes, three a string
// the seven positions of a seven-note scale. Numbered from the root, the way they're taught.
function perStringPositions(tuning, notes, perString) {
  const index = new Map(notes.map((n, j) => [n.pc, j]));
  return notes.map((note) => {
    const startFret = mod12(note.pc - tuning.midi[0]);
    const pitches = [];
    for (let pitch = tuning.midi[0] + startFret; pitches.length < perString * tuning.midi.length; pitch++) {
      if (index.has(mod12(pitch))) pitches.push(pitch);
    }
    const dots = pitches.map((p, j) => {
      const string = Math.floor(j / perString);
      return [string, p - tuning.midi[string], index.get(mod12(p))];
    });
    return { dots, startFret, start: note.interval };
  });
}

// Every scale note inside a window of frets, from a given string up: the bass's
// one-finger-per-fret boxes and the ukulele's positions.
function windowDots(tuning, notes, { string = 0, from, to }) {
  const index = new Map(notes.map((n, k) => [n.pc, k]));
  const dots = [];
  tuning.midi.forEach((open, s) => {
    if (s < string) return;
    for (let f = from; f <= to; f++) {
      const k = index.get(mod12(open + f));
      if (k !== undefined) dots.push([s, f, k]);
    }
  });
  return dots;
}

const atFret = (fret) => (fret === 0 ? "open" : `${ordinal(fret)} fret`);

// What a scale looks like on a fretted instrument: its positions, each a list of
// [string, fret, note] dots where note indexes the scale's notes, with a label.
function scalePositions(instrument, root, scaleId) {
  const tuning = TUNINGS[instrument];
  const notes = scaleNotes(root, scaleId);
  const intervals = SCALE[scaleId].intervals;

  if (instrument === "Guitar") {
    // A blues scale is its pentatonic box plus the extra note wherever it falls in or just above
    // the box, next to a note already there.
    const extra = { blues: "b5", "major-blues": "b3" }[scaleId];
    if (extra) {
      const baseNotes = scaleNotes(root, scaleId === "blues" ? "minor-pentatonic" : "major-pentatonic");
      const extraIndex = intervals.indexOf(extra);
      const remap = baseNotes.map((n) => intervals.indexOf(n.interval));
      return perStringPositions(tuning, baseNotes, 2).map((box, n) => {
        const dots = box.dots.map(([st, f, k]) => [st, f, remap[k]]);
        const frets = dots.map(([, f]) => f);
        const low = Math.min(...frets);
        const high = Math.max(...frets);
        tuning.midi.forEach((open, st) => {
          for (let f = low; f <= high + 1; f++) {
            const near = dots.some(([ds, df]) => ds === st && Math.abs(df - f) <= 2);
            if (mod12(open + f) === notes[extraIndex].pc && near) dots.push([st, f, extraIndex]);
          }
        });
        return { label: `Box ${n + 1} · ${atFret(box.startFret)}`, dots };
      });
    }
    const perString = notes.length === 5 ? 2 : 3;
    return perStringPositions(tuning, notes, perString).map((p, n) => ({
      label: `${perString === 2 ? "Box" : "Position"} ${n + 1} · ${atFret(p.startFret)}`,
      dots: p.dots,
    }));
  }

  if (instrument === "Bass") {
    return [0, 1].map((string) => {
      const fret = mod12(root - tuning.midi[string]);
      const from = Math.max(0, fret - 1);
      const to = fret === 0 ? 4 : fret + 3;
      return { label: `Root on the ${tuning.strings[string]} string, ${atFret(fret)}`, dots: windowDots(tuning, notes, { string, from, to }) };
    });
  }

  // Ukulele: first position, then a box around the root on the C string and on the A string.
  const out = [{ label: "First position", dots: windowDots(tuning, notes, { from: 0, to: 4 }) }];
  for (const string of [1, 3]) {
    let fret = mod12(root - tuning.midi[string]);
    if (fret < 3) fret += 12;
    if (fret + 3 > tuning.frets) continue;
    out.push({ label: `From the root on the ${tuning.strings[string]} string, ${atFret(fret)}`, dots: windowDots(tuning, notes, { from: fret - 1, to: fret + 3 }) });
  }
  return out;
}

module.exports = {
  TUNINGS,
  GUITAR_SHAPES,
  GUITAR_EXTRAS,
  UKULELE_SHAPES,
  assignFingers,
  makesChord,
  chordVoicings,
  bassVoicings,
  scalePositions,
  frets,
};
