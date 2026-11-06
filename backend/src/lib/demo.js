// The student demo. The Demo tab (/demo) lets someone the school invites (a potential employer, say)
// look around the member area as a student sees it, without signing up: they enter the passcode an
// admin set in Admin → Student demo, pick an instrument, and are signed into a sample student of that
// instrument. Until a passcode is set, the demo is closed.
//
// Each visitor gets a household of their own: Kai, a student about three months in on the instrument
// they picked, and Noa, the teacher who sets Kai's work. Both are ordinary User rows marked with
// demoExpiresAt, so every student feature runs on them unchanged: their own part of the song with the
// band, the chart and chord library for their instrument, the tools. What keeps the demo apart from the
// school:
//   - no one signs into a demo account with a password (config/passport.js), and it has none to
//     change or reset;
//   - staff never see one: admin lists, counts and exports leave them out (REAL), no real teacher is
//     linked to one, and nothing a demo account does is written to the audit log;
//   - nothing leaves the sandbox. No payments, no email (lib/mailer.js won't send to DEMO_DOMAIN), no
//     trial bookings or messages to the school, no recordings uploaded: those routes answer 403 with
//     reason "demo" and say why (refuseDemo in lib/demoRules.js). Work sent for review reaches only
//     Noa, who is made up;
//   - it's thrown away. Leaving deletes the household, switching instrument swaps it for a new one, and
//     a sweep deletes any that expired, so every visitor starts from the same place.
// Shared content (songs, lessons, the chord library) is only read. The demo never adds a term slot:
// a slot locks its song for every real student outside that term (lib/termAccess.js).
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("./prisma");
const clock = require("./clock");
const { DEMO_DOMAIN, isDemo } = require("./demoRules");
const { localParts, addDays, weekdayOf } = require("./zoned");
const { regenerate } = require("./classes");
const { validateSession } = require("./practice");
const { validateMixer, partForInstrument, canonicalInstrument, BACKING } = require("./instrumentAccess");

const DEMO_MS = 2 * 60 * 60 * 1000;
// Households at once. Past this the oldest are cleared first, so a script can't fill the database.
const MAX_LIVE = 200;
// Not a bcrypt hash, so no password ever matches it. Sign-in refuses demo accounts before comparing anyway.
const NO_PASSWORD = "!student-demo";
const ZONE = "Pacific/Honolulu";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------------------------
// The passcode

const PASSCODE_LENGTH = { min: 8, max: 64 };
const ACCESS = { id: 1 };
// Capitals and spaces don't matter, so "Aloha Friday" opens a demo whose passcode is alohafriday.
const normalise = (passcode) => passcode.toLowerCase().replace(/\s+/g, "");

// The song a demo practises, for the Demo page to name. The first with stems, as in findContent.
async function demoSong() {
  return prisma.song.findFirst({ where: { published: true, tracks: { some: {} } }, orderBy: { order: "asc" }, select: { title: true, artist: true } });
}

// Whether the demo is open, when its passcode last changed, how many demos are running now, and the song.
async function demoStatus() {
  const [access, live, song] = await Promise.all([
    prisma.demoAccess.findUnique({ where: ACCESS, select: { updatedAt: true } }),
    prisma.user.count({ where: { demoExpiresAt: { gt: clock.now() }, role: "student" } }),
    demoSong(),
  ]);
  return { open: Boolean(access), updatedAt: access?.updatedAt ?? null, live, song };
}

// "open" when the passcode is right, "wrong" when it isn't, "closed" when none is set.
async function checkDemoPasscode(passcode) {
  const access = await prisma.demoAccess.findUnique({ where: ACCESS });
  if (!access) return "closed";
  if (typeof passcode !== "string" || !normalise(passcode)) return "wrong";
  return (await bcrypt.compare(normalise(passcode), access.passcodeHash)) ? "open" : "wrong";
}

// Sets a new passcode, which opens the demo. Demos already open carry on until they end.
// Returns { error } for a passcode that won't do.
async function setDemoPasscode(passcode, admin) {
  const { min, max } = PASSCODE_LENGTH;
  const code = typeof passcode === "string" ? normalise(passcode) : "";
  if (code.length < min || code.length > max) return { error: `The passcode must be ${min} to ${max} letters or numbers.` };
  const passcodeHash = await bcrypt.hash(code, 12);
  const data = { passcodeHash, setBy: admin?.id ?? null };
  await prisma.demoAccess.upsert({ where: ACCESS, create: { ...ACCESS, ...data }, update: data });
  return { ok: true };
}

