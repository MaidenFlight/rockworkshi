// What the library says about the school's songs: their chords, the key, each chord's place in
// the key, and the named progressions they use. Read from a song's chart when it has one.
const { PROGRESSIONS, chordId, chordName, detectKey, mod12, parseChord, progressionIn, romanFor } = require("./theory");

// Songs on the site that don't have a chart yet, with the chords they're played with. A chart,
// once added, replaces the entry. Matched by title, ignoring case.
const CHORDS_WITHOUT_CHART = {
  "three little birds": ["A", "D", "E"],
};

// "Verse 2" and "Verse 1" are both the verse.
const sectionKind = (name) => String(name).replace(/\s*\d+$/, "").trim();

// Major-like and minor-like, for matching progressions: an E7 still plays the V of A.
const family = (quality) => (["m", "m7", "m6", "m9"].includes(quality) ? "m" : ["dim", "dim7", "m7b5"].includes(quality) ? "dim" : "maj");

function chordsFromChart(chart) {
  const played = [];
  for (const section of chart.sections || []) {
    for (const bar of section.bars || []) {
      for (const c of bar.chords || []) played.push({ name: c.name, section: sectionKind(section.name) });
    }
  }
  return played;
}

// Where a progression appears in a song: in order in the chart, or, for a song known only by its
// chord list, every one of its chords being in the song.
// A chord list only says which chords, so two progressions of the same three chords count once.
function findProgressions(sequence, chordSet, key) {
  const found = [];
  const sets = new Set();
  for (const progression of PROGRESSIONS) {
    if (progression.mode !== key.mode) continue;
    const wanted = progressionIn(progression, key.tonic).map((c) => `${c.root}:${family(c.quality)}`);
    if (sequence) {
      const at = sequence.findIndex((_, i) => wanted.every((w, j) => sequence[i + j]?.id === w));
      if (at === -1) continue;
      // "Verse into Chorus" when it runs across the join.
      const sections = [...new Set(sequence.slice(at, at + wanted.length).map((c) => c.section))];
      found.push({ id: progression.id, name: progression.name, section: sections.join(" into ") });
    } else if (wanted.every((w) => chordSet.has(w))) {
      const set = [...new Set(wanted)].sort().join(",");
      if (sets.has(set)) continue;
      sets.add(set);
      found.push({ id: progression.id, name: progression.name, section: null, fromChordList: true });
    }
  }
  return found;
}

// Reads one song. Returns null when there's nothing to go on (no chart and no chord list).
function analyseSong(song) {
  let played = song.chart?.sections ? chordsFromChart(song.chart) : null;
  const listed = played ? null : CHORDS_WITHOUT_CHART[String(song.title || "").trim().toLowerCase()];
  if (!played && !listed) return null;
  if (!played) played = listed.map((name) => ({ name, section: null }));

  // Each chord once, with how many bars it's played in and which sections.
  const byName = new Map();
  for (const { name, section } of played) {
    const entry = byName.get(name) || { name, count: 0, sections: [] };
    entry.count += 1;
    if (section && !entry.sections.includes(section)) entry.sections.push(section);
    byName.set(name, entry);
  }
  const chords = [...byName.values()].map((c) => ({ ...c, chord: parseChord(c.name) }));
  const key = detectKey(chords.map((c) => ({ chord: c.chord, count: listed ? 1 : c.count })));

  // The chord order with slash chords folded into their chord and repeats run together, for
  // finding progressions: C, C/B, Am becomes C, Am.
  let sequence = null;
  if (!listed) {
    sequence = [];
    for (const { name, section } of played) {
      const c = parseChord(name);
      if (!c) continue;
      const id = `${c.root}:${family(c.quality)}`;
      if (sequence[sequence.length - 1]?.id !== id) sequence.push({ id, section });
    }
  }
  const chordSet = new Set(chords.filter((c) => c.chord).map((c) => `${c.chord.root}:${family(c.chord.quality)}`));

  return {
    id: song.id,
    title: song.title,
    artist: song.artist || null,
    key: key ? { tonic: key.tonic, mode: key.mode, name: key.name } : null,
    fromChart: !listed,
    chords: chords
      .sort((a, b) => b.count - a.count)
      .map((c) => ({
        name: c.name,
        // The library's id for the chord, or null for a symbol it doesn't know.
        id: c.chord ? chordId(c.chord.root, c.chord.quality, c.chord.bass) : null,
        display: c.chord ? chordName(c.chord.root, c.chord.quality, c.chord.bass) : c.name,
        numeral: c.chord && key ? romanFor(c.chord, key.tonic, key.mode) : null,
        bars: listed ? null : c.count,
        sections: c.sections,
      })),
    progressions: key ? findProgressions(sequence, chordSet, key) : [],
  };
}

// Song entries for one chord id, for its "Played in" line.
function songsUsing(analysed, id) {
  return analysed
    .map((song) => {
      const c = song.chords.find((x) => x.id === id);
      return c ? { id: song.id, title: song.title, bars: c.bars, sections: c.sections, numeral: c.numeral } : null;
    })
    .filter(Boolean);
}

// The scales a soloist reaches for in a key, by how far their root sits above the key's home
// note. A major key's own scales, and its relative minor's, which share its notes (A minor
// pentatonic over a song in C); likewise for a minor key. Modes aren't offered: D dorian has C
// major's notes but isn't what a player means by playing over a C song.
const SCALES_FOR_KEY = {
  major: { major: 0, "major-pentatonic": 0, "major-blues": 0, minor: 9, "minor-pentatonic": 9, blues: 9 },
  minor: { minor: 0, "minor-pentatonic": 0, blues: 0, "harmonic-minor": 0, major: 3, "major-pentatonic": 3 },
};

// The songs a scale on this root fits, for its "Use it in" line.
function songsForScale(analysed, root, scaleId) {
  return analysed
    .filter((song) => {
      if (!song.key) return false;
      const offset = SCALES_FOR_KEY[song.key.mode][scaleId];
      return offset !== undefined && mod12(song.key.tonic + offset) === mod12(root);
    })
    .map((song) => ({ id: song.id, title: song.title, key: song.key.name, relative: SCALES_FOR_KEY[song.key.mode][scaleId] !== 0 }));
}

module.exports = { analyseSong, songsUsing, songsForScale, CHORDS_WITHOUT_CHART };
