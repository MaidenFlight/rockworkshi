// The chord and scale library: that what it teaches is right, and that each member only gets
// their own instrument's. The HTTP tests run against the dev database in .env with throwaway
// @example.test accounts and songs.
require("dotenv").config({ quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const theory = require("../src/lib/chordLibrary/theory");
const fretted = require("../src/lib/chordLibrary/fretted");
const keyboard = require("../src/lib/chordLibrary/keyboard");
const drums = require("../src/lib/chordLibrary/drums");
const { analyseSong, songsForScale } = require("../src/lib/chordLibrary/songs");
const rainChart = require("../charts/have-you-ever-seen-the-rain.json");

const show = (fs) => fs.map((f) => (f < 0 ? "x" : f)).join(" ");

// ---------- What it teaches ----------

test("every guitar and ukulele voicing plays exactly its chord, with a hand that can reach it", () => {
  for (const instrument of ["Guitar", "Ukulele"]) {
    const tuning = fretted.TUNINGS[instrument];
    for (let root = 0; root < 12; root++) {
      for (const q of theory.QUALITIES) {
        const chord = { root, quality: q.id, bass: null };
        const voicings = fretted.chordVoicings(instrument, chord);
        assert.ok(voicings.length, `${instrument} has a shape for ${theory.chordName(root, q.id)}`);
        for (const v of voicings) {
          const name = `${instrument} ${theory.chordName(root, q.id)} ${show(v.frets)}`;
          assert.ok(fretted.makesChord(v.frets, tuning, chord), `${name} makes the chord`);
          assert.ok(Math.max(...v.frets) <= tuning.frets, `${name} fits the neck`);
          const fretted_ = v.frets.filter((f) => f > 0);
          if (fretted_.length) assert.ok(Math.max(...fretted_) - Math.min(...fretted_) <= 3, `${name} spans four frets at most`);
          v.frets.forEach((f, i) => assert.equal(f > 0, v.fingers[i] > 0, `${name}: a finger on every fretted string and no other`));
          assert.ok(v.fingers.every((f) => f <= 4), `${name} uses four fingers`);
        }
      }
    }
  }
});

test("the slash chords keep their bass note at the bottom", () => {
  const tuning = fretted.TUNINGS.Guitar;
  for (const extra of fretted.GUITAR_EXTRAS.filter((e) => e.chord.includes("/"))) {
    const chord = theory.parseChord(extra.chord);
    const [v] = fretted.chordVoicings("Guitar", chord);
    assert.ok(v, `${extra.chord} has a shape`);
    const lowest = Math.min(...v.midi);
    assert.equal(theory.mod12(lowest), chord.bass, `${extra.chord}'s lowest note is its bass`);
    assert.ok(fretted.makesChord(v.frets, tuning, chord));
  }
});

test("open chords get the fingerings teachers use", () => {
  const fingers = (symbol) => fretted.chordVoicings("Guitar", theory.parseChord(symbol)).find((v) => v.label === "Open position").fingers.join("");
  assert.equal(fingers("C"), "032010");
  assert.equal(fingers("G"), "210003");
  assert.equal(fingers("D"), "000132");
  assert.equal(fingers("A"), "001230");
  assert.equal(fingers("E"), "023100");
  assert.equal(fingers("Am"), "002310");
  assert.equal(fingers("Dm"), "000231");
  assert.equal(fingers("C7"), "032410");
  const f = fretted.chordVoicings("Guitar", theory.parseChord("F")).find((v) => v.label.startsWith("E shape"));
  assert.equal(show(f.frets), "1 3 3 2 1 1");
  assert.equal(f.fingers.join(""), "134211");
  assert.deepEqual(f.barres[0], { fret: 1, from: 0, to: 5, finger: 1 });
  const uke = fretted.chordVoicings("Ukulele", theory.parseChord("C"))[0];
  assert.equal(show(uke.frets), "0 0 0 3");
  assert.equal(uke.fingers.join(""), "0003", "the open C's ring finger");
});

test("C has all five CAGED positions on guitar, low to high", () => {
  const c = fretted.chordVoicings("Guitar", theory.parseChord("C"));
  assert.deepEqual(c.map((v) => v.shape), ["C", "A", "G", "E", "D"]);
  assert.deepEqual(c.map((v) => show(v.frets)), ["x 3 2 0 1 0", "x 3 5 5 5 3", "8 7 5 5 5 8", "8 10 10 9 8 8", "x x 10 12 13 12"]);
});

test("bass gets the chord as an arpeggio from the root, and a slash chord from its bass note", () => {
  const [onE, onA] = fretted.bassVoicings(theory.parseChord("C"));
  assert.deepEqual(onA.dots.map((d) => [d.string, d.fret, d.interval]), [[1, 3, "1"], [2, 2, "3"], [2, 5, "5"], [3, 5, "1"]]);
  assert.deepEqual(onE.dots.map((d) => [d.string, d.fret]), [[0, 8], [1, 7], [1, 10], [2, 10]]);
  const [cOverB] = fretted.bassVoicings(theory.parseChord("C/B"));
  assert.equal(theory.mod12(cOverB.midi[0]), 11, "C/B starts on B");
});

test("piano inversions climb with the right fingers", () => {
  const c = keyboard.pianoVoicings(theory.parseChord("C"));
  assert.deepEqual(c.map((v) => v.right), [[60, 64, 67], [64, 67, 72], [55, 60, 64]]);
  assert.deepEqual(c.map((v) => v.fingers), [[1, 3, 5], [1, 2, 5], [1, 3, 5]]);
  assert.deepEqual(keyboard.pianoVoicings(theory.parseChord("Cm"))[0].fingers, [1, 3, 5]);
  assert.deepEqual(keyboard.pianoVoicings(theory.parseChord("C7"))[1].fingers, [1, 2, 4, 5], "a 2nd on top takes 4 and 5");
  assert.deepEqual(keyboard.pianoVoicings(theory.parseChord("Am/G"))[0].left, [43], "the left hand plays the slash note");
  const nine = keyboard.pianoVoicings(theory.parseChord("C9"));
  assert.ok(nine.every((v) => !v.right.some((m) => theory.mod12(m) === 0)), "the right hand leaves the root to the left");
});

test("notes are spelled the way charts and key signatures spell them", () => {
  const names = (root, id) => theory.scaleNotes(root, id).map((n) => n.name).join(" ");
  assert.equal(names(6, "major"), "F# G# A# B C# D# E#");
  assert.equal(names(1, "major"), "Db Eb F Gb Ab Bb C");
  assert.equal(names(1, "minor"), "C# D# E F# G# A B");
  assert.equal(names(3, "blues"), "Eb Gb Ab A Bb Db");
  assert.equal(names(9, "minor-pentatonic"), "A C D E G");
  assert.equal(theory.stepPattern("major").join(" "), "W W H W W W H");
  const chord = (s) => theory.chordNotes(theory.parseChord(s).root, theory.parseChord(s).quality).notes.map((n) => n.name).join(" ");
  assert.equal(chord("F#"), "F# A# C#");
  assert.equal(chord("Db7"), "Db F Ab B");
  assert.equal(chord("C#m"), "C# E G#");
  assert.equal(theory.chordName(1, "maj"), "Db");
  assert.equal(theory.chordName(1, "m"), "C#m");
  assert.equal(theory.chordName(9, "maj", 1), "A/C#", "a bass note from the chord keeps its spelling");
  assert.equal(theory.chordName(0, "maj", 11), "C/B");
});

test("chord symbols parse, including slash chords and other spellings", () => {
  assert.deepEqual(theory.parseChord("Am/G"), { root: 9, quality: "m", bass: 7 });
  assert.deepEqual(theory.parseChord("F#m7"), { root: 6, quality: "m7", bass: null });
  assert.deepEqual(theory.parseChord("Bbmaj7"), { root: 10, quality: "maj7", bass: null });
  assert.deepEqual(theory.parseChord("Gsus"), { root: 7, quality: "sus4", bass: null });
  assert.equal(theory.parseChord("H7"), null);
  assert.equal(theory.parseChord("Cfoo"), null);
});

test("pentatonic boxes start from the root", () => {
  const [box1] = fretted.scalePositions("Guitar", 9, "minor-pentatonic");
  assert.equal(box1.label, "Box 1 · 5th fret");
  const notes = theory.scaleNotes(9, "minor-pentatonic");
  const lowE = box1.dots.filter(([s]) => s === 0).map(([, f, k]) => [f, notes[k].name]);
  assert.deepEqual(lowE, [[5, "A"], [8, "C"]]);
  const blues = fretted.scalePositions("Guitar", 9, "blues")[0];
  assert.ok(blues.dots.some(([s, f]) => s === 1 && f === 6), "the blue note on the A string's 6th fret");
});

test("piano scales come with fingers, in every major and minor key", () => {
  for (let root = 0; root < 12; root++) {
    for (const id of ["major", "minor"]) {
      const { right, fingers } = keyboard.pianoScale(root, id);
      assert.equal(right.length, 8);
      assert.equal(fingers.right.length, 8);
      // A thumb never lands on a black key.
      right.forEach((m, i) => {
        if (fingers.right[i] === 1) assert.ok(![1, 3, 6, 8, 10].includes(theory.mod12(m)), `${theory.scaleRootName(root, id)} ${id}: right thumb on a white key`);
        if (fingers.left[i] === 1) assert.ok(![1, 3, 6, 8, 10].includes(theory.mod12(m)), `${theory.scaleRootName(root, id)} ${id}: left thumb on a white key`);
      });
    }
  }
});

test("songs are read for their key, numerals and progressions", () => {
  const rain = analyseSong({ id: "rain", title: rainChart.title, chart: rainChart });
  assert.equal(rain.key.name, "C major");
  assert.deepEqual(Object.fromEntries(rain.chords.map((c) => [c.name, c.numeral])), { C: "I", G: "V", F: "IV", Am: "vi", "C/B": "I/7", "Am/G": "vi/5" });
  const found = Object.fromEntries(rain.progressions.map((p) => [p.id, p.section]));
  assert.equal(found["vi-IV-I-V"], "Intro");
  assert.equal(found["IV-V-I"], "Chorus");
  assert.equal(found["I-V-vi-IV"], undefined, "not in the song");

  const birds = analyseSong({ id: "birds", title: "Three Little Birds", chart: null });
  assert.equal(birds.key.name, "A major");
  assert.deepEqual(birds.chords.map((c) => c.numeral), ["I", "IV", "V"]);
  assert.deepEqual(birds.progressions.map((p) => p.id), ["I-IV-V"], "one progression per set of chords");
  assert.equal(analyseSong({ id: "x", title: "A song nobody charted", chart: null }), null);

  assert.deepEqual(songsForScale([rain, birds], 9, "minor-pentatonic").map((s) => s.id), ["rain"], "A minor pentatonic over C major");
  assert.deepEqual(songsForScale([rain, birds], 9, "dorian"), [], "a mode isn't offered");
  assert.deepEqual(songsForScale([rain, birds], 9, "major-pentatonic").map((s) => s.id), ["birds"]);
});

test("every groove and rudiment is one well-formed bar", () => {
  const kit = new Set(drums.KIT.map((k) => k.id));
  for (const g of drums.GROOVES) {
    assert.ok(drums.COUNTS[g.steps], `${g.id} has a count`);
    for (const [row, hits] of Object.entries(g.rows)) {
      assert.ok(kit.has(row), `${g.id}: ${row} is a drum`);
      assert.match(hits, /^[xX.]+$/);
      assert.equal(hits.length, g.steps, `${g.id}: ${row} fills the bar`);
    }
  }
  for (const r of drums.RUDIMENTS) {
    const strokes = r.sticking.split(" ");
    assert.equal(strokes.length, r.steps, `${r.id} fills the bar`);
    for (const s of strokes) assert.match(s, /^(-|>?[lr]{0,2}[RL])$/, `${r.id}: ${s}`);
  }
});

// ---------- Who gets what ----------

const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const RUN = `chords-test-${Date.now()}`;
let server;
let base;
const users = {};
const tokens = {};
let song;

async function call(who, path) {
  const res = await fetch(base + path, { headers: who ? { Authorization: `Bearer ${tokens[who]}` } : {} });
  return { status: res.status, data: await res.json().catch(() => null) };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  const paid = { paidAt: new Date() };
  const make = async (name, data, roles = []) => {
    users[name] = await prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", ...data } });
    for (const role of roles) await prisma.userRole.create({ data: { userId: users[name].id, role } });
    users[name] = await prisma.user.findUnique({ where: { id: users[name].id }, include: { roles: true } });
    tokens[name] = signMobileToken(users[name], "10m");
  };
  await make("guitar", { ...paid, instrument: "Guitar" });
  await make("bass", { ...paid, instrument: "bass" });
  await make("drums", { ...paid, instrument: "Drums" });
  await make("none", { ...paid });
  await make("unpaid", { instrument: "Guitar" });
  await make("teacher", { role: "teacher", instrument: "Piano" }, ["teacher"]);
  song = await prisma.song.create({ data: { title: `${RUN} Rain`, artist: "Band", chart: rainChart } });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.$disconnect();
  server.close();
});

test("the library needs a membership", async () => {
  assert.equal((await call(null, "/chord-library")).status, 401);
  assert.equal((await call("unpaid", "/chord-library")).status, 402);
  assert.equal((await call("unpaid", "/chord-library/chords/C")).status, 402);
});

test("a student gets their own instrument's library and can't ask for another", async () => {
  const mine = await call("guitar", "/chord-library");
  assert.equal(mine.status, 200);
  assert.equal(mine.data.instrument, "Guitar");
  assert.equal(mine.data.staff, false);
  assert.equal(mine.data.instruments, undefined, "no list of other instruments");
  assert.deepEqual(mine.data.tuning.strings, ["E", "A", "D", "G", "B", "E"]);

  for (const path of ["/chord-library?instrument=Bass", "/chord-library/chords/C?instrument=Piano", "/chord-library/scales/A?instrument=Ukulele"]) {
    const refused = await call("guitar", path);
    assert.equal(refused.status, 403, path);
    assert.equal(refused.data.reason, "instrument");
  }
  assert.equal((await call("guitar", "/chord-library?instrument=guitar")).status, 200, "asking for your own is fine");

  const chords = await call("guitar", "/chord-library/chords/C");
  assert.equal(chords.status, 200);
  const c = chords.data.chords.find((x) => x.name === "C");
  assert.ok(c.voicings.every((v) => v.frets.length === 6), "six-string shapes only");

  // The bass student's instrument is stored in lower case and still counts as Bass.
  const bass = await call("bass", "/chord-library/chords/C");
  assert.equal(bass.data.instrument, "Bass");
  assert.ok(bass.data.chords.every((x) => x.voicings.every((v) => v.dots && !v.frets)), "arpeggios, no guitar shapes");
  const bassScales = await call("bass", "/chord-library/scales/A");
  assert.ok(bassScales.data.scales.every((s) => s.positions.every((p) => p.dots.every(([string]) => string < 4))), "four strings");
});

test("staff can open any instrument's library", async () => {
  const own = await call("teacher", "/chord-library");
  assert.equal(own.data.instrument, "Piano");
  assert.equal(own.data.staff, true);
  assert.ok(own.data.instruments.includes("Drums"));
  const other = await call("teacher", "/chord-library/chords/G?instrument=Ukulele");
  assert.equal(other.status, 200);
  assert.equal(other.data.instrument, "Ukulele");
  assert.equal((await call("teacher", "/chord-library?instrument=Kazoo")).status, 400);
});

test("a student with no instrument is told to ask the school", async () => {
  const res = await call("none", "/chord-library");
  assert.equal(res.status, 409);
  assert.equal(res.data.reason, "no_instrument");
});

test("drummers get grooves and rudiments, not chords", async () => {
  const lib = await call("drums", "/chord-library");
  assert.equal(lib.data.kind, "drums");
  assert.ok(lib.data.drums.grooves.length >= 8);
  assert.ok(lib.data.drums.rudiments.length >= 8);
  assert.equal(lib.data.qualities, undefined);
  const chords = await call("drums", "/chord-library/chords/C");
  assert.equal(chords.status, 404);
  assert.equal(chords.data.reason, "no_harmony");
});

test("chords and scales link to the songs that use them", async () => {
  const lib = await call("guitar", "/chord-library");
  const mine = lib.data.songs.find((s) => s.id === song.id);
  assert.equal(mine.key.name, "C major");
  assert.ok(lib.data.slash.some((c) => c.name === "Am/G"));

  const chords = await call("guitar", "/chord-library/chords/0");
  const c = chords.data.chords.find((x) => x.name === "C");
  const usage = c.songs.find((s) => s.id === song.id);
  assert.equal(usage.bars, 40);
  assert.equal(usage.numeral, "I");
  const slash = chords.data.chords.find((x) => x.name === "C/B");
  assert.ok(slash.songs.some((s) => s.id === song.id), "the slash chord too");

  const scales = await call("guitar", "/chord-library/scales/A");
  const pent = scales.data.scales.find((s) => s.id === "minor-pentatonic");
  assert.ok(pent.songs.some((s) => s.id === song.id));
  assert.equal((await call("guitar", "/chord-library/chords/H")).status, 400);

  // An edit to the song is picked up on the next request.
  await prisma.song.update({ where: { id: song.id }, data: { published: false } });
  const after = await call("guitar", "/chord-library");
  assert.ok(!after.data.songs.some((s) => s.id === song.id), "unpublished songs drop out");
});