// Closes the demo: the passcode stops working, and every demo running now ends. Returns how many ended.
async function closeDemo() {
  await prisma.demoAccess.deleteMany({ where: ACCESS });
  const running = await prisma.user.count({ where: { demoExpiresAt: { not: null }, role: "student" } });
  await deleteDemoAccounts({});
  return running;
}

// ---------------------------------------------------------------------------------------------
// What's in a new demo

const round = (n) => Math.round(n * 1000) / 1000;
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] || "");
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
// [with the lesson's chords named, without]. A plain string reads the same either way.
const pick = (text, named) => (Array.isArray(text) ? text[named ? 0 : 1] : text);

// The chords taught in the seeded lessons (prisma/seed.js). Any other lesson gets general wording.
const LESSON_CHORDS = {
  Riptide: ["Am", "G", "C"],
  "Three Little Birds": ["A", "D", "E"],
  Wonderwall: ["Em7", "G", "Dsus4", "A7sus4"],
};

// What a student of each instrument works on, in their teacher's words. The song's chart fills in
// {change} (the chorus's first chord change) and {verseTo} (the verse's first new chord); a lesson's
// chords fill in {chords}, {firstTwo} and {third}.
const STUDENTS = {
  Guitar: {
    lesson: "Guitar lesson",
    workshop: ["Barre chords workshop", "Ninety minutes on the F and B♭ barre shapes, for guitarists in their first year. The studio has loaner guitars."],
    goals: "Play rhythm guitar in a band by the summer showcase, and learn to take a short solo over a blues.",
    now: "Loop the chorus at 75% speed until {change} feels easy, then try it at full speed. Keep your strumming hand moving through every change, even if a chord buzzes.",
    verse: "Strum the verse along with the band at 90% speed. Down strums on every beat to start, and look ahead to each change so you're there on time.",
    verseFeedback:
      "Much steadier! You're landing {verseTo} on time now, and your strumming hand keeps going through the change, which is exactly right. Try the verse at full speed this week, then we'll start on the chorus.",
    firstLesson: [
      "Learn the {chords} shapes from the lesson video, then play along with it. Clean changes first, speed later.",
      "Learn the chord shapes from the lesson video, then play along with it. Clean changes first, speed later.",
    ],
    firstFeedback: [
      "Your {firstTwo} shapes ring out clearly now. The change into {third} still costs you half a beat, so practise just that move, slowly, ten times before each session. Next up is the strumming pattern.",
      "Your chord shapes ring out clearly now. The changes still cost you half a beat, so practise them slowly, ten times before each session. Next up is the strumming pattern.",
    ],
    secondLesson: [
      "Work through the {chords} changes from the lesson. Mark it ready when you can play the progression twice through without stopping.",
      "Work through the chord changes from the lesson. Mark it ready when you can play the progression twice through without stopping.",
    ],
    notes: "Chorus: watch {change}. Lift early and let the last strum ring.\nVerse is fine at full speed now.",
  },
  Piano: {
    lesson: "Piano lesson",
    workshop: ["Chord charts workshop", "Ninety minutes on turning a chord chart into a part: roots in the left hand, shapes in the right, and inversions that keep your hand still."],
    goals: "Play keys in a band by the summer showcase, and learn to comp from a chord chart.",
    now: "Loop the chorus at 75% speed with the chords in your right hand and the roots in your left. Get {change} smooth without looking down, then try it at full speed.",
    verse: "Play the verse along with the band at 90% speed: a chord on every beat in your right hand, the root in your left. Keep your hand relaxed so each change is a small move.",
    verseFeedback:
      "Lovely and even. You're finding {verseTo} without a gap now, and your left hand is right on the beat. Try the verse at full speed this week, then we'll start on the chorus.",
    firstLesson: [
      "Learn the {chords} chords from the lesson video, then play along with it. Right hand first, then add the left.",
      "Learn the chords from the lesson video, then play along with it. Right hand first, then add the left.",
    ],
    firstFeedback: [
      "Your {firstTwo} chords sound full now. The move to {third} is still a little late, so practise it slowly without looking at your hands. Next up is a simple rhythm in the right hand.",
      "Your chords sound full now. The changes are still a little late, so practise them slowly without looking at your hands. Next up is a simple rhythm in the right hand.",
    ],
    secondLesson: [
      "Play the {chords} changes from the lesson with both hands. Mark it ready when you can play the progression twice through without stopping.",
      "Play the chord changes from the lesson with both hands. Mark it ready when you can play the progression twice through without stopping.",
    ],
    notes: "Chorus: watch {change}. Move the left hand first.\nVerse is fine at full speed now.",
  },
  Bass: {
    lesson: "Bass lesson",
    workshop: ["Locking in with the drums", "Ninety minutes on placing your notes with the kick drum, played along to songs at the studio."],
    goals: "Hold down the low end in a band by the summer showcase, and learn to read bass tab fluently.",
    now: "Loop the chorus at 75% speed and play the root of each chord with the kick drum. Once it's steady, follow the tab for the notes that lead into each change.",
    verse: "Play the verse along with the band at 90% speed: roots only, on every beat, with the kick drum. Count the bars so you change chords with the band.",
    verseFeedback:
      "Great time feel! Your roots sit right on the kick drum now, and you're changing with the band every time. Try the verse at full speed this week, then we'll add the passing notes from the tab.",
    firstLesson: "Learn the bass line from the lesson video: roots first, then the passing notes.",
    firstFeedback:
      "Your roots are solid and in time. The passing notes still rush a little, so play them slowly with the metronome before speeding up. Next up is muting the strings you aren't playing.",
    secondLesson: "Play the bass line from the lesson along with the video. Mark it ready when you can play it twice through without stopping.",
    notes: "Chorus: lock the roots to the kick drum.\nVerse is fine at full speed now.",
  },
  Drums: {
    lesson: "Drum lesson",
    workshop: ["Fills and transitions workshop", "Ninety minutes on one-bar fills that lead a band into the next section, practised along to songs."],
    goals: "Play a full set with a band by the summer showcase, and keep steady time through every fill.",
    now: "Loop the chorus at 75% speed with the band. Keep the hi-hat in steady eighth notes and the snare on 2 and 4, then add a crash on the first beat of each line.",
    verse: "Play the verse along with the band at 90% speed: hi-hat in eighth notes, snare on 2 and 4, kick on 1 and 3. Keep it simple and steady.",
    verseFeedback:
      "Rock solid! Your backbeat sits right in the pocket now and the hi-hat stays even. Try the verse at full speed this week, then we'll add the fill into the chorus.",
    firstLesson: "Learn the beat from the lesson video and play along with it. Steady first, fills later.",
    firstFeedback:
      "Your beat is steady and the snare lands right on 2 and 4. The fills still rush, so play them with the metronome at half speed first. Next up is the ride cymbal pattern.",
    secondLesson: "Play the beat from the lesson along with the video, fills included. Mark it ready when you can play it twice through without stopping.",
    notes: "Chorus: don't rush the fill into it.\nVerse is fine at full speed now.",
  },
  Voice: {
    lesson: "Voice lesson",
    workshop: ["Harmony singing workshop", "Ninety minutes on finding a harmony line and holding it against the melody, in small groups."],
    goals: "Sing lead in a band by the summer showcase, and learn to hold a harmony.",
    now: "Loop the chorus at 75% speed and sing along with the band. Take a breath before each line, and land on the first note of each line instead of sliding up to it.",
    verse: "Sing the verse along with the band at 90% speed, following the melody in the chart. Keep the long notes steady right to the end.",
    verseFeedback:
      "Beautiful tone! Your long notes are steady now and you're in tune at the start of each line. Try the verse at full speed this week, then we'll work on the chorus.",
    firstLesson: "Learn the melody from the lesson video and sing along with it. Breathe where the lesson does.",
    firstFeedback:
      "Your pitch is lovely and secure. A few phrases run out of breath at the end, so mark your breaths in the chart and practise them. Next up is singing it without the guide.",
    secondLesson: "Sing the melody from the lesson along with the video. Mark it ready when you can sing it twice through without stopping.",
    notes: "Chorus: breathe before each line.\nVerse is fine at full speed now.",
  },
  Ukulele: {
    lesson: "Ukulele lesson",
    workshop: ["Strumming patterns workshop", "Ninety minutes on the island strum and three other patterns that fit most songs. The studio has loaner ukuleles."],
    goals: "Play and sing a whole set of songs on ukulele by the summer showcase.",
    now: "Loop the chorus at 75% speed with a down-down-up strum until {change} feels easy, then try it at full speed. Keep your strumming hand moving through every change.",
    verse: "Strum the verse along with the band at 90% speed, one down strum on every beat. Look ahead to each change so you're there on time.",
    verseFeedback:
      "Much steadier! You're landing {verseTo} on time now, and your strum keeps going through the change. Try the verse at full speed this week, then we'll start on the chorus.",
    firstLesson: [
      "Learn the {chords} shapes from the lesson video, then play along with it. Clean changes first, speed later.",
      "Learn the chord shapes from the lesson video, then play along with it. Clean changes first, speed later.",
    ],
    firstFeedback: [
      "Your {firstTwo} shapes ring out clearly now. The change into {third} still costs you half a beat, so practise just that move slowly before each session. Next up is the island strum.",
      "Your chord shapes ring out clearly now. The changes still cost you half a beat, so practise them slowly before each session. Next up is the island strum.",
    ],
    secondLesson: [
      "Work through the {chords} changes from the lesson. Mark it ready when you can play the progression twice through without stopping.",
      "Work through the chord changes from the lesson. Mark it ready when you can play the progression twice through without stopping.",
    ],
    notes: "Chorus: watch {change}. Keep strumming through it.\nVerse is fine at full speed now.",
  },
};

