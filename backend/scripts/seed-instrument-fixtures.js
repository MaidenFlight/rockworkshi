// Test accounts and content for checking instrument access (lib/instrumentAccess.js) by hand.
// LOCAL DATABASES ONLY: it refuses any database that isn't on this machine, and the database's name
// must be repeated with --confirm. It sends no email, takes no payment (paid status is set directly)
// and never writes to R2: stems and mixes go to MEDIA_DIR, which it requires.
//
// Usage: npm run seed:fixtures -- --confirm <database name> [--stems <folder>]
//   --stems  the folder of "Have You Ever Seen the Rain" stems (as for songs:upload), copied into
//            MEDIA_DIR and mixed. Without it the song's player stays "coming soon" for students.
// Safe to run again: it updates what it made before. The password is FIXTURE_PASSWORD from .env,
// or a new random one; the accounts and password are written to .local/fixture-accounts.md.
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parseArgs } = require("util");
const bcrypt = require("bcrypt");
const prisma = require("../src/lib/prisma");
const { mediaDir, putMedia } = require("../src/lib/media");
const { validateChart } = require("../src/lib/chordChart");
const { partFromFileName, storageKeyFor } = require("../src/lib/songTracks");
const { measureMixLevel } = require("../src/lib/mixLevel");
const { renderMixes, saveMixes } = require("../src/lib/songMixes");
const { spawnSync } = require("child_process");

const { values } = parseArgs({ options: { confirm: { type: "string" }, stems: { type: "string" } } });

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];
const RAIN_CHART = path.join(__dirname, "../charts/have-you-ever-seen-the-rain.json");
const FIXTURE_SONG = { title: "TEST FIXTURE: Tone Band", artist: "Rock Works test fixture (not a real song)" };
const TERM_NAME = "TEST FIXTURE term";

// Clearly fake people at the reserved example.com domain.
const STUDENTS = [
  { key: "guitar", email: "student.guitar@example.com", name: "Gita Guitar (test)", instrument: "Guitar", term: true, teacher: true },
  { key: "piano", email: "student.piano@example.com", name: "Pia Piano (test)", instrument: "Piano", term: true },
  { key: "bass", email: "student.bass@example.com", name: "Basil Bass (test)", instrument: "Bass", term: true, teacher: true },
  { key: "drums", email: "student.drums@example.com", name: "Drew Drums (test)", instrument: "Drums", term: true },
  { key: "voice", email: "student.voice@example.com", name: "Vic Voice (test)", instrument: "Voice", term: true },
  { key: "ukulele", email: "student.ukulele@example.com", name: "Uma Ukulele (test)", instrument: "Ukulele", term: true },
  { key: "noinstrument", email: "student.noinstrument@example.com", name: "Nolan No-Instrument (test)", instrument: null, term: true },
  { key: "unpaid", email: "student.unpaid@example.com", name: "Una Unpaid (test)", instrument: "Guitar", term: true, unpaid: true },
  { key: "outside", email: "student.outside@example.com", name: "Otto Outside (test)", instrument: "Guitar" },
  { key: "assigned", email: "student.assigned@example.com", name: "Asa Assigned (test)", instrument: "Bass", teacher: true },
  { key: "retained", email: "student.retained@example.com", name: "Reta Retained (test)", instrument: "Drums", retained: true },
];
// Their own profiles name an instrument too, to show staff still get every part whatever it says.
const STAFF = [
  { key: "teacher", email: "teacher@example.com", name: "Tess Teacher (test)", role: "teacher", instrument: "Guitar" },
  { key: "admin", email: "admin@example.com", name: "Ada Admin (test)", role: "admin", instrument: "Piano" },
];

