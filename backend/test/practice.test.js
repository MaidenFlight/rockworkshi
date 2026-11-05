// Favourites, notes and resume state belong to one student and one song. Runs against
// the dev database in .env with throwaway @example.test accounts.
require("dotenv").config({ quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const RUN = `practice-test-${Date.now()}`;
let server;
let base;
const songs = {};
const users = {};
const tokens = {};

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const mixer = {
  mode: "minus",
  focus: "Guitar",
  master: 80,
  take: 100,
  takeMuted: false,
  stems: { Drums: { volume: 40, muted: false, soloed: false } },
  effects: null,
};

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  for (const name of ["a", "b", "unpaid"]) {
    users[name] = await prisma.user.create({
      data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", ...(name === "unpaid" ? {} : { paidAt: new Date() }) },
    });
    tokens[name] = signMobileToken(users[name], "10m");
  }
  songs.one = await prisma.song.create({ data: { title: `${RUN} One`, artist: "Band", level: "Beginner" } });
  songs.two = await prisma.song.create({ data: { title: `${RUN} Two`, level: "Intermediate" } });
  songs.hidden = await prisma.song.create({ data: { title: `${RUN} Hidden`, published: false } });
  await prisma.songTrack.createMany({
    data: [songs.one, songs.two].map((song) => ({ songId: song.id, part: "Bass", storageKey: `${RUN}/${song.id}.mp3` })),
  });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.$disconnect();
  server.close();
});

test("only paying students (and staff) reach the library", async () => {
  assert.equal((await call(null, "GET", "/library")).status, 401);
  assert.equal((await call("unpaid", "GET", "/library")).status, 402);
  const lib = await call("a", "GET", "/library");
  assert.equal(lib.status, 200);
  const mine = lib.data.songs.filter((s) => s.title.startsWith(RUN));
  assert.deepEqual(mine.map((s) => s.title).sort(), [`${RUN} One`, `${RUN} Two`], "unpublished songs left out");
  assert.equal(mine[0].favorite, false);
});

test("favourites and notes are per student", async () => {
  const one = songs.one.id;
  assert.equal((await call("a", "PUT", `/songs/${one}/favorite`, { favorite: "yes" })).status, 400);
  assert.equal((await call("a", "PUT", `/songs/${one}/favorite`, { favorite: true })).data.favorite, true);
  assert.equal((await call("a", "PUT", `/songs/${one}/notes`, { notes: "Watch the chorus strum.  \n" })).status, 200);

  const a = await call("a", "GET", `/songs/${one}/practice`);
  assert.equal(a.data.practice.favorite, true);
  assert.equal(a.data.practice.notes, "Watch the chorus strum.", "trailing space trimmed");

  // Student B sees none of A's state for the same song.
  const b = await call("b", "GET", `/songs/${one}/practice`);
  assert.deepEqual(b.data.practice, { favorite: false, notes: null, lastOpenedAt: null, session: null });
  const bLib = await call("b", "GET", "/library");
  const bOne = bLib.data.songs.find((s) => s.id === one);
  assert.equal(bOne.favorite, false);
  assert.equal(bOne.hasNotes, false);

  const aLib = await call("a", "GET", "/library");
  const aOne = aLib.data.songs.find((s) => s.id === one);
  assert.equal(aOne.favorite, true);
  assert.equal(aOne.hasNotes, true);
  assert.equal("notes" in aOne, false, "note text stays out of the list");

  assert.equal((await call("a", "PUT", `/songs/${one}/notes`, { notes: "x".repeat(5001) })).status, 400);
  assert.equal((await call("a", "PUT", `/songs/${one}/notes`, { notes: "" })).data.notes, null, "empty clears");
  assert.equal((await call("a", "PUT", `/songs/${songs.hidden.id}/notes`, { notes: "hi" })).status, 404);
  assert.equal((await call("a", "PUT", `/songs/not-a-song/favorite`, { favorite: true })).status, 404);
});

