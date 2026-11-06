// A song's video tutorials (GET /songs/:id/tutorials) and the admin slots behind them.
// Students get their own instrument's published videos and nothing else; the song's own
// checks (sign-in, membership, published, term) apply exactly as they do to its stems.
// Runs against the dev database in .env with throwaway @example.test accounts and songs.
require("dotenv").config({ quiet: true });

const RUN = `tutorials-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;
process.env.LESSON_VIDEOS_READY = "true";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

let server;
let base;
const users = {};
const tokens = {};
const songs = {};
let lesson;

const url = (name) => `https://videos.example.test/${RUN}/${name}.mp4`;

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, data: text ? JSON.parse(text) : null };
}

const tutorials = (who, song, query = "") => call(who, "GET", `/songs/${songs[song].id}/tutorials${query}`);
const videosAt = (data, level) => data.levels[level - 1].videos;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) =>
    prisma.user.create({
      data: { email: `${RUN}-${name}@example.test`, passwordHash: "!", name, paidAt: new Date(), instrument: "Guitar", ...data },
    });
  users.admin = await make("admin");
  users.teacher = await make("teacher", { role: "teacher", instrument: null, paidAt: null });
  users.guitar = await make("guitar");
  users.bass = await make("bass", { instrument: "Bass" });
  users.none = await make("none", { instrument: null });
  users.unpaid = await make("unpaid", { paidAt: null });
  users.termed = await make("termed"); // in a term whose only song hasn't opened yet
  for (const [k, u] of Object.entries(users)) tokens[k] = signMobileToken(u, "10m");

  const video = (instrument, level, kind, videoId, extra = {}) => ({ instrument, level, kind, provider: "direct", videoId, ...extra });
  songs.main = await prisma.song.create({
    data: {
      title: `${RUN} main`,
      videos: {
        create: [
          video("Guitar", 1, "playthrough", `${RUN}-guitar-guid`, { provider: "bunny" }),
          video("Guitar", 1, "lesson", url("guitar-1-lesson")),
          video("Guitar", 2, "lesson", url("guitar-2-draft"), { published: false }),
          video("Bass", 1, "lesson", url("bass-1-lesson")),
          video("Bass", 3, "playthrough", url("bass-3-playthrough")),
          video("Bass", 4, "lesson", url("bass-4-draft"), { published: false }),
        ],
      },
    },
  });
  songs.drafts = await prisma.song.create({
    data: {
      title: `${RUN} drafts`,
      videos: {
        create: [
          video("Guitar", 1, "lesson", url("drafts-1-lesson"), { published: false }),
          video("Guitar", 1, "playthrough", url("drafts-1-playthrough"), { published: false }),
          video("Guitar", 3, "lesson", url("drafts-3-lesson"), { published: false }),
        ],
      },
    },
  });
  songs.hidden = await prisma.song.create({
    data: { title: `${RUN} hidden`, published: false, videos: { create: [video("Guitar", 1, "lesson", url("hidden-1"))] } },
  });
  songs.termed = await prisma.song.create({
    data: { title: `${RUN} termed`, videos: { create: [video("Guitar", 1, "lesson", url("termed-1"))] } },
  });
  lesson = await prisma.lesson.create({
    data: { title: `${RUN} lesson`, videos: { create: [video("Guitar", 1, "lesson", url("lesson-guitar"))] } },
  });

  // Month 1 of this term opens long after the test runs, so the song is locked for its member.
  await prisma.termGroup.create({
    data: {
      name: `${RUN} term`,
      startsAt: new Date("2099-01-01T10:00:00.000Z"),
      endsAt: new Date("2099-04-01T09:59:59.999Z"),
      slots: { create: [{ month: 1, unlockAt: new Date("2099-01-01T10:00:00.000Z"), songId: songs.termed.id, published: true }] },
      members: { create: [{ userId: users.termed.id }] },
    },
  });
});

