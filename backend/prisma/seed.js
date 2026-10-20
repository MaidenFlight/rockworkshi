require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Placeholder video for local dev (provider "direct").
const PLACEHOLDER_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const { INSTRUMENTS } = require("../src/lib/lessonVideos");

const LEVELS = [
  { n: 1, name: "Sing-a-long", blurb: "Learn the melody and lyrics by ear, no instrument required yet." },
  { n: 2, name: "Chords", blurb: "Play the song's core chord progression in a simple strum or comp pattern." },
  { n: 3, name: "Scales & fills", blurb: "Add the scale the song lives in, plus a few signature fills." },
  { n: 4, name: "Melody", blurb: "Play the actual vocal or lead melody on your instrument." },
  { n: 5, name: "Improv", blurb: "Solo over the changes using everything from the earlier levels." },
];

async function main() {
  // Lesson has no unique key, so skip if already seeded.
  const existingLessons = await prisma.lesson.count();
  if (existingLessons > 0) {
    console.log(`Lessons already present (${existingLessons}) — leaving them alone.`);
  } else {
    await prisma.lesson.createMany({
      data: [
        {
          order: 1,
          title: "Riptide",
          artist: "Vance Joy",
          key: "Am",
          difficulty: "Beginner",
          estTime: "25 min",
          levels: LEVELS,
          published: true,
        },
        {
          order: 2,
          title: "Three Little Birds",
          artist: "Bob Marley",
          key: "A",
          difficulty: "Beginner",
          estTime: "22 min",
          levels: LEVELS,
          published: true,
        },
        {
          order: 3,
          title: "Wonderwall",
          artist: "Oasis",
          key: "F#m",
          difficulty: "Intermediate",
          estTime: "30 min",
          levels: LEVELS,
          published: true,
        },
      ],
    });
  }

  // Wonderwall has no Drums/Voice video on purpose, to test the empty state.
  const lessons = await prisma.lesson.findMany({ select: { id: true, title: true } });
  const videos = [];
  for (const lesson of lessons) {
    for (const instrument of INSTRUMENTS) {
      if (lesson.title === "Wonderwall" && (instrument === "Drums" || instrument === "Voice")) continue;
      for (const kind of ["lesson", "playthrough"]) {
        videos.push({
          lessonId: lesson.id,
          instrument,
          level: 1,
          kind,
          provider: "direct",
          videoId: PLACEHOLDER_VIDEO,
        });
      }
    }
  }
  await prisma.lessonVideo.createMany({ data: videos, skipDuplicates: true });

  // Teachers are not seeded; add real ones through the admin.

  await prisma.faq.createMany({
    data: [
      { question: "What ages do you teach?", answer: "We teach students from age 5 through adult, with curriculum tailored to each age group.", order: 0 },
      { question: "Do I need my own instrument?", answer: "Not for your trial lesson — we have loaners. For ongoing lessons, we'll help you pick the right instrument.", order: 1 },
      { question: "Can siblings or friends learn together?", answer: "Yes — group and band lessons are a core part of our program, not an add-on.", order: 2 },
    ],
    skipDuplicates: true,
  });

  await prisma.song.createMany({
    data: [
      { title: "Riptide", artist: "Vance Joy", level: "Beginner", instrument: "Guitar", order: 0 },
      { title: "Three Little Birds", artist: "Bob Marley", level: "Beginner", instrument: "Ukulele", order: 1 },
      { title: "Wonderwall", artist: "Oasis", level: "Intermediate", instrument: "Guitar", order: 2 },
    ],
    skipDuplicates: true,
  });

  await prisma.onStagePost.createMany({
    data: [
      { title: "Spring Recital 2026", description: "Students from every level took the stage at the Spring Recital.", date: "2026-04-18", order: 0 },
      { title: "Rock Band Showcase", description: "Our Rock Band program closed out the year with an all-original set.", date: "2026-06-02", order: 1 },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
