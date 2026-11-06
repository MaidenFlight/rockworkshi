const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { isMediaConfigured, mediaLink } = require("../lib/media");
const { sortTracks } = require("../lib/songTracks");
const { MAX_PRESETS_PER_SONG, validateName, presentPreset } = require("../lib/mixPresets");
const { validateSession, validateNotes, presentPractice } = require("../lib/practice");
const { loadAccess, denialMessage, linkSeconds, isStaff } = require("../lib/termAccess");
const { NO_INSTRUMENT, scopeFor, partForInstrument, chartFor, studentPlayback, validateMixer, mixerFits } = require("../lib/instrumentAccess");
const { isDemo, demoSongAudio } = require("../lib/demoRules");
const { INSTRUMENTS, canonicalInstrument, presentTutorials } = require("../lib/lessonVideos");

const router = express.Router();

// Mounted at /songs ahead of the public routes, which own GET /songs itself.
// requirePaid goes on each route, not router.use, so it doesn't block that public list.
// Staff get every stem and the whole chart. A student gets their own stem, the backing band and
// their own chart, and nothing else, whatever they ask for (lib/instrumentAccess.js). The student demo
// gets every stem, with the chart of the student it shows.
router.get("/:id/tracks", requirePaid, async (req, res) => {
  const song = await prisma.song.findUnique({
    where: { id: req.params.id },
    include: { tracks: true, mixes: true },
  });
  if (!song || !song.published) return res.status(404).json({ error: "Not found." });
  // Term songs only reach students whose month has opened (lib/termAccess.js).
  const access = (await loadAccess(req.user)).song(song.id);
  if (!access.allowed) return res.status(403).json({ error: denialMessage(access.reason), reason: access.reason });
  if (!song.tracks.length) return res.status(404).json({ error: "This song has no tracks yet." });
  const scope = scopeFor(req.user);
  if (!scope.staff && !scope.instrument) return res.status(403).json({ error: NO_INSTRUMENT, reason: "no_instrument" });

  const about = {
    song: { id: song.id, title: song.title, artist: song.artist },
    // The players set their headroom from this. null = not measured yet (see songs:measure).
    mixLevel: song.mixLevel,
  };
  // The student demo gets its chart without the recording when DEMO_SONG_AUDIO=off (lib/demoRules.js).
  if (isDemo(req.user) && !demoSongAudio()) {
    const { chart, available } = chartFor(song.chart, scope.instrument);
    return res.json({
      ...about,
      scope: "instrument",
      instrument: scope.instrument,
      myPart: partForInstrument(scope.instrument),
      tracks: [],
      available: { own: false, backing: false, chart: available },
      chart,
      demo: { audio: false },
    });
  }
  if (!isMediaConfigured()) return res.status(503).json({ error: "Song storage is not configured." });
  if (!scope.allStems) return res.json({ ...about, ...(await studentPlayback(song, scope.instrument, linkSeconds(access))) });

  const tracks = await Promise.all(
    sortTracks(song.tracks).map(async (t) => ({ part: t.part, url: await mediaLink(t.storageKey, linkSeconds(access)) }))
  );
  if (!scope.staff) {
    // The student demo: every stem and the full mixer, but the instrument and chart of the student it
    // shows, so the chart is still theirs alone.
    const { chart, available } = chartFor(song.chart, scope.instrument);
    return res.json({
      ...about,
      scope: "all",
      instrument: scope.instrument,
      tracks,
      myPart: partForInstrument(scope.instrument),
      available: { chart: available },
      chart,
    });
  }
  res.json({
    ...about,
    scope: "all",
    tracks,
    myPart: partForInstrument(req.user.instrument),
    // Served here, behind the same checks as the stems. null until a chart is added.
    chart: song.chart,
  });
});

// The song's video tutorials, behind the same checks as its stems. A student only ever gets their
// own instrument's published videos; asking for another is refused, not quietly answered. Staff
// can look at any instrument's, as that instrument's students see them.
router.get("/:id/tutorials", requirePaid, async (req, res) => {
  const song = await findPlayableSong(req.params.id);
  if (!song) return res.status(404).json({ error: "Not found." });
  const access = (await loadAccess(req.user)).song(song.id);
  if (!access.allowed) return res.status(403).json({ error: denialMessage(access.reason), reason: access.reason });

  const own = canonicalInstrument(req.user.instrument);
  let instrument = own;
  if (req.query.instrument !== undefined) {
    const asked = canonicalInstrument(req.query.instrument);
    if (!isStaff(req.user)) {
      if (!asked || asked !== own) {
        return res.status(403).json({ error: "You can only see the video tutorials for your own instrument.", reason: "instrument" });
      }
    } else if (!asked) {
      return res.status(400).json({ error: `instrument must be one of: ${INSTRUMENTS.join(", ")}.` });
    }
    instrument = asked;
  }

  // Only this instrument's published rows are read, so no other instrument's ids or links can leak.
  const videos = instrument
    ? await prisma.lessonVideo.findMany({ where: { songId: song.id, instrument, published: true } })
    : [];
  res.json(presentTutorials(videos, instrument));
});

// ---------- Mix presets: each student's own, per song ----------

async function findPlayableSong(id) {
  const song = await prisma.song.findUnique({ where: { id } });
  return song && song.published ? song : null;
}