// The song the demo practises: one with this instrument's own stem if there is one, else any with stems.
async function findContent(instrument) {
  const [songs, lessons] = await Promise.all([
    prisma.song.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      select: { id: true, title: true, chart: true, tracks: { select: { part: true } } },
    }),
    prisma.lesson.findMany({ where: { published: true }, orderBy: { order: "asc" }, select: { id: true, title: true } }),
  ]);
  const own = partForInstrument(instrument);
  const song = songs.find((s) => s.tracks.some((t) => t.part === own)) || songs.find((s) => s.tracks.length) || null;
  return { song, lessons };
}

// Where a section of the song starts and ends, and its first chord change, read from the chart.
function sectionOf(chart, prefix) {
  const sections = chart?.sections ?? [];
  const i = sections.findIndex((s) => s.name?.startsWith(prefix) && s.bars?.length);
  if (i < 0) return null;
  const start = sections[i].bars[0].time;
  const end = sections[i + 1]?.bars?.[0]?.time ?? chart.end;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const chords = sections[i].bars.flatMap((b) => (b.chords || []).map((c) => c.name)).filter(Boolean);
  const k = chords.findIndex((c, n) => n > 0 && c !== chords[n - 1]);
  return { start: round(start), end: round(end), from: k > 0 ? chords[k - 1] : null, to: k > 0 ? chords[k] : null };
}