test("continue practising picks the most recently opened song", async () => {
  assert.equal((await call("a", "POST", `/songs/${songs.one.id}/practice/opened`)).status, 204);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await call("a", "POST", `/songs/${songs.two.id}/practice/opened`)).status, 204);
  await call("a", "PUT", `/songs/${songs.two.id}/practice/session`, { session: { position: 42.5 } });

  const lib = await call("a", "GET", "/library");
  assert.equal(lib.data.continue.song.id, songs.two.id);
  assert.equal(lib.data.continue.position, 42.5);
  assert.equal((await call("b", "GET", "/library")).data.continue?.song.title.startsWith(RUN) ?? false, false);

  // A song with no stems is coming soon, so there's nothing to continue even if it was opened last.
  const soon = await prisma.song.create({ data: { title: `${RUN} Soon` } });
  await new Promise((r) => setTimeout(r, 20));
  await call("a", "POST", `/songs/${soon.id}/practice/opened`);
  assert.equal((await call("a", "GET", "/library")).data.continue.song.id, songs.two.id);
  await prisma.song.delete({ where: { id: soon.id } });
});

test("resume state merges, validates, and never touches named presets", async () => {
  const one = songs.one.id;
  const preset = await call("a", "PUT", `/songs/${one}/mix-presets`, {
    name: "Keep me",
    settings: { ...mixer, master: 55 },
  });
  assert.equal(preset.status, 201);

  // Phone save with speed and loop, then a website save without them.
  const phone = { position: 61, speed: 0.75, loop: { start: 30, end: 45 }, mixer };
  assert.equal((await call("a", "PUT", `/songs/${one}/practice/session`, { session: phone })).status, 204);
  assert.equal(
    (await call("a", "PUT", `/songs/${one}/practice/session`, { session: { position: 70, mixer: { ...mixer, master: 90 } } })).status,
    204
  );
  const saved = (await call("a", "GET", `/songs/${one}/practice`)).data.practice.session;
  assert.equal(saved.position, 70);
  assert.equal(saved.speed, 0.75, "website save kept the phone's speed");
  assert.deepEqual(saved.loop, { start: 30, end: 45 });
  assert.equal(saved.mixer.master, 90);

  const presets = (await call("a", "GET", `/songs/${one}/mix-presets`)).data.presets;
  assert.equal(presets.length, 1);
  assert.equal(presets[0].settings.master, 55, "named preset unchanged");

  const bad = (session) => call("a", "PUT", `/songs/${one}/practice/session`, { session });
  assert.equal((await bad({ position: -1 })).status, 400);
  assert.equal((await bad({ speed: 3 })).status, 400);
  assert.equal((await bad({ loop: { start: 20, end: 10 } })).status, 400);
  assert.equal((await bad({ mixer: { ...mixer, master: 400 } })).status, 400);
  assert.equal((await bad({})).status, 400);
  assert.equal((await bad({ loop: { start: 20, end: null } })).status, 204, "a start-only loop is fine");

  // B's session for the same song is separate.
  assert.equal((await call("b", "GET", `/songs/${one}/practice`)).data.practice.session, null);
});

test("lesson videos stay hidden until they're switched on", () => {
  const { presentLesson } = require("../src/lib/lessonVideos");
  const lesson = {
    id: "x",
    videos: [{ published: true, instrument: "Guitar", kind: "lesson", level: 1, provider: "direct", videoId: "https://example.test/a.mp4" }],
  };
  const before = process.env.LESSON_VIDEOS_READY;
  try {
    delete process.env.LESSON_VIDEOS_READY;
    assert.equal(presentLesson(lesson, "Guitar").videoUrl, null);
    process.env.LESSON_VIDEOS_READY = "true";
    assert.equal(presentLesson(lesson, "Guitar").videoUrl, "https://example.test/a.mp4");
  } finally {
    if (before === undefined) delete process.env.LESSON_VIDEOS_READY;
    else process.env.LESSON_VIDEOS_READY = before;
  }
});
