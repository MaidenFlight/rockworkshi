// Instrument access (lib/instrumentAccess.js): a student hears and reads only their own instrument's
// part of a song they're entitled to, and nothing in a request widens that. Runs against the dev
// database in .env with throwaway @example.test accounts and songs, deleted afterwards. Audio lives in
// a temporary MEDIA_DIR made here, so R2 is never contacted: every file holds its own name, which lets
// the checks fetch the links handed out and see exactly what a student could download.
require("dotenv").config({ quiet: true });

const fs = require("fs");
const os = require("os");
const path = require("path");
const RUN = `instrument-test-${Date.now()}`;
const MEDIA = fs.mkdtempSync(path.join(os.tmpdir(), "rw-media-test-"));
process.env.MEDIA_DIR = MEDIA;
for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) delete process.env[key];
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;
process.env.LESSON_VIDEOS_READY = "true";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { signMobileToken } = require("../src/lib/mobileToken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { mediaLink, putMedia } = require("../src/lib/media");
const { sourcesOf, mixKey, WHOLE_SONG } = require("../src/lib/songMixes");
const { canonicalInstrument, validateMixer, chartFor } = require("../src/lib/instrumentAccess");

let server;
let base;
const users = {};
const tokens = {};
const songs = {};
let lesson;
let group;

const STEMS = ["Vocals", "Guitar", "Keys", "Bass", "Drums"];
// Each instrument's own stem and chart part in these songs. Ukulele has no stem in any of them.
const EXPECT = {
  Guitar: { stem: "Guitar", part: null },
  Piano: { stem: "Keys", part: null },
  Bass: { stem: "Bass", part: "Bass" },
  Drums: { stem: "Drums", part: "Drums" },
  Voice: { stem: "Vocals", part: "Vocals" },
  Ukulele: { stem: null, part: null },
};
const CHART = {
  end: 8,
  sections: [{ name: "Verse", bars: [{ time: 0, chords: [{ name: "C", time: 0 }] }, { time: 4, chords: [{ name: "G", time: 4 }] }] }],
  parts: {
    Bass: { draft: false, notes: [{ time: 0, len: 1, midi: 36 }] },
    Drums: { draft: false, hits: [{ time: 0, drum: "kick" }] },
    Vocals: { draft: true, notes: [{ time: 0, len: 2, midi: 64 }] },
  },
};

async function call(who, method, urlPath, body) {
  const res = await fetch(base + urlPath, {
    method,
    headers: {
      ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const tracks = (who, song, query = "") => call(who, "GET", `/songs/${songs[song].id}/tracks${query}`);

// What a link really serves: each test file holds its own name.
async function fetched(url) {
  const res = await fetch(url);
  return res.ok ? (await res.text()).trim() : res.status;
}

// Makes a song with these stems (files in MEDIA_DIR) and, unless mixes is false, every mix.
async function makeSong(key, { parts = STEMS, mixes = true, chart = CHART } = {}) {
  const song = await prisma.song.create({ data: { title: `${RUN} ${key}`, chart } });
  for (const part of parts) {
    const storageKey = `songs/${song.id}/${part.toLowerCase()}.mp3`;
    await putMedia(storageKey, Buffer.from(`STEM ${part}`), "audio/mpeg");
    await prisma.songTrack.create({ data: { songId: song.id, part, storageKey } });
  }
  if (mixes) {
    const withTracks = await prisma.song.findUnique({ where: { id: song.id }, include: { tracks: true } });
    const sources = sourcesOf(withTracks.tracks);
    for (const without of [...parts, WHOLE_SONG]) {
      const storageKey = mixKey(song.id, sources, without);
      await putMedia(storageKey, Buffer.from(`MIX without ${without || "nothing"}`), "audio/mpeg");
      await prisma.songMix.create({ data: { songId: song.id, without, storageKey, gain: 0.5, sources } });
    }
  }
  return song;
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  // Local links point at this test server.
  process.env.API_PUBLIC_URL = base;

  const make = (name, data = {}) =>
    prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name, paidAt: new Date(), ...data } });
  for (const instrument of Object.keys(EXPECT)) users[instrument] = await make(instrument.toLowerCase(), { instrument });
  users.none = await make("none", { instrument: null });
  users.kazoo = await make("kazoo", { instrument: "Kazoo" }); // left over from a free-text field
  users.lower = await make("lower", { instrument: " guitar " });
  users.switcher = await make("switcher", { instrument: "Guitar" }); // the admin changes this one's instrument
  users.unpaid = await make("unpaid", { instrument: "Guitar", paidAt: null });
  users.lapsed = await make("lapsed", { instrument: "Guitar", paidAt: null });
  await prisma.payment.create({ data: { userId: users.lapsed.id, plan: "Monthly", amountCents: 5500 } });
  users.prospect = await make("prospect", { instrument: "Guitar", paidAt: null }); // signing up: may still choose
  users.outsider = await make("outsider", { instrument: "Guitar" });
  users.retained = await make("retained", { instrument: "Drums" });
  users.assigned = await make("assigned", { instrument: "Bass" });
  users.teacher = await make("teacher", { instrument: "Guitar", role: "teacher", paidAt: null });
  users.admin = await make("admin", { instrument: "Piano", paidAt: null });
  for (const [key, user] of Object.entries(users)) tokens[key] = signMobileToken(user, "10m");

  songs.open = await makeSong("open"); // in no term: every paying member
  songs.unmixed = await makeSong("unmixed", { mixes: false }); // backing bands not made yet
  songs.noKeys = await makeSong("noKeys", { parts: ["Vocals", "Guitar", "Bass", "Drums"], chart: { end: CHART.end, sections: CHART.sections, parts: { Bass: CHART.parts.Bass } } });
  songs.term = await makeSong("term");

  // A term whose month 1 is open: `retained` reached it before leaving, `assigned` gets it from a teacher.
  group = await prisma.termGroup.create({
    data: {
      name: `${RUN} term`,
      startsAt: new Date("2026-01-01T10:00:00.000Z"),
      endsAt: new Date("2026-04-01T09:59:59.999Z"),
      slots: { create: [{ month: 1, unlockAt: new Date("2026-01-01T10:00:00.000Z"), songId: songs.term.id, published: true }, { month: 2, unlockAt: new Date("2026-02-01T10:00:00.000Z") }, { month: 3, unlockAt: new Date("2026-03-01T10:00:00.000Z") }] },
    },
  });
  await prisma.termGrant.create({ data: { userId: users.retained.id, songId: songs.term.id, groupId: group.id } });
  await prisma.teacherStudent.createMany({
    data: [users.assigned, users.none, users.Guitar].map((s) => ({ teacherId: users.teacher.id, studentId: s.id })),
  });

  lesson = await prisma.lesson.create({
    data: {
      title: `${RUN} lesson`,
      videos: { create: Object.keys(EXPECT).map((instrument) => ({ instrument, level: 1, kind: "lesson", provider: "direct", videoId: `https://example.test/${instrument}.mp4` })) },
    },
  });
});

after(async () => {
  await prisma.contactMessage.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.auditEvent.deleteMany({ where: { targetId: { in: Object.values(users).map((u) => u.id) } } });
  await prisma.termGroup.deleteMany({ where: { name: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.lesson.deleteMany({ where: { title: { startsWith: RUN } } });
  fs.rmSync(MEDIA, { recursive: true, force: true });
  await prisma.$disconnect();
  server.close();
});

test("each instrument gets its own stem, one backing band and its own chart, nothing else", async () => {
  for (const [instrument, want] of Object.entries(EXPECT)) {
    const { status, data } = await tracks(instrument, "open");
    assert.equal(status, 200, instrument);
    assert.equal(data.scope, "instrument");
    assert.equal(data.instrument, instrument);

    const roles = data.tracks.map((t) => `${t.role}:${t.part}`);
    assert.deepEqual(roles, want.stem ? [`own:${want.stem}`, "backing:Backing"] : ["backing:Backing"], `${instrument} tracks`);
    assert.deepEqual(data.available, { own: Boolean(want.stem), backing: true, chart: true }, `${instrument} available`);
    // The bytes behind the links: their stem, and the band without it (or the whole song).
    const served = await Promise.all(data.tracks.map((t) => fetched(t.url)));
    assert.deepEqual(served, want.stem ? [`STEM ${want.stem}`, `MIX without ${want.stem}`] : ["MIX without nothing"], `${instrument} files`);
    assert.equal(data.tracks.find((t) => t.role === "backing").makeup, 2, "the mix comes back up to the stems' level");

    // No other stem or backing band appears anywhere in what they were sent.
    const sent = JSON.stringify(data);
    for (const other of STEMS.filter((p) => p !== want.stem)) {
      assert.ok(!sent.includes(`/${other.toLowerCase()}.mp3`), `${instrument} was sent the ${other} stem`);
      if (want.stem) assert.ok(!sent.includes(`without-${other.toLowerCase()}`), `${instrument} was sent the band without ${other}`);
    }

    // The shared form and chords, and only their own transcription.
    assert.deepEqual(data.chart.sections, CHART.sections);
    assert.deepEqual(Object.keys(data.chart.parts || {}), want.part ? [want.part] : [], `${instrument} chart parts`);
    if (want.part) assert.deepEqual(data.chart.parts[want.part], CHART.parts[want.part]);
  }
});

test("staff keep every stem and every part, whatever their own profile says", async () => {
  for (const who of ["teacher", "admin"]) {
    const { status, data } = await tracks(who, "open");
    assert.equal(status, 200, who);
    assert.equal(data.scope, "all");
    assert.deepEqual(data.tracks.map((t) => t.part), STEMS);
    assert.deepEqual(data.chart, CHART);
  }
  const lib = (await call("teacher", "GET", "/library")).data;
  assert.deepEqual(lib.songs.find((s) => s.id === songs.open.id).parts, STEMS);
  assert.equal(lib.instrument, null);
});

test("nothing in a request widens what a student gets", async () => {
  const plain = (await tracks("Guitar", "open")).data;
  for (const query of ["?instrument=Bass", "?part=Drums", "?scope=all", "?instrument=Bass&part=Bass&role=teacher"]) {
    const { data } = await tracks("Guitar", "open", query);
    assert.deepEqual(data.tracks.map((t) => t.part), plain.tracks.map((t) => t.part), query);
    assert.deepEqual(data.chart, plain.chart, query);
  }
  // A body on a GET, and headers, are ignored the same way.
  const res = await fetch(`${base}/songs/${songs.open.id}/tracks`, {
    headers: { Authorization: `Bearer ${tokens.Guitar}`, "X-Instrument": "Bass", "X-Role": "admin" },
  });
  assert.deepEqual((await res.json()).tracks.map((t) => t.part), ["Guitar", "Backing"]);
  // "guitar" with spaces is still the guitar; "Kazoo" is no instrument at all.
  assert.deepEqual((await tracks("lower", "open")).data.tracks.map((t) => t.part), ["Guitar", "Backing"]);
  assert.equal(canonicalInstrument("vOiCe"), "Voice");
  assert.equal(canonicalInstrument("Guitar, piano"), null);
});

test("links can't be bent to another file, kept past their time, or forged", async () => {
  const own = (await tracks("Guitar", "open")).data.tracks[0].url;
  assert.equal(await fetched(own), "STEM Guitar");
  assert.equal(await fetched(own.replace("guitar.mp3", "bass.mp3")), 403, "another stem with the guitar's signature");
  const url = new URL(own);
  url.searchParams.set("exp", String(Number(url.searchParams.get("exp")) + 3600));
  assert.equal(await fetched(url.toString()), 403, "a later expiry under the old signature");
  url.searchParams.delete("sig");
  assert.equal(await fetched(url.toString()), 403, "no signature");
  const expired = await mediaLink(`songs/${songs.open.id}/guitar.mp3`, -5);
  assert.equal(await fetched(expired), 403, "expired");
  await assert.rejects(mediaLink("../.env", 60), /Not a storage key/);
  assert.equal(await fetched(`${base}/media/..%2F..%2F.env?exp=9999999999&sig=x`), 403);
});

test("a missing stem, chart or backing band shows as missing, never as someone else's", async () => {
  // No keys stem: the piano student gets the whole song as one track, and no stem at all.
  const piano = (await tracks("Piano", "noKeys")).data;
  assert.deepEqual(piano.tracks.map((t) => `${t.role}:${t.part}`), ["backing:Backing"]);
  assert.equal(await fetched(piano.tracks[0].url), "MIX without nothing");
  assert.equal(piano.available.own, false);
  // No drum or vocal transcription: the form and chords only, marked unavailable.
  for (const instrument of ["Drums", "Voice"]) {
    const data = (await tracks(instrument, "noKeys")).data;
    assert.equal(data.available.chart, false, instrument);
    assert.deepEqual(Object.keys(data.chart.parts || {}), [], `${instrument} got another part's chart`);
  }
  // Backing bands not made yet: their own stem only, never the other stems instead.
  const unmixed = (await tracks("Guitar", "unmixed")).data;
  assert.deepEqual(unmixed.tracks.map((t) => t.part), ["Guitar"]);
  assert.equal(unmixed.available.backing, false);
  const uke = (await tracks("Ukulele", "unmixed")).data;
  assert.deepEqual(uke.tracks, []);
  assert.deepEqual(uke.available, { own: false, backing: false, chart: true });

  // A replaced stem makes the old mixes stale: they stop being served until they're made again.
  const stem = await prisma.songTrack.findFirst({ where: { songId: songs.noKeys.id, part: "Drums" } });
  await prisma.songTrack.update({ where: { id: stem.id }, data: { storageKey: stem.storageKey } });
  const stale = (await tracks("Guitar", "noKeys")).data;
  assert.deepEqual(stale.tracks.map((t) => t.part), ["Guitar"]);
  assert.equal(stale.available.backing, false);
});

test("chartFor keeps the shared form and only the asked-for part", () => {
  assert.deepEqual(chartFor(CHART, "Guitar"), { chart: { end: 8, sections: CHART.sections }, available: true });
  assert.deepEqual(chartFor(CHART, "Bass").chart.parts, { Bass: CHART.parts.Bass });
  assert.deepEqual(chartFor({ end: 8, sections: CHART.sections }, "Drums"), { chart: { end: 8, sections: CHART.sections }, available: false });
  assert.deepEqual(chartFor(null, "Voice"), { chart: null, available: false });
});

test("no valid instrument: a clear refusal, and nothing instrument-specific", async () => {
  for (const who of ["none", "kazoo"]) {
    const { status, data } = await tracks(who, "open");
    assert.equal(status, 403, who);
    assert.equal(data.reason, "no_instrument");
    assert.equal(data.tracks, undefined);
    assert.equal(data.chart, undefined);
    const practice = (await call(who, "GET", `/songs/${songs.open.id}/practice`)).data;
    assert.deepEqual(practice.player, { scope: "instrument", instrument: null });
    assert.deepEqual((await call(who, "GET", "/library")).data.songs.find((s) => s.id === songs.open.id).parts, []);
    assert.equal((await call(who, "PUT", `/songs/${songs.open.id}/practice/session`, { session: { mixer: { master: 50, take: 50 } } })).status, 400);
  }
  const lessonView = (await call("none", "GET", `/lessons/${lesson.id}`)).data.lesson;
  assert.equal(lessonView.videoUrl, null, "no instrument, no lesson video");
  // Signed in and paid, so past onboarding even without an instrument: the member area explains it.
  assert.equal((await call("none", "GET", "/auth/me")).data.user.profileComplete, true);
});

test("membership, terms, kept months and assignments still decide the song; the instrument decides the part", async () => {
  assert.equal((await tracks("unpaid", "open")).status, 402);
  assert.equal((await tracks("lapsed", "open")).status, 402);
  const outside = await tracks("outsider", "term");
  assert.equal(outside.status, 403);
  assert.equal(outside.data.reason, "not_in_term");

  const kept = await tracks("retained", "term");
  assert.equal(kept.status, 200, "kept the month after leaving the term");
  assert.deepEqual(kept.data.tracks.map((t) => t.part), ["Drums", "Backing"]);

  // A teacher can only set work for the student's own instrument, and it opens only that part.
  const bad = await call("teacher", "POST", "/teacher/assignments", { studentId: users.assigned.id, songId: songs.term.id, instrument: "Guitar", level: 2, instruction: "Strum it." });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /studies Bass/);
  const none = await call("teacher", "POST", "/teacher/assignments", { studentId: users.none.id, songId: songs.term.id, instrument: "Guitar", level: 2, instruction: "Strum it." });
  assert.equal(none.status, 400);
  assert.equal((await tracks("assigned", "term")).status, 403, "not before it's assigned");
  const good = await call("teacher", "POST", "/teacher/assignments", { studentId: users.assigned.id, songId: songs.term.id, instrument: "Bass", level: 2, instruction: "Lock in with the kick." });
  assert.equal(good.status, 201);
  const assigned = await tracks("assigned", "term");
  assert.equal(assigned.status, 200);
  assert.deepEqual(assigned.data.tracks.map((t) => t.part), ["Bass", "Backing"]);
  assert.deepEqual(Object.keys(assigned.data.chart.parts), ["Bass"]);
});

test("lesson videos: a student's own instrument only; staff may preview others", async () => {
  const mine = (await call("Bass", "GET", `/lessons/${lesson.id}?instrument=Drums`)).data.lesson;
  assert.equal(mine.videoUrl, "https://example.test/Bass.mp4", "the query is ignored for students");
  assert.equal(mine.instrument, "Bass");
  const sent = JSON.stringify(mine);
  for (const other of Object.keys(EXPECT).filter((i) => i !== "Bass")) assert.ok(!sent.includes(`${other}.mp4`), `sent the ${other} video`);
  const list = (await call("Bass", "GET", "/lessons?instrument=Drums")).data.lessons.find((l) => l.id === lesson.id);
  assert.equal(list.videoUrl, "https://example.test/Bass.mp4");
  assert.equal((await call("teacher", "GET", `/lessons/${lesson.id}`)).data.lesson.videoUrl, "https://example.test/Guitar.mp4");
  assert.equal((await call("teacher", "GET", `/lessons/${lesson.id}?instrument=Drums`)).data.lesson.videoUrl, "https://example.test/Drums.mp4");
});

test("saved mixes and presets can't carry other instruments' controls", async () => {
  const songId = songs.open.id;
  const sneaky = {
    mode: "solo",
    focus: "Drums",
    master: 90,
    take: 80,
    takeMuted: false,
    stems: { Drums: { volume: 100, muted: false, soloed: true }, Bass: { volume: 10 }, Guitar: { volume: 70, muted: true, soloed: false }, Backing: { volume: 55 } },
    instrument: "Drums",
  };
  const preset = await call("Guitar", "PUT", `/songs/${songId}/mix-presets`, { name: "Sneaky", settings: { ...sneaky, stems: { ...sneaky.stems, Bass: { volume: 10, muted: false, soloed: false }, Backing: { volume: 55, muted: false, soloed: false } } } });
  assert.equal(preset.status, 201);
  const kept = preset.data.preset.settings;
  assert.deepEqual(Object.keys(kept.stems).sort(), ["Backing", "Guitar"]);
  assert.equal(kept.focus, "Guitar", "focus can only be their own part");
  assert.equal(kept.instrument, "Guitar", "the server's instrument, not the one sent");
  assert.equal(kept.stems.Guitar.muted, false);

  // "Only the backing band" is stored as the same thing said their way round: without their part.
  const flipped = validateMixer({ mode: "solo", focus: "Backing", master: 100, take: 100, stems: {} }, { staff: false, instrument: "Guitar" });
  assert.equal(flipped.settings.mode, "minus");
  assert.equal(flipped.settings.focus, "Guitar");

  const session = { position: 12, mixer: { ...sneaky, stems: { Drums: { volume: 100, muted: false, soloed: true }, Guitar: { volume: 70, muted: false, soloed: false }, Backing: { volume: 55, muted: false, soloed: false } } } };
  assert.equal((await call("Guitar", "PUT", `/songs/${songId}/practice/session`, { session })).status, 204);
  const saved = (await call("Guitar", "GET", `/songs/${songId}/practice`)).data.practice.session;
  assert.deepEqual(Object.keys(saved.mixer.stems).sort(), ["Backing", "Guitar"]);
  assert.equal(saved.mixer.instrument, "Guitar");

  // Settings saved before this existed, for every stem, are never restored for a student.
  await prisma.mixPreset.create({ data: { userId: users.Guitar.id, songId, name: "Old whole band", settings: { mode: "full", focus: null, master: 100, take: 100, takeMuted: false, stems: { Drums: { volume: 100, muted: false, soloed: true } }, effects: null } } });
  const names = (await call("Guitar", "GET", `/songs/${songId}/mix-presets`)).data.presets.map((p) => p.name);
  assert.deepEqual(names, ["Sneaky"]);
});

test("a student can't give themselves another instrument; signup still chooses one", async () => {
  const locked = await call("Guitar", "PATCH", "/auth/me", { instrument: "Bass" });
  assert.equal(locked.status, 403);
  assert.equal(locked.data.reason, "instrument_locked");
  assert.equal((await call("lapsed", "PATCH", "/auth/me", { instrument: "Bass" })).status, 403, "paid once: still enrolled");
  assert.equal((await call("Guitar", "PATCH", "/auth/me", { instrument: "Kazoo" })).status, 400);
  const sameAgain = await call("Guitar", "PATCH", "/auth/me", { instrument: "guitar", name: "Guitar (renamed)" });
  assert.equal(sameAgain.status, 200, "saving the rest of the form with the same instrument is fine");
  assert.equal(sameAgain.data.user.name, "Guitar (renamed)");
  // The student's own list of instruments they play is a description, not access.
  assert.equal((await call("Guitar", "PUT", "/me/profile", { profile: {}, instruments: [{ instrument: "Drums", primary: true }], availability: [] })).status, 200);
  assert.deepEqual((await tracks("Guitar", "open")).data.tracks.map((t) => t.part), ["Guitar", "Backing"]);
  assert.equal((await prisma.user.findUnique({ where: { id: users.Guitar.id } })).instrument, "Guitar");

  // Before enrolling, someone signing up can still change their mind, and only to one of the six.
  const choose = await call("prospect", "PATCH", "/auth/me", { instrument: "drums" });
  assert.equal(choose.status, 200);
  assert.equal(choose.data.user.instrument, "Drums");
  const signup = (body) => fetch(`${base}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "long enough pw", name: "Newcomer", ...body }) });
  assert.equal((await signup({ email: `${RUN}-new1@example.test`, instrument: "Kazoo" })).status, 400);
  const made = await signup({ email: `${RUN}-new2@example.test`, instrument: "ukulele" });
  assert.equal(made.status, 201);
  assert.equal((await made.json()).user.instrument, "Ukulele");
});

test("asking for a change leaves the school a note; only the admin changes it, and old mixes go", async () => {
  assert.equal((await call("switcher", "POST", "/me/instrument-request", { instrument: "Guitar" })).status, 400, "already theirs");
  assert.equal((await call("switcher", "POST", "/me/instrument-request", { instrument: "Kazoo" })).status, 400);
  assert.equal((await call("switcher", "POST", "/me/instrument-request", { instrument: "Bass", note: "I've switched to bass." })).status, 201);
  assert.equal((await call("switcher", "POST", "/me/instrument-request", { instrument: "Bass" })).status, 429, "one request at a time");
  const note = await prisma.contactMessage.findFirst({ where: { email: users.switcher.email, reason: "Instrument change" } });
  assert.equal(note.instrument, "Bass");
  assert.match(note.message, /from Guitar to Bass/);
  assert.equal((await prisma.user.findUnique({ where: { id: users.switcher.id } })).instrument, "Guitar", "asking changes nothing");

  // A Guitar preset and resume state, made before the change.
  const songId = songs.open.id;
  const guitarMix = { mode: "full", focus: "Guitar", master: 100, take: 100, takeMuted: false, stems: { Guitar: { volume: 30, muted: false, soloed: false }, Backing: { volume: 90, muted: false, soloed: false } } };
  assert.equal((await call("switcher", "PUT", `/songs/${songId}/mix-presets`, { name: "Quiet guitar", settings: guitarMix })).status, 201);
  assert.equal((await call("switcher", "PUT", `/songs/${songId}/practice/session`, { session: { position: 30, mixer: guitarMix } })).status, 204);

  const change = (who, instrument) => call(who, "PUT", `/admin/students/${users.switcher.id}/instrument`, { instrument });
  assert.equal((await change("teacher", "Bass")).status, 403);
  assert.equal((await change("switcher", "Bass")).status, 403);
  assert.equal((await change("admin", "Kazoo")).status, 400);
  const done = await change("admin", "bass");
  assert.equal(done.status, 200);
  assert.equal(done.data.student.instrument, "Bass");

  const now = (await tracks("switcher", "open")).data;
  assert.deepEqual(now.tracks.map((t) => t.part), ["Bass", "Backing"]);
  assert.equal(await fetched(now.tracks[1].url), "MIX without Bass");
  const practice = (await call("switcher", "GET", `/songs/${songId}/practice`)).data.practice.session;
  assert.equal(practice.position, 30, "where they were is kept");
  assert.equal(practice.mixer, undefined, "the guitar mixer isn't");
  assert.deepEqual((await call("switcher", "GET", `/songs/${songId}/mix-presets`)).data.presets, [], "nor the guitar preset");
  const audit = await prisma.auditEvent.findFirst({ where: { action: "instrument.set", targetId: users.switcher.id } });
  assert.deepEqual(audit.detail, { from: "Guitar", to: "Bass" });
});

test("signing out ends access; the next account gets only its own part", async () => {
  const passwordHash = await bcrypt.hash("fixture-password-1", 4);
  for (const [key, instrument] of [["cookieGuitar", "Guitar"], ["cookieDrums", "Drums"]]) {
    // Sign-in looks addresses up in lower case.
    users[key] = await prisma.user.create({ data: { email: `${RUN}-${key.toLowerCase()}@example.test`, passwordHash, name: key, instrument, paidAt: new Date(), emailVerifiedAt: new Date() } });
  }
  async function session(email) {
    const res = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "fixture-password-1" }) });
    assert.equal(res.status, 200);
    return res.headers.get("set-cookie").split(";")[0];
  }
  const get = (cookie, urlPath) => fetch(base + urlPath, { headers: { Cookie: cookie } });

  const first = await session(users.cookieGuitar.email);
  assert.deepEqual((await (await get(first, `/songs/${songs.open.id}/tracks`)).json()).tracks.map((t) => t.part), ["Guitar", "Backing"]);
  assert.equal((await fetch(`${base}/auth/logout`, { method: "POST", headers: { Cookie: first } })).status, 204);
  assert.equal((await get(first, `/songs/${songs.open.id}/tracks`)).status, 401, "the old session is gone");

  const second = await session(users.cookieDrums.email);
  const drums = await (await get(second, `/songs/${songs.open.id}/tracks`)).json();
  assert.deepEqual(drums.tracks.map((t) => t.part), ["Drums", "Backing"]);
  assert.deepEqual(Object.keys(drums.chart.parts), ["Drums"]);
});
