const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { presentLibrarySong } = require("../lib/practice");
const { loadAccess } = require("../lib/termAccess");
const { scopeFor, partForInstrument } = require("../lib/instrumentAccess");

// The signed-in student's practice library: every published song with their own
// favourite / notes / last-opened state, plus the song to continue with.
const router = express.Router();

router.get("/", requirePaid, async (req, res) => {
  const songs = await prisma.song.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      artist: true,
      level: true,
      tracks: { select: { part: true } },
      practice: {
        where: { userId: req.user.id },
        select: { favorite: true, notes: true, lastOpenedAt: true, session: true },
      },
    },
  });

  const access = await loadAccess(req.user);
  // A student's list names only their own stem: the others are never theirs to open.
  const scope = scopeFor(req.user);
  const myPart = scope.staff ? undefined : partForInstrument(scope.instrument);
  const present = (song) => presentLibrarySong(song, myPart);
  const verdicts = new Map(songs.map((song) => [song.id, access.song(song.id)]));
  const locked = (song) => !verdicts.get(song.id).allowed;
  // Why it's shut, so the page never promises a term unlock to someone outside that term:
  // "locked" (later in their term), "preparing" (date passed, not published) or "not_in_term".
  const lockReason = (song) => verdicts.get(song.id).reason ?? null;

  // Most recently opened song the student can still open and play, with where they left off in it.
  let latest = null;
  for (const song of songs) {
    if (locked(song) || !song.tracks.length) continue;
    const opened = song.practice[0]?.lastOpenedAt;
    if (opened && (!latest || opened > latest.practice[0].lastOpenedAt)) latest = song;
  }

  res.json({
    // Term songs that haven't opened for this student are listed but marked locked.
    songs: songs.map((song) => ({ ...present(song), locked: locked(song), lockReason: lockReason(song) })),
    // Whose list this is: staff see every stem; a student only their own instrument's (null if unset).
    scope: scope.staff ? "all" : "instrument",
    instrument: scope.staff ? null : scope.instrument,
    continue: latest
      ? {
          song: present(latest),
          position: latest.practice[0].session?.position ?? null,
          lastOpenedAt: latest.practice[0].lastOpenedAt,
        }
      : null,
  });
});

module.exports = router;
