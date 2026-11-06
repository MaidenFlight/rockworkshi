const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { isStaff } = require("../lib/termAccess");
const { INSTRUMENTS } = require("../lib/lessonVideos");
const library = require("../lib/chordLibrary/library");
const { analyseSong } = require("../lib/chordLibrary/songs");
const { pitchClass } = require("../lib/chordLibrary/theory");

// The chord and scale library (lib/chordLibrary/library.js), for members. A student gets the library for
// the instrument the school has on file for them (User.instrument) and nothing about any other:
// asking for another is refused, not quietly answered with theirs. Staff teach every instrument,
// so they can open any of them.
const router = express.Router();
router.use(requirePaid);

// "guitar" or " Guitar " -> "Guitar"; null for anything that isn't one of the six.
function instrumentName(value) {
  if (typeof value !== "string") return null;
  const wanted = value.trim().toLowerCase();
  return INSTRUMENTS.find((name) => name.toLowerCase() === wanted) || null;
}

// Which instrument this request gets, or null once a refusal has been sent.
function instrumentFor(req, res) {
  const own = instrumentName(req.user.instrument);
  const staff = isStaff(req.user);
  const asked = req.query.instrument;
  if (asked !== undefined && instrumentName(asked) !== own) {
    if (!staff) {
      res.status(403).json({ error: "The library opens for the instrument you study.", reason: "instrument" });
      return null;
    }
    const name = instrumentName(asked);
    if (!name) {
      res.status(400).json({ error: `instrument must be one of: ${INSTRUMENTS.join(", ")}.` });
      return null;
    }
    return name;
  }
  if (own) return own;
  if (staff) return "Guitar";
  res.status(409).json({
    error: "Your account doesn't have an instrument yet, so the library has nothing to show. Ask the school to set it.",
    reason: "no_instrument",
  });
  return null;
}

// "C", "Db", "C#" or 0-11.
function rootFrom(value) {
  if (/^\d{1,2}$/.test(value) && Number(value) < 12) return Number(value);
  return pitchClass(String(value).replace("♯", "#").replace("♭", "b"));
}

// Published songs, each read once per edit: a chart can be large, so it's only fetched for a song
// that's new or has changed since it was last read.
const analyses = new Map();
async function loadSongs() {
  const songs = await prisma.song.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    select: { id: true, title: true, artist: true, updatedAt: true },
  });
  const stale = songs.filter((s) => analyses.get(s.id)?.stamp !== s.updatedAt.getTime());
  if (stale.length) {
    const charts = await prisma.song.findMany({ where: { id: { in: stale.map((s) => s.id) } }, select: { id: true, chart: true } });
    const chartOf = new Map(charts.map((c) => [c.id, c.chart]));
    for (const s of stale) analyses.set(s.id, { stamp: s.updatedAt.getTime(), result: analyseSong({ ...s, chart: chartOf.get(s.id) }) });
  }
  return {
    catalogue: songs.map(({ id, title, artist }) => ({ id, title, artist })),
    analysed: songs.map((s) => analyses.get(s.id).result).filter(Boolean),
  };
}

router.get("/", async (req, res) => {
  const instrument = instrumentFor(req, res);
  if (!instrument) return;
  const songs = await loadSongs();
  const staff = isStaff(req.user);
  res.json({
    ...library.overview(instrument, songs),
    staff,
    // Only staff get the list of instruments to switch between.
    ...(staff ? { instruments: INSTRUMENTS } : {}),
  });
});

for (const [path, build] of [
  ["chords", library.chordsFor],
  ["scales", library.scalesFor],
]) {
  router.get(`/${path}/:root`, async (req, res) => {
    const instrument = instrumentFor(req, res);
    if (!instrument) return;
    if (!library.hasHarmony(instrument)) {
      return res.status(404).json({ error: `The ${instrument.toLowerCase()} library has grooves and rudiments instead.`, reason: "no_harmony" });
    }
    const root = rootFrom(req.params.root);
    if (root === null) return res.status(400).json({ error: "root must be a note name, such as C or F#." });
    const { analysed } = await loadSongs();
    res.json({ instrument, ...build(instrument, root, analysed) });
  });
}

module.exports = router;
