// Measures Song.mixLevel from the stems already in R2, for songs uploaded before it existed.
// Usage: npm run songs:measure            every song with tracks and no level yet
//        npm run songs:measure -- --all   re-measure every song with tracks
// Needs ffmpeg. Writes to whichever database DATABASE_URL points at.
require("dotenv").config({ quiet: true });
const { parseArgs } = require("util");
const prisma = require("../src/lib/prisma");
const { isR2Configured, signedUrl } = require("../src/lib/r2");
const { measureMixLevel } = require("../src/lib/mixLevel");

const { values } = parseArgs({ options: { all: { type: "boolean", default: false } } });

async function main() {
  if (!isR2Configured()) throw new Error("R2 is not configured in .env.");
  const songs = await prisma.song.findMany({
    where: { tracks: { some: {} }, ...(values.all ? {} : { mixLevel: null }) },
    include: { tracks: true },
  });
  if (!songs.length) console.log("Nothing to measure.");

  for (const song of songs) {
    process.stdout.write(`${song.title}: `);
    const urls = await Promise.all(song.tracks.map((t) => signedUrl(t.storageKey, 10 * 60)));
    const mixLevel = await measureMixLevel(urls);
    await prisma.song.update({ where: { id: song.id }, data: { mixLevel } });
    console.log(mixLevel);
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