after(async () => {
  await prisma.termGroup.deleteMany({ where: { name: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.lesson.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.$disconnect();
  server.close();
});

test("a student gets the five levels, with their instrument's published videos lesson first", async () => {
  const { status, data } = await tutorials("guitar", "main");
  assert.equal(status, 200);
  assert.equal(data.instrument, "Guitar");
  assert.deepEqual(
    data.levels.map((l) => [l.level, l.name]),
    [
      [1, "Sing-a-long"],
      [2, "Chords"],
      [3, "Scales & fills"],
      [4, "Melody"],
      [5, "Improv"],
    ]
  );
  assert.deepEqual(videosAt(data, 1), [
    { kind: "lesson", status: "ready", url: url("guitar-1-lesson") },
    // Published, but there's no playable link for it: the page says it can't play.
    { kind: "playthrough", status: "unavailable", url: null },
  ]);
  for (const level of [2, 3, 4, 5]) assert.deepEqual(videosAt(data, level), [], `level ${level}`);
});

test("nothing about another instrument's videos reaches a student", async () => {
  const own = await tutorials("guitar", "main");
  assert.deepEqual(Object.keys(own.data).sort(), ["instrument", "levels"]);
  assert.doesNotMatch(own.text, /bass/i);
  assert.doesNotMatch(own.text, /draft/);
  // The Bunny id isn't sent either, only that the video can't play.
  assert.doesNotMatch(own.text, /guid/);

  for (const query of ["?instrument=Bass", "?instrument=Bass&instrument=Guitar", "?instrument=Banjo"]) {
    const asked = await tutorials("guitar", "main", query);
    assert.equal(asked.status, 403, query);
    assert.equal(asked.data.reason, "instrument");
    assert.doesNotMatch(asked.text, /videos\.example\.test|levels/, query);
  }
  // Naming their own instrument is fine.
  assert.equal((await tutorials("guitar", "main", "?instrument=Guitar")).status, 200);
});

test("a Bass student sees the Bass videos and only those", async () => {
  const { status, data, text } = await tutorials("bass", "main");
  assert.equal(status, 200);
  assert.equal(data.instrument, "Bass");
  assert.deepEqual(videosAt(data, 1), [{ kind: "lesson", status: "ready", url: url("bass-1-lesson") }]);
  assert.deepEqual(videosAt(data, 3), [{ kind: "playthrough", status: "ready", url: url("bass-3-playthrough") }]);
  assert.deepEqual(videosAt(data, 4), [], "the level 4 draft stays hidden");
  assert.doesNotMatch(text, /guitar/i);
});

test("unpublished videos stay hidden, so a song with only drafts has nothing to show", async () => {
  for (const who of ["guitar", "admin"]) {
    const { status, data, text } = await tutorials(who, "drafts");
    assert.equal(status, 200, who);
    assert.ok(data.levels.every((l) => l.videos.length === 0), who);
    assert.doesNotMatch(text, /videos\.example\.test/, who);
  }
});

test("videos stay hidden until they're released", async () => {
  process.env.LESSON_VIDEOS_READY = "false";
  try {
    const { status, data, text } = await tutorials("guitar", "main");
    assert.equal(status, 200);
    assert.ok(data.levels.every((l) => l.videos.length === 0));
    assert.doesNotMatch(text, /videos\.example\.test/);
  } finally {
    process.env.LESSON_VIDEOS_READY = "true";
  }
});

test("the song's own checks apply: sign-in, membership, published, term", async () => {
  assert.equal((await tutorials(null, "main")).status, 401);
  assert.equal((await tutorials("unpaid", "main")).status, 402);
  assert.equal((await tutorials("guitar", "hidden")).status, 404);
  assert.equal((await call("guitar", "GET", "/songs/00000000-0000-0000-0000-000000000000/tutorials")).status, 404);

  const locked = await tutorials("termed", "termed");
  assert.equal(locked.status, 403);
  assert.equal(locked.data.reason, "locked");
  assert.equal(locked.data.error, "This song unlocks later in your term.");
  assert.doesNotMatch(locked.text, /videos\.example\.test|levels/);
  // The same song's stems are refused for the same reason.
  assert.equal((await call("termed", "GET", `/songs/${songs.termed.id}/tracks`)).data.reason, "locked");
  // A term song is shut to students outside the term too, and open to staff.
  assert.equal((await tutorials("guitar", "termed")).data.reason, "not_in_term");
  assert.equal(videosAt((await tutorials("teacher", "termed", "?instrument=Guitar")).data, 1).length, 1);
});

test("staff can look at any instrument's tutorials as its students see them", async () => {
  const bass = await tutorials("teacher", "main", "?instrument=Bass");
  assert.equal(bass.status, 200);
  assert.equal(bass.data.instrument, "Bass");
  assert.deepEqual(bass.data, (await tutorials("bass", "main")).data);
  assert.doesNotMatch(bass.text, /draft/);

  // A teacher with no instrument of their own sees none until they pick one.
  const own = await tutorials("teacher", "main");
  assert.equal(own.data.instrument, null);
  assert.ok(own.data.levels.every((l) => l.videos.length === 0));

  assert.equal((await tutorials("teacher", "main", "?instrument=Banjo")).status, 400);
  assert.deepEqual((await tutorials("admin", "main")).data, (await tutorials("guitar", "main")).data);
});

test("a student with no instrument gets the five levels and no videos", async () => {
  const { status, data } = await tutorials("none", "main");
  assert.equal(status, 200);
  assert.equal(data.instrument, null);
  assert.equal(data.levels.length, 5);
  assert.ok(data.levels.every((l) => l.videos.length === 0));
  assert.equal((await tutorials("none", "main", "?instrument=Guitar")).status, 403);
});

test("an instrument typed into settings by hand still matches", async () => {
  const typed = await prisma.user.update({ where: { id: users.none.id }, data: { instrument: " guitar " } });
  tokens.typed = signMobileToken(typed, "10m");
  const { data } = await tutorials("typed", "main");
  assert.equal(data.instrument, "Guitar");
  assert.equal(videosAt(data, 1)[0].url, url("guitar-1-lesson"));
  await prisma.user.update({ where: { id: users.none.id }, data: { instrument: null } });
});

test("a lesson's videos and a song's tutorials stay apart", async () => {
  const song = await tutorials("guitar", "main");
  assert.doesNotMatch(song.text, /lesson-guitar/);
  const own = await call("guitar", "GET", `/lessons/${lesson.id}`);
  assert.equal(own.status, 200);
  assert.equal(own.data.lesson.videoUrl, url("lesson-guitar"));
  assert.doesNotMatch(own.text, new RegExp(`${RUN}/guitar-1-lesson`));
});

test("admins fill and clear a song's video slots, and students see the change straight away", async () => {
  const path = `/admin/songs/${songs.main.id}/videos`;
  const slot = { instrument: "Guitar", level: 3, kind: "lesson", provider: "direct" };

  const created = await call("admin", "PUT", path, { ...slot, videoId: url("guitar-3-first") });
  assert.equal(created.status, 200);
  assert.equal(created.data.video.songId, songs.main.id);
  assert.equal(created.data.video.lessonId, null);
  assert.deepEqual(videosAt((await tutorials("guitar", "main")).data, 3), [{ kind: "lesson", status: "ready", url: url("guitar-3-first") }]);

  const replaced = await call("admin", "PUT", path, { ...slot, videoId: url("guitar-3-second") });
  assert.equal(replaced.data.video.id, created.data.video.id, "same slot, same row");

  // Giving a draft a new id keeps it a draft; it's only published when that's asked for.
  const draft = { instrument: "Guitar", level: 2, kind: "lesson", provider: "direct" };
  assert.equal((await call("admin", "PUT", path, { ...draft, videoId: url("guitar-2-draft-v2") })).data.video.published, false);
  assert.deepEqual(videosAt((await tutorials("guitar", "main")).data, 2), []);
  assert.equal((await call("admin", "PUT", path, { ...draft, videoId: url("guitar-2-draft"), published: false })).status, 200);

  const listed = await call("admin", "GET", path);
  assert.equal(listed.status, 200);
  assert.ok(listed.data.videos.some((v) => v.videoId === url("guitar-2-draft")), "admins see drafts");

  assert.deepEqual((await call("admin", "PUT", path, { ...slot, videoId: "" })).data, { video: null });
  assert.deepEqual(videosAt((await tutorials("guitar", "main")).data, 3), []);
  // Clearing an empty slot is a no-op, not an error.
  assert.equal((await call("admin", "PUT", path, { ...slot, videoId: "" })).status, 200);

  assert.equal((await call("admin", "PUT", path, { ...slot, instrument: "Banjo", videoId: "x" })).status, 400);
  assert.equal((await call("admin", "PUT", `/admin/songs/00000000-0000-0000-0000-000000000000/videos`, { ...slot, videoId: "x" })).status, 404);
  for (const who of ["teacher", "guitar"]) {
    assert.equal((await call(who, "PUT", path, { ...slot, videoId: url("not-allowed") })).status, 403, who);
    assert.equal((await call(who, "GET", path)).status, 403, who);
  }
});

test("a video belongs to exactly one lesson or one song", async () => {
  const data = { instrument: "Guitar", level: 5, kind: "lesson", provider: "direct", videoId: url("owner-check") };
  await assert.rejects(prisma.lessonVideo.create({ data: { ...data, lessonId: lesson.id, songId: songs.main.id } }));
  await assert.rejects(prisma.lessonVideo.create({ data }));
});