// What the chart says about the song, for the teacher's words: { chorus, verse, values }.
function songWords(song) {
  const chorus = sectionOf(song?.chart, "Chorus");
  const verse = sectionOf(song?.chart, "Verse");
  return {
    chorus,
    verse,
    values: {
      change: chorus?.from && chorus?.to ? `the ${chorus.from} to ${chorus.to} change` : "each change",
      verseTo: verse?.to ? `the ${verse.to}` : "each new chord",
    },
  };
}

function lessonWords(lesson) {
  const chords = LESSON_CHORDS[lesson.title];
  return { named: Boolean(chords), values: chords ? { chords: list(chords), firstTwo: list(chords.slice(0, 2)), third: chords[2] ?? chords[0] } : {} };
}

// Practice work from the teacher, oldest first: two pieces with feedback, one waiting for it, and one
// to practise now. Built from whichever song and lessons this school has.
function teacherWork({ song, lessons }, ago, student) {
  const work = [];
  const [first, second] = lessons;
  const { chorus, verse, values } = songWords(song);

  if (first) {
    const { named, values: chords } = lessonWords(first);
    work.push({
      lessonId: first.id,
      instruction: fill(pick(student.firstLesson, named), chords),
      status: "reviewed",
      createdAt: ago(24),
      sent: ago(19, 5),
      feedback: fill(pick(student.firstFeedback, named), chords),
      reviewedAt: ago(18),
    });
  }
  if (song) {
    work.push({
      songId: song.id,
      section: verse ? "Verse" : null,
      sectionStart: verse?.start ?? null,
      sectionEnd: verse?.end ?? null,
      instruction: fill(student.verse, values),
      status: "reviewed",
      createdAt: ago(12),
      sent: ago(6, 3),
      feedback: fill(student.verseFeedback, values),
      reviewedAt: ago(5),
    });
  }
  if (second) {
    const { named, values: chords } = lessonWords(second);
    work.push({ lessonId: second.id, instruction: fill(pick(student.secondLesson, named), chords), status: "ready", createdAt: ago(8), sent: ago(1, 2) });
  }
  if (song) {
    work.push({
      songId: song.id,
      section: chorus ? "Chorus" : null,
      sectionStart: chorus?.start ?? null,
      sectionEnd: chorus?.end ?? null,
      instruction: fill(student.now, values),
      status: "assigned",
      createdAt: ago(2),
    });
  }
  return work;
}

