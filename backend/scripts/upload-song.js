// Uploads a folder of stems to R2 and records them as SongTrack rows.
// Usage: npm run songs:upload -- <folder> --title "Song" --artist "Artist" [--level Beginner] [--dry-run]
//
// Stems are matched to parts by file name ("(Bass Only)", "Isolated Guitars", ...).
// Files that aren't a single stem, like the full mix, are skipped. Then makes the mixes students
// play along with (see songs:backing). Needs ffmpeg.
// Writes to whichever database DATABASE_URL points at, and to MEDIA_DIR instead of R2 when that's set.
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { parseArgs } = require("util");
const prisma = require("../src/lib/prisma");
const { isMediaConfigured, putMedia } = require("../src/lib/media");
const { partFromFileName, storageKeyFor, PARTS } = require("../src/lib/songTracks");
const { measureMixLevel } = require("../src/lib/mixLevel");
const { renderMixes, saveMixes } = require("../src/lib/songMixes");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" },
    artist: { type: "string" },
    level: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const folder = positionals[0];

function stemsIn(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".mp3"));
  const stems = [];
  const skipped = [];
  for (const file of files) {
    const part = partFromFileName(file);
    if (!part) {
      skipped.push(file);
      continue;
    }
    if (stems.some((s) => s.part === part)) {
      throw new Error(`Two files look like the ${part} stem. Rename one so it's clear which to use.`);
    }
    stems.push({ part, file, fullPath: path.join(dir, file) });
  }
  stems.sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part));
  return { stems, skipped };
}

async function main() {
  if (!folder || !values.title) {
    console.log('Usage: npm run songs:upload -- <folder> --title "Song" --artist "Artist" [--level Beginner] [--dry-run]');
    process.exit(1);
  }

  const { stems, skipped } = stemsIn(folder);
  if (!stems.length) throw new Error("No stems found. Expected names like \"(Bass Only).mp3\".");

  console.log(`${values.title}${values.artist ? ` — ${values.artist}` : ""}`);
  for (const s of stems) console.log(`  ${s.part.padEnd(7)} ${s.file}`);
  for (const f of skipped) console.log(`  skip    ${f}`);
  console.log("");

  if (values["dry-run"]) {
    console.log("Dry run: nothing uploaded.");
    return;
  }
  // Check before touching the database so a missing key doesn't leave a half-made song.
  if (!isMediaConfigured()) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env.");
  }

  let song = await prisma.song.findFirst({
    where: { title: values.title, artist: values.artist || null },
  });
  if (!song) {
    song = await prisma.song.create({
      data: { title: values.title, artist: values.artist || null, level: values.level || null },
    });
    console.log(`Created song ${song.id}`);
  } else {
    console.log(`Adding tracks to existing song ${song.id}`);
  }

  for (const s of stems) {
    const storageKey = storageKeyFor(song.id, s.part);
    process.stdout.write(`  uploading ${s.part}… `);
    await putMedia(storageKey, fs.readFileSync(s.fullPath), "audio/mpeg");
    await prisma.songTrack.upsert({
      where: { songId_part: { songId: song.id, part: s.part } },
      update: { storageKey },
      create: { songId: song.id, part: s.part, storageKey },
    });
    console.log("done");
  }

  process.stdout.write("  measuring the mix level… ");
  const mixLevel = await measureMixLevel(stems.map((s) => s.fullPath));
  await prisma.song.update({ where: { id: song.id }, data: { mixLevel } });
  console.log(mixLevel);

  // Students only ever get their own stem and one of these mixes, so without them the song plays
  // for staff alone. Every stem of the song, including ones uploaded before, goes into them.
  process.stdout.write("  mixing the backing bands… ");
  const withTracks = await prisma.song.findUnique({ where: { id: song.id }, include: { tracks: true } });
  const missing = withTracks.tracks.filter((t) => !stems.some((s) => s.part === t.part)).map((t) => t.part);
  if (missing.length) {
    console.log(`skipped: ${missing.join(", ")} came from an earlier upload. Run npm run songs:backing -- --song ${song.id}`);
  } else {
    await saveMixes(withTracks, await renderMixes(stems.map((s) => ({ part: s.part, input: s.fullPath }))));
    console.log("done");
  }

  console.log(`\nUploaded ${stems.length} tracks. Test with GET /songs/${song.id}/tracks`);
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
