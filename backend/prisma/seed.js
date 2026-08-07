require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Mozilla's sample clip, used as a stand-in so the player has something to play
// in development. It goes in as provider "direct", so nothing tries to sign it.
const PLACEHOLDER_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

// Must match frontend/lib/content.js — the same strings are stored on
// User.instrument at signup and matched against LessonVideo.instrument.
const INSTRUMENTS = ["Guitar", "Piano", "Bass", "Drums", "Voice", "Ukulele"];

const LEVELS = [
  { n: 1, name: "Sing-a-long", blurb: "Learn the melody and lyrics by ear, no instrument required yet." },
  { n: 2, name: "Chords", blurb: "Play the song's core chord progression in a simple strum or comp pattern." },
  { n: 3, name: "Scales & fills", blurb: "Add the scale the song lives in, plus a few signature fills." },
  { n: 4, name: "Melody", blurb: "Play the actual vocal or lead melody on your instrument." },
  { n: 5, name: "Improv", blurb: "Solo over the changes using everything from the earlier levels." },
];

async function main() {
  // Lesson has no natural unique key, so skipDuplicates can't protect it — a
  // second run would just add three more copies. The videos below are keyed off
  // whatever lessons exist, so that has to not happen.
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

  // A lesson video per instrument, so the instrument filter has something to
  // filter. Wonderwall deliberately has no Drums or Voice video: in real life
  // most (song × instrument) slots stay empty for months while the library is
  // recorded, and the "not recorded yet" path needs to be the normal case in
  // development rather than something only production ever hits.
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

  await prisma.teacher.createMany({
    data: [
      { name: "Kalani Akana", bio: "Guitar and ukulele instructor, 15 years teaching keiki and adults alike.", instruments: "Guitar, Ukulele", order: 0 },
      { name: "Maya Reyes", bio: "Vocal coach and pianist with a background in musical theatre.", instruments: "Voice, Piano", order: 1 },
      { name: "Ben Torres", bio: "Drummer and bassist, leads our Rock Band program.", instruments: "Drums, Bass", order: 2 },
    ],
    skipDuplicates: true,
  });

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