function refuseUnlessLocal() {
  const url = new URL(process.env.DATABASE_URL);
  const database = url.pathname.replace(/^\//, "");
  if (process.env.NODE_ENV === "production") throw new Error("NODE_ENV is production. Not seeding test accounts.");
  if (!LOCAL_HOSTS.includes(url.hostname)) throw new Error(`The database is on ${url.hostname}, not this machine. Not seeding test accounts.`);
  if (values.confirm !== database) throw new Error(`This would write test accounts into "${database}" on ${url.hostname}. Run again with --confirm ${database}.`);
  if (!mediaDir()) throw new Error("Set MEDIA_DIR in .env: the fixtures keep their audio there, never in R2.");
  return database;
}

function ffmpeg(args) {
  const out = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr?.toString().trim() || out.error?.message}`);
}

// 16 seconds of a plain tone per part, so each part is easy to tell apart by ear and on a meter.
// No keys stem, and only a bass transcription, to show what students see when theirs is missing.
async function seedFixtureSong() {
  const tones = {
    Guitar: "sine=frequency=440:duration=16",
    Bass: "sine=frequency=110:duration=16",
    Vocals: "sine=frequency=660:duration=16",
    Drums: "anoisesrc=d=16:c=pink:a=0.3,volume='if(lt(mod(t,0.5),0.06),1,0)':eval=frame",
  };
  const song =
    (await prisma.song.findFirst({ where: FIXTURE_SONG, include: { tracks: true } })) ||
    (await prisma.song.create({ data: { ...FIXTURE_SONG, level: "Test", notes: "Made by seed:fixtures. Test tones, not teaching content." }, include: { tracks: true } }));
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "rw-fixture-"));
  try {
    const stems = [];
    for (const [part, source] of Object.entries(tones)) {
      const file = path.join(dir, `${part}.mp3`);
      ffmpeg(["-f", "lavfi", "-i", source, "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", file]);
      const storageKey = storageKeyFor(song.id, part);
      await putMedia(storageKey, fs.readFileSync(file), "audio/mpeg");
      await prisma.songTrack.upsert({
        where: { songId_part: { songId: song.id, part } },
        update: { storageKey },
        create: { songId: song.id, part, storageKey },
      });
      stems.push({ part, input: file });
    }
    // Two sections of four bars, two seconds a bar.
    const chords = ["C", "G", "Am", "F"];
    const sections = ["Test A", "Test B"].map((name, s) => ({
      name,
      bars: chords.map((c, b) => ({ time: s * 8 + b * 2, chords: [{ name: c, time: s * 8 + b * 2 }] })),
    }));
    const roots = { C: 36, G: 31, Am: 33, F: 29 };
    const bassNotes = sections.flatMap((section) => section.bars.map((bar) => ({ time: bar.time, len: 1.8, midi: roots[bar.chords[0].name] })));
    const { error, chart } = validateChart({ end: 16, sections, parts: { Bass: { draft: false, notes: bassNotes } } });
    if (error) throw new Error(error);
    const mixLevel = await measureMixLevel(stems.map((s) => s.input));
    await prisma.song.update({ where: { id: song.id }, data: { chart, mixLevel, published: true } });
    const fresh = await prisma.song.findUnique({ where: { id: song.id }, include: { tracks: true } });
    await saveMixes(fresh, await renderMixes(stems));
    return song;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function seedRain() {
  const input = JSON.parse(fs.readFileSync(RAIN_CHART, "utf8"));
  const { error, chart } = validateChart(input);
  if (error) throw new Error(error);
  const where = { title: input.title, artist: input.artist };
  const song =
    (await prisma.song.findFirst({ where })) || (await prisma.song.create({ data: { ...where, level: "Beginner", published: true } }));
  await prisma.song.update({ where: { id: song.id }, data: { chart, published: true } });

  if (values.stems) {
    const files = fs.readdirSync(values.stems).filter((f) => f.toLowerCase().endsWith(".mp3"));
    const stems = [];
    for (const file of files) {
      const part = partFromFileName(file);
      if (!part) continue;
      const fullPath = path.join(values.stems, file);
      const storageKey = storageKeyFor(song.id, part);
      await putMedia(storageKey, fs.readFileSync(fullPath), "audio/mpeg");
      await prisma.songTrack.upsert({
        where: { songId_part: { songId: song.id, part } },
        update: { storageKey },
        create: { songId: song.id, part, storageKey },
      });
      stems.push({ part, input: fullPath });
    }
    if (!stems.length) throw new Error(`No stems in ${values.stems}.`);
    await prisma.song.update({ where: { id: song.id }, data: { mixLevel: await measureMixLevel(stems.map((s) => s.input)) } });
    const fresh = await prisma.song.findUnique({ where: { id: song.id }, include: { tracks: true } });
    await saveMixes(fresh, await renderMixes(stems));
  }
  return song;
}

async function upsertUser(person, passwordHash, data) {
  return prisma.user.upsert({
    where: { email: person.email },
    update: { name: person.name, passwordHash, ...data },
    create: { email: person.email, name: person.name, passwordHash, emailVerifiedAt: new Date(), ...data },
  });
}

async function main() {
  const database = refuseUnlessLocal();
  const password = process.env.FIXTURE_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`Seeding instrument fixtures into "${database}" (local).`);
  const rain = await seedRain();
  const fixture = await seedFixtureSong();

  // A term whose month 1 is Rain, published and already open; months 2 and 3 left as drafts.
  const group =
    (await prisma.termGroup.findFirst({ where: { name: TERM_NAME } })) ||
    (await prisma.termGroup.create({
      data: {
        name: TERM_NAME,
        startsAt: new Date("2026-11-01T10:00:00.000Z"),
        endsAt: new Date("2027-02-01T09:59:59.999Z"),
        slots: {
          create: [
            { month: 1, unlockAt: new Date("2026-11-01T10:00:00.000Z") },
            { month: 2, unlockAt: new Date("2026-12-01T10:00:00.000Z") },
            { month: 3, unlockAt: new Date("2027-01-01T10:00:00.000Z") },
          ],
        },
      },
    }));
  await prisma.termSlot.update({
    where: { groupId_month: { groupId: group.id, month: 1 } },
    data: { songId: rain.id, published: true, publishedAt: new Date() },
  });

  const staff = {};
  for (const person of STAFF) {
    staff[person.key] = await upsertUser(person, passwordHash, {
      role: person.role === "teacher" ? "teacher" : "student",
      instrument: person.instrument,
      status: "active",
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: staff[person.key].id, role: person.role } },
      create: { userId: staff[person.key].id, role: person.role },
      update: {},
    });
  }

  const students = {};
  for (const person of STUDENTS) {
    const user = await upsertUser(person, passwordHash, {
      instrument: person.instrument,
      paidAt: person.unpaid ? null : new Date(),
      plan: person.unpaid ? null : "Term",
      status: "active",
      role: "student",
    });
    students[person.key] = user;
    if (person.term) await prisma.termEnrollment.createMany({ data: [{ userId: user.id, groupId: group.id }], skipDuplicates: true });
    else await prisma.termEnrollment.deleteMany({ where: { userId: user.id, groupId: group.id } });
    if (person.teacher) {
      await prisma.teacherStudent.upsert({
        where: { teacherId_studentId: { teacherId: staff.teacher.id, studentId: user.id } },
        create: { teacherId: staff.teacher.id, studentId: user.id },
        update: {},
      });
    }
    // Reached Rain in the term before leaving it, so keeps it (TermGrant) without being enrolled.
    if (person.retained) {
      await prisma.termGrant.upsert({
        where: { userId_songId: { userId: user.id, songId: rain.id } },
        create: { userId: user.id, songId: rain.id, groupId: group.id },
        update: {},
      });
    }
  }

  // Rain, assigned by the teacher to a student outside the term: their own instrument only.
  const brief = {
    teacherId: staff.teacher.id,
    studentId: students.assigned.id,
    songId: rain.id,
    instrument: "Bass",
    level: 2,
    section: "Chorus 1",
    instruction: "TEST: play the chorus bass line along with the backing band.",
  };
  if (!(await prisma.assignment.findFirst({ where: { teacherId: brief.teacherId, studentId: brief.studentId, songId: brief.songId } }))) {
    await prisma.assignment.create({ data: brief });
  }

  const rows = [...STAFF.map((p) => ({ ...p, about: p.role === "admin" ? "Admin: every stem and part, Admin → Students sets instruments" : "Teacher: every stem and part; teaches guitar, bass and assigned" })),
    ...STUDENTS.map((p) => ({
      ...p,
      about: [
        p.instrument || "no instrument",
        p.unpaid ? "not paid" : "paid",
        p.term ? "in the term (Rain open)" : p.retained ? "kept Rain after leaving the term" : p.key === "assigned" ? "Rain assigned by the teacher" : "not in the term (Rain locked)",
      ].join(" · "),
    }))];
  const list = [
    "# Instrument access fixtures (local only)",
    "",
    `Database: ${database} on this machine. Made by \`npm run seed:fixtures\`. Not committed.`,
    "",
    `Password for every account: \`${password}\``,
    "",
    "Sign in at http://127.0.0.1:3100/signin (not localhost: other local apps share localhost cookies). Start it with the instrument-dev entry in the main checkout's .claude/launch.json.",
    "",
    "| Email | Name | What it shows |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.email} | ${r.name} | ${r.about} |`),
    "",
    `Songs: "${rain.title}" (term month 1) and "${fixture.title}" (test tones, no keys stem, only a bass chart; open to every paid student).`,
    "",
  ].join("\n");
  const out = path.join(__dirname, "../.local/fixture-accounts.md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, list);
  console.log(`Seeded ${STUDENTS.length} students and ${STAFF.length} staff. Accounts and password: ${path.relative(process.cwd(), out)}`);
  if (!values.stems) console.log(`No --stems: "${rain.title}" has no audio here, so its player says "coming soon".`);
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
