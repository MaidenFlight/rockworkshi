// Local fixtures for the song page's video tutorials, so each state can be checked in a browser
// without making any real videos:
//   "[Fixture] One tutorial published"   Guitar: a level 1 lesson, plus a level 2 draft that must stay hidden
//   "[Fixture] Tutorials unpublished"    Guitar: three drafts, so Guitar students see Coming soon
//   "[Fixture] Tutorial can't play"      Guitar: a Bunny id that can't be signed yet, and a link that 404s
// Every fixture song also has Bass videos, which a Guitar student must never receive.
// Two students can sign in to them, tutorials-guitar@example.test and tutorials-bass@example.test,
// with a password made up on each run and printed once.
// The playable clip is the CC0 sample prisma/seed.js already uses; nothing is uploaded anywhere.
// The songs borrow the stems and chart of a real song, so the practice player is there too.
// Videos only appear while the API runs with LESSON_VIDEOS_READY=true.
//
// Usage: npm run fixtures:tutorials               (creates them, replacing any from an earlier run)
//        npm run fixtures:tutorials -- --remove
// Refuses any database that isn't on this machine.
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../src/lib/prisma");

const PREFIX = "[Fixture] ";
const STUDENTS = [
  { email: "tutorials-guitar@example.test", name: "Fixture Guitar Student", instrument: "Guitar" },
  { email: "tutorials-bass@example.test", name: "Fixture Bass Student", instrument: "Bass" },
];
const CLIP = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const MISSING = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/rock-works-fixture-missing.mp4";

// The query string makes each instrument's link distinct, so a leak shows up in a response.
const clip = (instrument, level, kind) => `${CLIP}?fixture=${instrument.toLowerCase()}-${level}-${kind}`;
const video = (instrument, level, kind, extra = {}) => ({
  instrument,
  level,
  kind,
  provider: "direct",
  videoId: clip(instrument, level, kind),
  ...extra,
});
const bass = [video("Bass", 1, "lesson"), video("Bass", 1, "playthrough"), video("Bass", 4, "lesson")];

const SONGS = [
  {
    title: "One tutorial published",
    videos: [video("Guitar", 1, "lesson"), video("Guitar", 2, "lesson", { published: false }), ...bass],
  },
  {
    title: "Tutorials unpublished",
    videos: [
      video("Guitar", 1, "lesson", { published: false }),
      video("Guitar", 1, "playthrough", { published: false }),
      video("Guitar", 3, "lesson", { published: false }),
      ...bass,
    ],
  },
  {
    title: "Tutorial can't play",
    videos: [
      video("Guitar", 1, "lesson", { provider: "bunny", videoId: "fixture-unsigned-bunny-guid" }),
      video("Guitar", 2, "playthrough", { videoId: MISSING }),
      ...bass,
    ],
  },
];

function assertLocalDatabase() {
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    // An unreadable URL is refused below like any other.
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to write fixtures to "${host || "an unknown host"}": they're for a local database only.`);
  }
}

async function removeFixtures() {
  const users = await prisma.user.findMany({ where: { email: { in: STUDENTS.map((s) => s.email) } }, select: { id: true } });
  // Session has no foreign key to User, so a deleted student's sessions are cleared by hand.
  for (const { id } of users) await prisma.session.deleteMany({ where: { data: { contains: id } } });
  const { count: userCount } = await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  // Deleting a song deletes its rows here (videos, stem rows); the stems in R2 are left alone.
  const { count: songCount } = await prisma.song.deleteMany({ where: { title: { startsWith: PREFIX } } });
  return { userCount, songCount };
}

async function main() {
  assertLocalDatabase();
  const removed = await removeFixtures();
  if (process.argv.includes("--remove")) {
    console.log(`Removed ${removed.songCount} fixture songs and ${removed.userCount} fixture students.`);
    return;
  }

  // The real song with the most stems lends them, with its chart, so the player loads.
  const lender = (await prisma.song.findMany({ include: { tracks: true } })).sort((a, b) => b.tracks.length - a.tracks.length)[0];
  const borrowed = lender?.tracks.length
    ? {
        mixLevel: lender.mixLevel,
        chart: lender.chart ?? undefined,
        tracks: { create: lender.tracks.map((t) => ({ part: t.part, storageKey: t.storageKey })) },
      }
    : {};

  const songs = [];
  for (const [i, s] of SONGS.entries()) {
    songs.push(
      await prisma.song.create({
        data: {
          title: PREFIX + s.title,
          artist: "Development fixture",
          level: "Beginner",
          order: 900 + i,
          ...borrowed,
          videos: { create: s.videos },
        },
      })
    );
  }

  const password = process.env.FIXTURE_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const students = [];
  for (const s of STUDENTS) {
    students.push(
      await prisma.user.create({
        data: { ...s, passwordHash, emailVerifiedAt: new Date(), paidAt: new Date(), plan: "Monthly" },
      })
    );
  }

  // If the lending song is in a term, let the fixture students open it too, to see a real song's
  // Coming soon. Deleting a fixture student deletes this grant with them.
  const managed = lender && (await prisma.termSlot.count({ where: { songId: lender.id } }));
  if (managed) {
    await prisma.termGrant.createMany({ data: students.map((u) => ({ userId: u.id, songId: lender.id })), skipDuplicates: true });
  }

  const site = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log("Fixture songs:");
  for (const song of songs) console.log(`  ${song.title}  ${site}/member/song/${song.id}`);
  if (lender?.tracks.length) console.log(`  (stems and chart borrowed from "${lender.title}"${managed ? ", which the students can open too" : ""})`);
  console.log("Fixture students (local only):");
  for (const s of STUDENTS) console.log(`  ${s.email}  ${s.instrument}`);
  if (!process.env.FIXTURE_PASSWORD) console.log(`  Password for both: ${password}`);
  if (process.env.LESSON_VIDEOS_READY !== "true") {
    console.log("Videos show only while the API runs with LESSON_VIDEOS_READY=true; without it every song says Coming soon.");
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