// A student only sees presets made for the instrument they have now; older ones stay stored but unused.
router.get("/:id/mix-presets", requirePaid, async (req, res) => {
  if (!(await findPlayableSong(req.params.id))) return res.status(404).json({ error: "Not found." });
  const scope = scopeFor(req.user);
  const presets = await prisma.mixPreset.findMany({
    where: { userId: req.user.id, songId: req.params.id },
    orderBy: { name: "asc" },
  });
  res.json({ presets: presets.filter((p) => mixerFits(p.settings, scope)).map(presentPreset) });
});

// Saving under a name that already exists replaces that preset.
router.put("/:id/mix-presets", requirePaid, async (req, res) => {
  const { error: nameError, name } = validateName(req.body?.name);
  if (nameError) return res.status(400).json({ error: nameError });
  const { error, settings } = validateMixer(req.body?.settings, scopeFor(req.user));
  if (error) return res.status(400).json({ error });
  if (!(await findPlayableSong(req.params.id))) return res.status(404).json({ error: "Not found." });

  const key = { userId_songId_name: { userId: req.user.id, songId: req.params.id, name } };
  const existing = await prisma.mixPreset.findUnique({ where: key });
  if (!existing) {
    const count = await prisma.mixPreset.count({ where: { userId: req.user.id, songId: req.params.id } });
    if (count >= MAX_PRESETS_PER_SONG) {
      return res.status(409).json({ error: `You can keep up to ${MAX_PRESETS_PER_SONG} presets per song.` });
    }
  }

  const preset = await prisma.mixPreset.upsert({
    where: key,
    create: { userId: req.user.id, songId: req.params.id, name, settings },
    update: { settings },
  });
  res.status(existing ? 200 : 201).json({ preset: presentPreset(preset) });
});

// ---------- Practice state: favourite, notes, where the student left off ----------
// Every query is keyed on req.user.id, so a student only ever reads or writes their own row.

function practiceKey(req) {
  return { userId_songId: { userId: req.user.id, songId: req.params.id } };
}

function savePractice(req, data) {
  return prisma.songPractice.upsert({
    where: practiceKey(req),
    create: { userId: req.user.id, songId: req.params.id, ...data },
    update: data,
  });
}

// Includes the song's own details, so its page works even for songs without stems.
router.get("/:id/practice", requirePaid, async (req, res) => {
  const song = await findPlayableSong(req.params.id);
  if (!song) return res.status(404).json({ error: "Not found." });
  const practice = await prisma.songPractice.findUnique({ where: practiceKey(req) });
  const access = (await loadAccess(req.user)).song(song.id);
  const scope = scopeFor(req.user);
  res.json({
    song: { id: song.id, title: song.title, artist: song.artist, level: song.level },
    // A mixer saved for a different instrument is dropped, so it can't come back after a change.
    practice: presentPractice(practice, (mixer) => mixerFits(mixer, scope)),
    // The page shows a locked state instead of the player; /tracks refuses either way.
    access: { allowed: access.allowed, reason: access.reason || null, message: access.allowed ? null : denialMessage(access.reason) },
    // Whose player this is: everything (staff) or one instrument, null when theirs isn't set.
    player: scope.staff ? { scope: "all" } : { scope: "instrument", instrument: scope.instrument },
  });
});

// Called when the student opens the song, for "Continue practising".
router.post("/:id/practice/opened", requirePaid, async (req, res) => {
  if (!(await findPlayableSong(req.params.id))) return res.status(404).json({ error: "Not found." });
  await savePractice(req, { lastOpenedAt: new Date() });
  res.status(204).end();
});

router.put("/:id/favorite", requirePaid, async (req, res) => {
  if (typeof req.body?.favorite !== "boolean") return res.status(400).json({ error: "favorite must be true or false." });
  if (!(await findPlayableSong(req.params.id))) return res.status(404).json({ error: "Not found." });
  const practice = await savePractice(req, { favorite: req.body.favorite });
  res.json({ favorite: practice.favorite });
});

router.put("/:id/notes", requirePaid, async (req, res) => {
  const { error, notes } = validateNotes(req.body?.notes);
  if (error) return res.status(400).json({ error });
  if (!(await findPlayableSong(req.params.id))) return res.status(404).json({ error: "Not found." });
  const practice = await savePractice(req, { notes });
  res.json({ notes: practice.notes, updatedAt: practice.updatedAt });
});

// Automatic resume state. Merged into what's stored, so the website (no speed or loop)
// doesn't wipe the phone's. Separate from mix presets: a named preset is never touched.
router.put("/:id/practice/session", requirePaid, async (req, res) => {
  const scope = scopeFor(req.user);
  const { error, session } = validateSession(req.body?.session, (mixer) => validateMixer(mixer, scope));
  if (error) return res.status(400).json({ error });
  if (!(await findPlayableSong(req.params.id))) return res.status(404).json({ error: "Not found." });
  const existing = await prisma.songPractice.findUnique({ where: practiceKey(req), select: { session: true } });
  await savePractice(req, { session: { ...(existing?.session || {}), ...session }, sessionSavedAt: new Date() });
  res.status(204).end();
});

router.delete("/:id/mix-presets/:presetId", requirePaid, async (req, res) => {
  // Scoped to the signed-in student, so someone else's preset id deletes nothing.
  const { count } = await prisma.mixPreset.deleteMany({
    where: { id: req.params.presetId, userId: req.user.id, songId: req.params.id },
  });
  if (!count) return res.status(404).json({ error: "Not found." });
  res.status(204).end();
});

module.exports = router;