// A fresh household for one visitor, playing `instrument`, signed-in-ready: the student, with roles loaded.
async function startDemo({ instrument: asked = "Guitar", now = clock.now() } = {}) {
  const instrument = canonicalInstrument(asked) || "Guitar";
  const student = STUDENTS[instrument];
  await sweepDemos(now);
  const content = await findContent(instrument);
  const { song } = content;
  const tag = crypto.randomBytes(6).toString("hex");
  const ago = (days, hours = 0) => new Date(now.getTime() - days * DAY - hours * HOUR);
  const demo = { demoExpiresAt: new Date(now.getTime() + DEMO_MS), passwordHash: NO_PASSWORD };
  const today = localParts(now, ZONE).date;

  const studentId = await prisma.$transaction(
    async (tx) => {
      const teacher = await tx.user.create({
        data: {
          ...demo,
          email: `noa.kealoha+${tag}@${DEMO_DOMAIN}`,
          name: "Noa Kealoha",
          instrument,
          role: "teacher",
          emailVerifiedAt: ago(400),
          createdAt: ago(400),
          roles: { create: { role: "teacher" } },
        },
      });
      const kai = await tx.user.create({
        data: {
          ...demo,
          email: `kai.tanaka+${tag}@${DEMO_DOMAIN}`,
          name: "Kai Tanaka",
          age: "27",
          // 555-01xx numbers are set aside for fiction.
          phone: "(808) 555-0142",
          instrument,
          experience: "Some",
          level: "Beginner",
          instructionType: "In person",
          plan: "Monthly",
          emailVerifiedAt: ago(96),
          createdAt: ago(96, 1),
          paidAt: ago(96),
        },
      });
      const kaiKey = { userId: kai.id };

      await tx.teacherStudent.create({ data: { teacherId: teacher.id, studentId: kai.id, createdAt: ago(95) } });
      await tx.studentProfile.create({
        data: {
          ...kaiKey,
          ageBracket: "18+",
          area: "Mānoa",
          goals: student.goals,
          rehearsalFormat: "in-person",
          genres: ["Classic rock", "Blues", "Indie"],
          favouriteArtists: "Creedence Clearwater Revival, Tom Petty, The Black Keys",
          learningPreferences: "By ear first, then the chart. Short practice sessions most days suit me better than one long one.",
          bandInterest: true,
          performInterest: true,
        },
      });
      await tx.instrumentSkill.create({ data: { ...kaiKey, instrument, primary: true, selfLevel: "Developing", teacherLevel: "Level 2", assessedBy: teacher.id } });
      await tx.availability.createMany({
        data: [
          { weekday: 2, startMinute: 15 * 60 + 30, endMinute: 18 * 60 },
          { weekday: 4, startMinute: 15 * 60 + 30, endMinute: 18 * 60 },
          { weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60 },
        ].map((w) => ({ ...kaiKey, ...w, timeZone: ZONE })),
      });
      await tx.consentRecord.createMany({
        data: ["share-practice", "band-matching"].map((purpose) => ({ ...kaiKey, givenById: kai.id, purpose, granted: true, createdAt: ago(90) })),
      });

      // Upcoming lessons: the weekly one at the studio, Tuesdays at 4pm since about three months ago,
      // and a group workshop on the second Saturday from now. In person, so there's no meeting link.
      let firstTuesday = addDays(today, -91);
      while (weekdayOf(firstTuesday) !== 2) firstTuesday = addDays(firstTuesday, -1);
      let workshopDay = addDays(today, 8);
      while (weekdayOf(workshopDay) !== 6) workshopDay = addDays(workshopDay, 1);
      const [workshop, about] = student.workshop;
      const classes = [
        {
          data: {
            kind: "lesson",
            title: student.lesson,
            description: "Weekly one-to-one lesson at the Rock Works studio.",
            capacity: 1,
            firstDate: firstTuesday,
            startMinute: 16 * 60,
            durationMinutes: 45,
            repeat: "weekly",
            repeatUntil: addDays(today, 84),
            songId: song?.id ?? null,
            createdAt: ago(92),
          },
          enrolled: ago(92),
        },
        {
          data: {
            kind: "workshop",
            title: workshop,
            description: about,
            capacity: 8,
            firstDate: workshopDay,
            startMinute: 10 * 60 + 30,
            durationMinutes: 90,
            repeat: "none",
            createdAt: ago(10),
          },
          enrolled: ago(4),
        },
      ];
      for (const { data, enrolled } of classes) {
        const cls = await tx.class.create({ data: { ...data, teacherId: teacher.id, level: "Beginner", instruments: [instrument], timeZone: ZONE } });
        await regenerate(tx, cls, now);
        await tx.classEnrollment.create({ data: { classId: cls.id, userId: kai.id, createdAt: enrolled } });
      }

      for (const { sent, feedback, reviewedAt, ...work } of teacherWork(content, ago, student)) {
        await tx.assignment.create({
          data: {
            ...work,
            teacherId: teacher.id,
            studentId: kai.id,
            instrument,
            level: 2,
            updatedAt: reviewedAt ?? sent ?? work.createdAt,
            submissions: sent ? { create: { createdAt: sent, feedback: feedback ?? null, reviewedAt: reviewedAt ?? null } } : undefined,
          },
        });
      }

      if (song) {
        // Where Kai left off in the song, at the speed the open work asks for, plus a saved mix.
        const { chorus, values } = songWords(song);
        const position = chorus ? round(chorus.start + (chorus.end - chorus.start) * 0.4) : 30;
        const { session } = validateSession({ position, speed: 0.75 });
        await tx.songPractice.create({
          data: {
            ...kaiKey,
            songId: song.id,
            favorite: true,
            notes: fill(student.notes, values),
            lastOpenedAt: ago(0, 20),
            session,
            sessionSavedAt: ago(0, 20),
            createdAt: ago(40),
          },
        });
        const own = partForInstrument(instrument);
        if (song.tracks.some((t) => t.part === own)) {
          const { settings } = validateMixer(
            { stems: { [own]: { volume: 100 }, [BACKING]: { volume: 65 } }, master: 90, take: 80, mode: "full", focus: own },
            { staff: false, instrument }
          );
          if (settings) await tx.mixPreset.create({ data: { ...kaiKey, songId: song.id, name: `${instrument} up front`, settings } });
        }
      }

      return kai.id;
    },
    { maxWait: 10000, timeout: 20000 }
  );

  return prisma.user.findUnique({ where: { id: studentId }, include: { roles: true } });
}

