// The chord and scale library, built per instrument. A member only ever receives their own
// instrument's library (routes/chordLibrary.routes.js decides which), so everything here takes the
// instrument and returns nothing about any other.
const theory = require("./theory");
const fretted = require("./fretted");
const keyboard = require("./keyboard");
const drums = require("./drums");
const { songsUsing, songsForScale } = require("./songs");

const { QUALITIES, SCALES, SCALE, ROOTS, PROGRESSIONS, TWELVE_BAR, INTERVAL_NAMES } = theory;

// How each instrument's library is laid out.
const KINDS = { Guitar: "fretted", Ukulele: "fretted", Bass: "bass", Piano: "keys", Voice: "voice", Drums: "drums" };

// The chords a beginner on each instrument learns first, for "Start here".
const START = {
  Guitar: ["C", "A", "G", "E", "D", "Am", "Em", "Dm", "E7", "A7", "D7", "G7", "C7", "B7", "F", "Bm", "E5", "A5"],
  Ukulele: ["C", "G", "F", "Am", "Em", "Dm", "D", "A", "E7", "A7", "G7", "C7", "Bb", "E"],
  Bass: ["E", "A", "D", "G", "C", "F", "Am", "Em", "Dm", "E7", "A7"],
  Piano: ["C", "F", "G", "Am", "Dm", "Em", "D", "A", "E", "Bb", "C7", "G7", "Cmaj7", "Fmaj7"],
  Voice: ["C", "F", "G", "Am", "D", "A", "E", "Em"],
};

// The slash chords every instrument gets, as well as any a song uses.
const SLASH = fretted.GUITAR_EXTRAS.filter((e) => e.chord.includes("/")).map((e) => e.chord);

// Lead guitar and bass start with the minor pentatonic; everyone else with the major scale.
const SCALE_ORDER = {
  Guitar: ["minor-pentatonic", "major", "major-pentatonic", "minor", "blues", "mixolydian", "dorian", "major-blues"],
  Bass: ["minor-pentatonic", "major", "major-pentatonic", "minor", "blues", "mixolydian", "dorian", "major-blues"],
};

function orderedScales(instrument) {
  const first = SCALE_ORDER[instrument] || ["major", "minor", "major-pentatonic", "minor-pentatonic", "blues", "mixolydian", "dorian", "major-blues"];
  return [...first.map((id) => SCALE[id]), ...SCALES.filter((s) => !first.includes(s.id))];
}

const chordRef = (symbol) => {
  const c = theory.parseChord(symbol);
  return { id: theory.chordId(c.root, c.quality, c.bass), name: theory.chordName(c.root, c.quality, c.bass), root: c.root, quality: c.quality, bass: c.bass };
};

// The slash chords on offer: the common ones, and any a song uses.
function slashChords(analysed) {
  const fromSongs = analysed.flatMap((s) => s.chords).filter((c) => c.id && c.id.includes("/")).map((c) => c.name);
  return [...new Set([...SLASH, ...fromSongs])].map(chordRef);
}

// Everything the page needs before it asks for one root's chords or scales. `analysed` is the
// published songs the library can read (lib/chordLibrary/songs.js); `catalogue` is every published song.
function overview(instrument, { analysed, catalogue }) {
  const kind = KINDS[instrument];
  if (kind === "drums") {
    const byTitle = new Map(catalogue.map((s) => [s.title.trim().toLowerCase(), s]));
    const grooves = drums.GROOVES.map((g) => ({
      ...g,
      songs: (g.songs || []).map((t) => byTitle.get(t.toLowerCase())).filter(Boolean).map((s) => ({ id: s.id, title: s.title })),
    }));
    // Drummers don't get chord lists: a song shows the grooves it uses.
    const songs = catalogue
      .map((s) => ({ id: s.id, title: s.title, artist: s.artist || null, grooves: grooves.filter((g) => g.songs.some((x) => x.id === s.id)).map((g) => ({ id: g.id, name: g.name })) }))
      .filter((s) => s.grooves.length);
    return { instrument, kind, songs, drums: { kit: drums.KIT, counts: drums.COUNTS, grooves, rudiments: drums.RUDIMENTS } };
  }

  return {
    instrument,
    kind,
    songs: analysed,
    tuning: fretted.TUNINGS[instrument] || null,
    roots: ROOTS,
    qualities: QUALITIES.map((q) => ({
      id: q.id,
      suffix: q.suffix,
      name: q.name,
      tier: q.tier,
      about: q.about,
      symmetric: Boolean(q.symmetric),
      intervals: q.intervals.map((iv) => ({ interval: iv, name: INTERVAL_NAMES[iv] })),
    })),
    start: (START[instrument] || []).map(chordRef),
    slash: slashChords(analysed),
    scales: orderedScales(instrument).map((s) => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      about: s.about,
      over: s.over,
      family: s.family,
      intervals: s.intervals.map((iv) => ({ interval: iv, name: INTERVAL_NAMES[iv] })),
      steps: theory.stepPattern(s.id),
    })),
    progressions: PROGRESSIONS.map(({ id, name, mode, about, steps }) => ({ id, name, mode, about, steps })),
    twelveBar: TWELVE_BAR,
    keys: keysTable(),
    ...(kind === "voice" ? { voice: { warmups: keyboard.WARMUPS, intervals: keyboard.INTERVALS } } : {}),
  };
}

