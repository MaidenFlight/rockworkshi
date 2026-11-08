// The student demo. The Demo tab (/demo) lets someone the school invites (a potential employer, say)
// look around the member area as a student sees it, without signing up: they enter the passcode an
// admin set in Admin → Student demo, pick an instrument, and are signed into a sample student of that
// instrument. Until a passcode is set, the demo is closed.
//
// Each visitor gets a household of their own: Kai, a student about three months in on the instrument
// they picked, and a stand-in for the school's teacher, Brian Albus, who sets Kai's work and teaches
// Kai's group lesson. Both are ordinary User rows marked with demoExpiresAt, so every student feature
// runs on them unchanged: their own part of the song with the band, the chart and chord library for
// their instrument, the tools. What keeps the demo apart from the school:
//   - no one signs into a demo account with a password (config/passport.js), and it has none to
//     change or reset;
//   - staff never see one: admin lists, counts and exports leave them out (REAL), no real teacher is
//     linked to one, and nothing a demo account does is written to the audit log;
//   - nothing leaves the sandbox. No payments, no email (lib/mailer.js won't send to DEMO_DOMAIN), no
//     trial bookings or messages to the school, no recordings uploaded: those routes answer 403 with
//     reason "demo" and say why (refuseDemo in lib/demoRules.js). Work and takes sent for review reach
//     only the demo's own stand-in teacher account, which no one signs into, and are deleted with it;
//   - it's thrown away. Leaving deletes the household, switching instrument swaps it for a new one, and
//     a sweep deletes any that expired, so every visitor starts from the same place.
// Shared content (songs, lessons, the chord library) is only read. The demo never adds a term slot:
// a slot locks its song for every real student outside that term (lib/termAccess.js).
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("./prisma");
const clock = require("./clock");
const { DEMO_DOMAIN, isDemo } = require("./demoRules");
const { localParts, addDays, weekdayOf, toInstant } = require("./zoned");
const { regenerate } = require("./classes");
const { validateSession } = require("./practice");
const { validateMixer, partForInstrument, canonicalInstrument } = require("./instrumentAccess");
const { deleteAssignmentRecordings } = require("./assignments");
const { buildMonth, sectionsOf } = require("./weeklyTemplate");

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

// The song a demo practises, for the Demo page to name. The first with stems, as in findSong.
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
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

// The school's teacher, who teaches the demo's group lesson and sets its practice work. In the demo
// it's a throwaway account with his name, never his own account.
const TEACHER = { name: "Brian Albus", email: "brian.albus" };

