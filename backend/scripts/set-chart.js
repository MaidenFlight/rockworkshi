// Saves a chord chart from backend/charts to its song.
// Usage: npm run songs:chart -- charts/have-you-ever-seen-the-rain.json
// The song is found by the title and artist in the file.
// Writes to whichever database DATABASE_URL points at.
require("dotenv").config({ quiet: true });
const fs = require("fs");
const prisma = require("../src/lib/prisma");
const { validateChart } = require("../src/lib/chordChart");

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Give the chart file, e.g. charts/have-you-ever-seen-the-rain.json");
  const input = JSON.parse(fs.readFileSync(file, "utf8"));
  const { error, chart } = validateChart(input);
  if (error) throw new Error(error);

  const matches = await prisma.song.findMany({
    where: { title: { equals: input.title, mode: "insensitive" }, artist: { equals: input.artist, mode: "insensitive" } },
    select: { id: true, _count: { select: { tracks: true } } },
  });
  // Duplicates without stems are seed leftovers; prefer the one with stems.
  const withStems = matches.filter((s) => s._count.tracks > 0);
  const candidates = withStems.length ? withStems : matches;
  if (candidates.length !== 1) throw new Error(`Expected one song called "${input.title}", found ${candidates.length}.`);

  await prisma.song.update({ where: { id: candidates[0].id }, data: { chart } });
  const bars = chart.sections.reduce((n, s) => n + s.bars.length, 0);
  console.log(`Saved ${chart.sections.length} sections and ${bars} bars to "${input.title}".`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