// The chords of every major and minor key. A chord is [id, name]; the id is "root:type".
function keysTable() {
  const out = [];
  for (const mode of ["major", "minor"]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      out.push({
        tonic,
        mode,
        name: theory.keyName(tonic, mode),
        chords: theory.diatonicChords(tonic, mode).map((d) => ({
          numeral: d.numeral,
          triad: [theory.chordId(d.triad.root, d.triad.quality), d.triad.name],
          seventh: [theory.chordId(d.seventh.root, d.seventh.quality), d.seventh.name],
        })),
      });
    }
  }
  return out;
}

// One chord's entry: its notes and the instrument's ways to play it.
function chordEntry(instrument, chord) {
  const { notes, bass } = theory.chordNotes(chord.root, chord.quality, chord.bass);
  const entry = {
    id: theory.chordId(chord.root, chord.quality, chord.bass),
    name: theory.chordName(chord.root, chord.quality, chord.bass),
    root: chord.root,
    quality: chord.quality,
    bass: chord.bass,
    notes: notes.map(({ name, interval, pc }) => ({ name, interval, pc })),
    bassNote: bass,
  };
  switch (KINDS[instrument]) {
    case "fretted":
      return { ...entry, voicings: fretted.chordVoicings(instrument, chord) };
    case "bass":
      return { ...entry, voicings: fretted.bassVoicings(chord) };
    case "keys":
      return { ...entry, voicings: keyboard.pianoVoicings(chord) };
    case "voice":
      return { ...entry, voice: keyboard.voiceChord(chord) };
    default:
      return entry;
  }
}

// Built once per instrument and root; the songs are added per request, since they change.
const chordCache = new Map();
const scaleCache = new Map();

// Every chord type on one root for this instrument, and the slash chords that start on it.
function chordsFor(instrument, root, songs) {
  const key = `${instrument}:${root}`;
  if (!chordCache.has(key)) {
    const plain = QUALITIES.map((q) => ({ root, quality: q.id, bass: null }));
    chordCache.set(key, plain.map((c) => chordEntry(instrument, c)));
  }
  const slashes = slashChords(songs)
    .filter((c) => c.root === root)
    .map((c) => chordEntry(instrument, c));
  const chords = [...chordCache.get(key), ...slashes];
  return {
    root: ROOTS[root],
    chords: chords.map((c) => ({ ...c, songs: songsUsing(songs, c.id) })),
  };
}

// Every scale on one root for this instrument.
function scalesFor(instrument, root, songs) {
  const key = `${instrument}:${root}`;
  if (!scaleCache.has(key)) {
    const kind = KINDS[instrument];
    scaleCache.set(
      key,
      orderedScales(instrument).map((s) => {
        const entry = {
          id: s.id,
          name: `${theory.scaleRootName(root, s.id)} ${s.name.toLowerCase()}`,
          rootName: theory.scaleRootName(root, s.id),
          notes: theory.scaleNotes(root, s.id).map(({ name, interval, solfege, pc }) => ({ name, interval, solfege, pc })),
        };
        if (kind === "fretted" || kind === "bass") entry.positions = fretted.scalePositions(instrument, root, s.id);
        if (kind === "keys") entry.piano = keyboard.pianoScale(root, s.id);
        if (kind === "voice") entry.voice = keyboard.voiceScale(root, s.id);
        return entry;
      })
    );
  }
  return {
    root: ROOTS[root],
    scales: scaleCache.get(key).map((s) => ({ ...s, songs: songsForScale(songs, root, s.id) })),
  };
}

// Whether an instrument has chords and scales at all: drums have grooves instead.
const hasHarmony = (instrument) => KINDS[instrument] !== "drums";

module.exports = { KINDS, overview, chordsFor, scalesFor, hasHarmony };
