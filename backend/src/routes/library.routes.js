const express = require("express");
const prisma = require("../lib/prisma");
const { requirePaid } = require("../middleware/auth");
const { presentLibrarySong } = require("../lib/practice");
const { loadAccess } = require("../lib/termAccess");

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
  const locked = (song) => !access.song(song.id).allowed;

  // Most recently opened song the student can still open and play, with where they left off in it.
  let latest = null;
  for (const song of songs) {
    if (locked(song) || !song.tracks.length) continue;
    const opened = song.practice[0]?.lastOpenedAt;
    if (opened && (!latest || opened > latest.practice[0].lastOpenedAt)) latest = song;
  }

  res.json({
    // Term songs that haven't opened for this student are listed but marked locked.
    songs: songs.map((song) => ({ ...presentLibrarySong(song), locked: locked(song) })),
    continue: latest
      ? {
          song: presentLibrarySong(latest),
          position: latest.practice[0].session?.position ?? null,
          lastOpenedAt: latest.practice[0].lastOpenedAt,
        }
      : null,
  });
});

module.exports = router;
