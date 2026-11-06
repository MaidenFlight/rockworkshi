// Makes the mixes students play along with (lib/songMixes.js): for each stem, a backing band of every
// other stem, and the whole song as one track. Students are sent their own stem and one of these,
// never another instrument's stem by itself, so a song with stems but no mixes plays for staff only.
// Usage: npm run songs:backing                     songs whose mixes are missing or out of date
//        npm run songs:backing -- --all           every song with stems
//        npm run songs:backing -- --song <id>     one song (with --from, read its stems from a local
//                                                 folder named like songs:upload's, not from storage)
//        npm run songs:backing -- --dry-run       say what would be made
// Needs ffmpeg. Stores the mixes in MEDIA_DIR when that's set (development), otherwise in R2, and
// records them in whichever database DATABASE_URL points at.
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { parseArgs } = require("util");
const prisma = require("../src/lib/prisma");
const { isMediaConfigured, mediaDir, mediaSource } = require("../src/lib/media");
const { partFromFileName } = require("../src/lib/songTracks");
const { isUpToDate, renderMixes, saveMixes } = require("../src/lib/songMixes");

const { values } = parseArgs({
  options: {
    all: { type: "boolean", default: false },
    song: { type: "string" },
    from: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

// Each stem of the song from a local folder, by file name.
function stemsFromFolder(song, folder) {
  const files = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".mp3"));
  return song.tracks.map((t) => {
    const file = files.find((f) => partFromFileName(f) === t.part);
    if (!file) throw new Error(`No ${t.part} stem in ${folder}.`);
    return { part: t.part, input: path.join(folder, file) };
  });
}

async function main() {
  if (values.from && !values.song) throw new Error("--from needs --song, so the stems go with the right song.");
  if (!isMediaConfigured()) throw new Error("Nowhere to store the mixes: set MEDIA_DIR (development) or the R2 settings in .env.");
  console.log(`Storing mixes in ${mediaDir() ? `MEDIA_DIR (${mediaDir()})` : `R2 bucket ${process.env.R2_BUCKET}`}.`);

  const songs = await prisma.song.findMany({
    where: { tracks: { some: {} }, ...(values.song ? { id: values.song } : {}) },
    include: { tracks: true, mixes: true },
    orderBy: { title: "asc" },
  });
  if (values.song && !songs.length) throw new Error(`No song ${values.song} with stems.`);

  for (const song of songs) {
    if (!values.all && !values.song && isUpToDate(song)) {
      console.log(`${song.title}: up to date`);
      continue;
    }
    const parts = song.tracks.map((t) => t.part).join(", ");
    if (values["dry-run"]) {
      console.log(`${song.title}: would mix the band without each of ${parts}, and the whole song`);
      continue;
    }
    process.stdout.write(`${song.title}: mixing without each of ${parts}, and the whole song… `);
    const stems = values.from ? stemsFromFolder(song, values.from) : await Promise.all(song.tracks.map(async (t) => ({ part: t.part, input: await mediaSource(t.storageKey) })));
    const rendered = await renderMixes(stems);
    await saveMixes(song, rendered);
    console.log(`done (${rendered.map((r) => `${r.without || "whole"} ×${r.gain}`).join(", ")})`);
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