// What a student of each instrument works on in "Have You Ever Seen the Rain" (or whichever song the
// demo practises), in their teacher's words. The chart fills in {change} (the chorus's first chord
// change) and {verseTo} (the verse's first new chord). The Demo tab offers some of these for now
// (DEMO_INSTRUMENTS); all are kept ready.
const STUDENTS = {
  Guitar: {
    tip: "Keep your strumming hand moving through every change.",
    goals: "Play rhythm guitar in a band by the summer showcase, and learn to take a short solo over a blues.",
    now: "Loop the chorus at 75% speed until {change} feels easy, then try it at full speed. Keep your strumming hand moving through every change, even if a chord buzzes.",
    verse: "Strum the verse along with the band at 90% speed. Down strums on every beat to start, and look ahead to each change so you're there on time.",
    verseFeedback:
      "Much steadier! You're landing {verseTo} on time now, and your strumming hand keeps going through the change, which is exactly right. Try the verse at full speed this week, then we'll start on the chorus.",
    notes: "Chorus: watch {change}. Lift early and let the last strum ring.\nVerse is fine at full speed now.",
  },
  Piano: {
    tip: "Move your left hand to each new root first.",
    goals: "Play keys in a band by the summer showcase, and learn to comp from a chord chart.",
    now: "Loop the chorus at 75% speed with the chords in your right hand and the roots in your left. Get {change} smooth without looking down, then try it at full speed.",
    verse: "Play the verse along with the band at 90% speed: a chord on every beat in your right hand, the root in your left. Keep your hand relaxed so each change is a small move.",
    verseFeedback:
      "Lovely and even. You're finding {verseTo} without a gap now, and your left hand is right on the beat. Try the verse at full speed this week, then we'll start on the chorus.",
    notes: "Chorus: watch {change}. Move the left hand first.\nVerse is fine at full speed now.",
  },
  Bass: {
    tip: "Lock your roots to the kick drum.",
    goals: "Hold down the low end in a band by the summer showcase, and learn to read bass tab fluently.",
    now: "Loop the chorus at 75% speed and play the root of each chord with the kick drum. Once it's steady, follow the tab for the notes that lead into each change.",
    verse: "Play the verse along with the band at 90% speed: roots only, on every beat, with the kick drum. Count the bars so you change chords with the band.",
    verseFeedback:
      "Great time feel! Your roots sit right on the kick drum now, and you're changing with the band every time. Try the verse at full speed this week, then we'll add the passing notes from the tab.",
    notes: "Chorus: lock the roots to the kick drum.\nVerse is fine at full speed now.",
  },
  Drums: {
    tip: "Keep the hi-hat steady and the snare on 2 and 4.",
    goals: "Play a full set with a band by the summer showcase, and keep steady time through every fill.",
    now: "Loop the chorus at 75% speed with the band. Keep the hi-hat in steady eighth notes and the snare on 2 and 4, then add a crash on the first beat of each line.",
    verse: "Play the verse along with the band at 90% speed: hi-hat in eighth notes, snare on 2 and 4, kick on 1 and 3. Keep it simple and steady.",
    verseFeedback:
      "Rock solid! Your backbeat sits right in the pocket now and the hi-hat stays even. Try the verse at full speed this week, then we'll add the fill into the chorus.",
    notes: "Chorus: don't rush the fill into it.\nVerse is fine at full speed now.",
  },
  Voice: {
    tip: "Take a breath before each line.",
    goals: "Sing lead in a band by the summer showcase, and learn to hold a harmony.",
    now: "Loop the chorus at 75% speed and sing along with the band. Take a breath before each line, and land on the first note of each line instead of sliding up to it.",
    verse: "Sing the verse along with the band at 90% speed, following the melody in the chart. Keep the long notes steady right to the end.",
    verseFeedback:
      "Beautiful tone! Your long notes are steady now and you're in tune at the start of each line. Try the verse at full speed this week, then we'll work on the chorus.",
    notes: "Chorus: breathe before each line.\nVerse is fine at full speed now.",
  },
  Ukulele: {
    tip: "Keep the down-down-up strum going through every change.",
    goals: "Play and sing a whole set of songs on ukulele by the summer showcase.",
    now: "Loop the chorus at 75% speed with a down-down-up strum until {change} feels easy, then try it at full speed. Keep your strumming hand moving through every change.",
    verse: "Strum the verse along with the band at 90% speed, one down strum on every beat. Look ahead to each change so you're there on time.",
    verseFeedback:
      "Much steadier! You're landing {verseTo} on time now, and your strum keeps going through the change. Try the verse at full speed this week, then we'll start on the chorus.",
    notes: "Chorus: watch {change}. Keep strumming through it.\nVerse is fine at full speed now.",
  },
};

// A chart needs this many sections for the month's story: three sent, then today's (monthTasks).
const MONTH_SECTIONS = 4;

// The song the demo practises: one with this instrument's own stem and a chart long enough for the
// month, else one with the stem, else any with stems. Songs share an `order`, so the chart decides
// rather than whichever comes first: a new song without a chart yet won't take the demo over.
async function findSong(instrument) {
  const songs = await prisma.song.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    select: { id: true, title: true, chart: true, tracks: { select: { part: true } } },
  });
  const own = partForInstrument(instrument);
  const hasPart = (s) => s.tracks.some((t) => t.part === own);
  return (
    songs.find((s) => hasPart(s) && sectionsOf(s.chart).length >= MONTH_SECTIONS) ||
    songs.find(hasPart) ||
    songs.find((s) => s.tracks.length) ||
    null
  );
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