// ---------------------------------------------------------------------------------------------
// Throwing demos away

// Deletes demo accounts and everything they own. Only ever demo accounts: that condition is added
// here rather than trusted to callers. A class outlives its teacher's account on purpose
// (onDelete SetNull), so a demo teacher's classes are deleted first.
async function deleteDemoAccounts(where) {
  const doomed = await prisma.user.findMany({ where: { AND: [where, { demoExpiresAt: { not: null } }] }, select: { id: true } });
  if (!doomed.length) return 0;
  const ids = doomed.map((u) => u.id);
  await prisma.$transaction([
    prisma.class.deleteMany({ where: { teacherId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids }, demoExpiresAt: { not: null } } }),
  ]);
  return ids.length;
}

// Ends one visitor's demo: the student and the teacher made with them.
async function endDemo(student) {
  if (!isDemo(student)) return 0;
  const links = await prisma.teacherStudent.findMany({ where: { studentId: student.id }, select: { teacherId: true } });
  return deleteDemoAccounts({ id: { in: [student.id, ...links.map((l) => l.teacherId)] } });
}

// Clears expired demos, and the oldest ones while there are too many. Their sessions expire with them.
async function sweepDemos(now = clock.now()) {
  let removed = await deleteDemoAccounts({ demoExpiresAt: { lte: now } });
  const live = await prisma.user.findMany({
    where: { demoExpiresAt: { not: null }, role: "student" },
    orderBy: { demoExpiresAt: "asc" },
    select: { id: true, demoExpiresAt: true },
  });
  for (const student of live.slice(0, Math.max(0, live.length - MAX_LIVE + 1))) removed += await endDemo(student);
  return removed;
}

module.exports = {
  DEMO_MS,
  MAX_LIVE,
  STUDENTS,
  demoStatus,
  checkDemoPasscode,
  setDemoPasscode,
  closeDemo,
  startDemo,
  endDemo,
  sweepDemos,
};