// When a section's chords first change, in seconds into the song: where the teacher's note about rushing
// is pinned (monthTasks). Null when the section never changes chord.
function firstChangeAt(chart, name) {
  const section = chart?.sections?.find((s) => s.name === name);
  const chords = (section?.bars ?? []).flatMap((b) => b.chords ?? []);
  const k = chords.findIndex((c, n) => n > 0 && c.name !== chords[n - 1].name);
  return k > 0 && Number.isFinite(chords[k].time) ? round(chords[k].time) : null;
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

// How long ago the demo's month began, so a visitor lands in its third week with two weeks behind them.
const MONTH_BEGAN_DAYS_AGO = 16;

// A month of weekly practice on the song, from the template the teachers use (lib/weeklyTemplate.js) and
// with the instrument's own words on the first verse and chorus. Weeks 1 and 2 are done: checkpoints
// saved and assessments marked, one of them sent twice. Week 3 is under way, with its video assessment
// still to do, and week 4 is ahead. The sample work has no recordings, because nobody really played it:
// it's only ever the replies that are shown. at(n) is that many days into the month.
// Returns { weekTitles, tasks }, or null without a song and chart to build it from.
function monthTasks(song, startsOn, at, student) {
  if (!song) return null;
  const { weekTitles, tasks: planned } = buildMonth(song.chart, { startsOn, level: 2 });
  if (!planned.length) return null;
  const { values } = songWords(song);
  const sections = sectionsOf(song.chart);

  const tasks = planned.map((task, i) => ({
    ...task,
    position: i,
    songId: song.id,
    instruction: `${task.instruction} ${student.tip}`,
    createdAt: new Date(at(0).getTime() + i * 1000),
    status: "assigned",
    attempts: [],
  }));
  const find = (week, kind, n = 0) => tasks.filter((t) => t.week === week && t.kind === kind)[n];

  // The first verse and chorus keep the teacher's words for this instrument, and the speeds they name.
  const first = (word) => tasks.find((t) => t.week === 1 && t.kind === "checkpoint" && new RegExp(`^${word}`, "i").test(t.section));
  const verse = first("verse");
  if (verse) Object.assign(verse, { instruction: fill(student.verse, values), targetSpeed: 90 });
  const chorus = first("chorus");
  if (chorus) Object.assign(chorus, { instruction: fill(student.now, values), targetSpeed: 75 });

  const save = (task, ...days) => task && Object.assign(task, { status: "saved", attempts: days.map((day) => ({ sent: at(day) })) });
  const pin = (time, text) => (Number.isFinite(time) ? [{ at: time, text }] : undefined);
  const marked = (task, ...marks) => task.criteria.map((criterion, i) => ({ criterion, mark: marks[i] }));
  const change = firstChangeAt(song.chart, sections.find((s) => /^verse/i.test(s.name))?.name ?? sections[0]?.name);

  // Week 1.
  save(find(1, "checkpoint", 0), 1);
  save(find(1, "checkpoint", 1), 2, 3);
  save(find(1, "checkpoint", 2), 4);
  const firstAssessment = find(1, "assessment");
  Object.assign(firstAssessment, {
    status: "reviewed",
    attempts: [
      {
        sent: at(5),
        reviewedAt: at(6),
        feedback: "A good start, but you're rushing where the chords change. Play it at 75% with the metronome on, then send it again.",
        notes: pin(change, "Rushing into this change. Wait for beat 1 before you move."),
        marks: marked(firstAssessment, "getting-there", "got-it", "work-on", "getting-there"),
        priorities: ["Wait for beat 1 before you change chord"],
      },
      {
        sent: at(6.5),
        reviewedAt: at(7),
        // The instrument's own words, without the line about what to play next: that's next week's work.
        feedback: `${fill(student.verseFeedback, values).replace(/ Try the verse at full speed.*$/, "")} Next we'll join it up with the rest of what you've learned.`,
        notes: pin(change, "On time into the change now. This was the spot."),
        marks: marked(firstAssessment, "got-it", "got-it", "getting-there", "got-it"),
        priorities: ["Keep that change on time at full speed"],
      },
    ],
  });

  // Week 2.
  save(find(2, "checkpoint", 0), 8);
  save(find(2, "checkpoint", 1), 9);
  save(find(2, "checkpoint", 2), 11);
  const secondAssessment = find(2, "assessment");
  Object.assign(secondAssessment, {
    status: "reviewed",
    attempts: [
      {
        sent: at(12),
        reviewedAt: at(13),
        feedback: "A clean start, and you came in right on the first beat. The sections hang together now, and that's the hard part done. Well done.",
        notes: pin(secondAssessment.sectionStart, "Right on the first beat. Count yourself in like this every time."),
        marks: marked(secondAssessment, "got-it", "got-it", "getting-there", "got-it"),
        priorities: [`Get ${values.change} smooth without looking`, student.tip],
      },
    ],
  });

  // Week 3, under way.
  save(find(3, "checkpoint", 0), 15);

  return { weekTitles, tasks };
}

// Moves each send to the early evening and each reply to mid-morning (the next morning, if the send was
// that evening), so the dates read like a real student's. Keeps them in order and never after now; where
// that can't be done, a moment stays where monthTasks put it.
function settle(tasks, now) {
  const SEND = 18 * 60 + 30;
  const REPLY = 9 * 60 + 15;
  const events = tasks
    .flatMap((t) => t.attempts.flatMap((a) => [{ a, key: "sent", minute: SEND }, ...(a.reviewedAt ? [{ a, key: "reviewedAt", minute: REPLY }] : [])]))
    .sort((x, y) => x.a[x.key] - y.a[y.key]);
  let floor = 0;
  for (const e of events) {
    const raw = e.a[e.key];
    const date = localParts(raw, ZONE).date;
    const options = [toInstant(date, e.minute, ZONE), toInstant(addDays(date, 1), e.minute, ZONE)];
    const nice = options.find((t) => t.getTime() > floor && t <= now);
    const chosen = nice ?? new Date(Math.min(now.getTime(), Math.max(raw.getTime(), floor + 60 * 1000)));
    e.a[e.key] = chosen;
    floor = chosen.getTime();
  }
}

// A fresh household for one visitor, playing `instrument`, signed-in-ready: the student, with roles loaded.
async function startDemo({ instrument: asked = "Guitar", now = clock.now() } = {}) {
  const instrument = canonicalInstrument(asked) || "Guitar";
  const student = STUDENTS[instrument];
  await sweepDemos(now);
  const song = await findSong(instrument);
  const tag = crypto.randomBytes(6).toString("hex");
  const ago = (days, hours = 0) => new Date(now.getTime() - days * DAY - hours * HOUR);
  const demo = { demoExpiresAt: new Date(now.getTime() + DEMO_MS), passwordHash: NO_PASSWORD };
  const today = localParts(now, ZONE).date;

  const studentId = await prisma.$transaction(
    async (tx) => {
      const teacher = await tx.user.create({
        data: {
          ...demo,
          email: `${TEACHER.email}+${tag}@${DEMO_DOMAIN}`,
          name: TEACHER.name,
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
        data: ["share-practice", "band-matching", "practice-video"].map((purpose) => ({ ...kaiKey, givenById: kai.id, purpose, granted: true, createdAt: ago(90) })),
      });

      // One lesson coming up: a group lesson at the studio on the coming Saturday (at least two days
      // away), for the band's instruments. In person, so there's no meeting link.
      let lessonDay = addDays(today, 2);
      while (weekdayOf(lessonDay) !== 6) lessonDay = addDays(lessonDay, 1);
      const lesson = await tx.class.create({
        data: {
          teacherId: teacher.id,
          kind: "group",
          title: "Group lesson",
          description: "A small-group lesson at the Rock Works studio: guitar, bass and drums students playing the song together.",
          level: "Beginner",
          instruments: ["Guitar", "Bass", "Drums"],
          capacity: 6,
          timeZone: ZONE,
          firstDate: lessonDay,
          startMinute: 10 * 60 + 30,
          durationMinutes: 60,
          repeat: "none",
          songId: song?.id ?? null,
          createdAt: ago(10),
        },
      });
      await regenerate(tx, lesson, now);
      await tx.classEnrollment.create({ data: { classId: lesson.id, userId: kai.id, createdAt: ago(4) } });

      // The month so far. It began far enough back to be in its third week, whatever day it is, and the
      // tasks were set then, in order, so nothing is ever dated after now.
      const startsOn = addDays(today, -MONTH_BEGAN_DAYS_AGO);
      const at = (day) => new Date(toInstant(startsOn, 12 * 60, ZONE).getTime() + day * DAY);
      const month = monthTasks(song, startsOn, at, student);
      const tasks = month?.tasks ?? [];
      settle(tasks, now);
      const monthId = month && (await tx.practiceMonth.create({ data: { teacherId: teacher.id, studentId: kai.id, songId: song.id, startsOn, weekTitles: month.weekTitles, createdAt: at(0) } })).id;
      for (const { attempts, ...work } of tasks) {
        const newest = attempts.at(-1);
        await tx.assignment.create({
          data: {
            ...work,
            monthId,
            teacherId: teacher.id,
            studentId: kai.id,
            instrument,
            level: 2,
            updatedAt: newest?.reviewedAt ?? newest?.sent ?? work.createdAt,
            submissions: {
              create: attempts.map((a) => ({
                createdAt: a.sent,
                feedback: a.feedback ?? null,
                reviewedAt: a.reviewedAt ?? null,
                ...(a.notes ? { notes: a.notes } : {}),
                ...(a.marks ? { marks: a.marks } : {}),
                ...(a.priorities ? { priorities: a.priorities } : {}),
              })),
            },
          },
        });
      }

      if (song) {
        // Where Kai left off: the start of today's task (the first not sent yet), which is where the player
        // opens it. At the speed the work asks for, plus a saved mix.
        const { values } = songWords(song);
        const position = tasks.find((t) => t.status === "assigned" && t.sectionStart != null)?.sectionStart ?? 30;
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
        // A saved mix for the demo's full mixer (it hears every stem: scopeFor in lib/instrumentAccess.js):
        // their own part up front and the rest of the band a little back.
        const own = partForInstrument(instrument);
        if (song.tracks.some((t) => t.part === own)) {
          const stems = Object.fromEntries(song.tracks.map((t) => [t.part, { volume: t.part === own ? 100 : 65 }]));
          const { settings } = validateMixer(
            { stems, master: 90, take: 80, mode: "full", focus: own },
            { staff: false, instrument, allStems: true }
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

// Deletes demo accounts and everything they own, recordings included. Only ever demo accounts: that
// condition is added here rather than trusted to callers. A class outlives its teacher's account on
// purpose (onDelete SetNull), so a demo teacher's classes are deleted first.
async function deleteDemoAccounts(where) {
  const doomed = await prisma.user.findMany({ where: { AND: [where, { demoExpiresAt: { not: null } }] }, select: { id: true } });
  if (!doomed.length) return 0;
  const ids = doomed.map((u) => u.id);
  const work = await prisma.assignment.findMany({ where: { studentId: { in: ids } }, select: { id: true } });
  await prisma.$transaction([
    prisma.class.deleteMany({ where: { teacherId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids }, demoExpiresAt: { not: null } } }),
  ]);
  // Takes a visitor recorded live in storage under their work; this looks there, sent or not.
  await deleteAssignmentRecordings(work.map((a) => a.id));
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
