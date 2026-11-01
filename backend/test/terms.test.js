// Term groups and the access policy in lib/termAccess.js. The server clock is pinned
// so unlocks can be checked just before, exactly at and just after their time.
// Runs against the dev database in .env with throwaway @example.test accounts and songs.
require("dotenv").config({ quiet: true });

const RUN = `term-test-${Date.now()}`;
process.env.ADMIN_EMAIL = `${RUN}-admin@example.test`;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const clock = require("../src/lib/clock");
const { isR2Configured } = require("../src/lib/r2");

let server;
let base;
const users = {};
const tokens = {};
const songs = {};
let lesson;
let groupA;
let groupB;

// Month 1 opens at T1, month 2 at T2 (a month later). Fixed instants, independent of today.
const T1 = new Date("2031-03-01T10:00:00.000Z"); // 2031-03-01 00:00 HST
const T2 = new Date("2031-04-01T10:00:00.000Z");
const at = (date, ms = 0) => {
  clock.now = () => new Date(date.getTime() + ms);
};

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

const tracks = (who, song) => call(who, "GET", `/songs/${songs[song].id}/tracks`);

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;

  const make = (name, data = {}) =>
    prisma.user.create({ data: { email: `${RUN}-${name}@example.test`, passwordHash: "!", name, paidAt: new Date(), ...data } });
  users.admin = await make("admin");
  users.teacher = await make("teacher", { role: "teacher" });
  users.a1 = await make("a1"); // group A
  users.a2 = await make("a2"); // group A, never opens anything before the checks that use it
  users.a3 = await make("a3"); // group A, removed from it later
  users.a4 = await make("a4"); // joins group A late
  // The clock is pinned and moved around between tests, and grants record what was open at
  // the pinned time. Checks that jump back before an unlock use students who never saw it.
  users.a5 = await make("a5"); // group A, only used at a late date
  users.a6 = await make("a6"); // group A, only used before anything opens
  users.b1 = await make("b1"); // group B
  users.loner = await make("loner"); // no group
  users.lapsed = await make("lapsed", { paidAt: null }); // group A, membership ended
  await prisma.payment.create({ data: { userId: users.lapsed.id, plan: "Term", amountCents: 13500 } });
  for (const [k, u] of Object.entries(users)) tokens[k] = jwt.sign({ sub: u.id }, process.env.JWT_SECRET, { expiresIn: "10m" });

  for (const key of ["x", "y", "free"]) {
    songs[key] = await prisma.song.create({
      data: { title: `${RUN} ${key}`, artist: "Test Band", tracks: { create: { part: "Drums", storageKey: `test/${RUN}/${key}.mp3` } } },
    });
  }
  lesson = await prisma.lesson.create({ data: { title: `${RUN} lesson` } });

  // Group A: month 1 = song x + lesson (published), month 2 = song y (published), month 3 empty.
  groupA = await prisma.termGroup.create({
    data: {
      name: `${RUN} A`,
      startsAt: T1,
      endsAt: new Date("2031-06-01T09:59:59.999Z"),
      slots: {
        create: [
          { month: 1, unlockAt: T1, songId: songs.x.id, lessonId: lesson.id, published: true },
          { month: 2, unlockAt: T2, songId: songs.y.id, published: true },
          { month: 3, unlockAt: new Date("2031-05-01T10:00:00.000Z") },
        ],
      },
      members: { create: [{ userId: users.a1.id }, { userId: users.a2.id }, { userId: users.a3.id }, { userId: users.a5.id }, { userId: users.a6.id }, { userId: users.lapsed.id }] },
    },
  });
  // Group B has song x in month 3, much later.
  groupB = await prisma.termGroup.create({
    data: {
      name: `${RUN} B`,
      startsAt: T1,
      endsAt: new Date("2031-06-01T09:59:59.999Z"),
      slots: {
        create: [
          { month: 1, unlockAt: T1 },
          { month: 2, unlockAt: T2 },
          { month: 3, unlockAt: new Date("2031-05-01T10:00:00.000Z"), songId: songs.x.id, published: true },
        ],
      },
      members: { create: [{ userId: users.b1.id }] },
    },
  });
});

after(async () => {
  clock.now = () => new Date();
  await prisma.termGroup.deleteMany({ where: { name: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.song.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.lesson.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.$disconnect();
  server.close();
});

test("a month opens exactly at its unlock time, by server clock", { skip: !isR2Configured() }, async () => {
  at(T1, -1);
  const early = await tracks("a1", "x");
  assert.equal(early.status, 403);
  assert.equal(early.data.reason, "locked");
  at(T1);
  assert.equal((await tracks("a1", "x")).status, 200, "exactly at unlock");
  at(T1, 1);
  const open = await tracks("a1", "x");
  assert.equal(open.status, 200);
  assert.match(open.data.tracks[0].url, /X-Amz-Expires=600/, "term links last 10 minutes, not an hour");
});

test("unpublished and unassigned months stay closed after their date", { skip: !isR2Configured() }, async () => {
  at(T1, 1000);
  // Straight in the database, as if it was never published: a2 hasn't reached it yet.
  await prisma.termSlot.update({ where: { groupId_month: { groupId: groupA.id, month: 1 } }, data: { published: false } });
  const draft = await tracks("a2", "x");
  assert.equal(draft.status, 403);
  assert.equal(draft.data.reason, "preparing");
  const term = (await call("a2", "GET", "/term")).data.term;
  assert.equal(term.slots[0].state, "preparing");
  assert.equal(term.slots[0].song, undefined, "no title before it's published");
  await prisma.termSlot.update({ where: { groupId_month: { groupId: groupA.id, month: 1 } }, data: { published: true } });

  at(new Date("2031-05-02T00:00:00.000Z"));
  const late = (await call("a5", "GET", "/term")).data.term;
  assert.equal(late.slots[2].state, "preparing", "month 3 has no song yet");
  assert.equal(late.currentMonth, 3);
});

test("earlier months stay open, later ones show only a date", { skip: !isR2Configured() }, async () => {
  at(T2, -1);
  assert.equal((await tracks("a1", "y")).status, 403, "month 2 not yet");
  const before = (await call("a1", "GET", "/term")).data.term;
  assert.equal(before.slots[1].state, "upcoming");
  assert.equal(before.slots[1].song, undefined, "no title for a future month");
  assert.equal(before.slots[1].unlockAtDisplay, "Tue, Apr 1, 2031, 12:00 AM HST");
  assert.equal(before.currentMonth, 1);

  at(T2, 1);
  assert.equal((await tracks("a1", "y")).status, 200);
  assert.equal((await tracks("a1", "x")).status, 200, "month 1 still open in month 2");
  const after = (await call("a1", "GET", "/term")).data.term;
  assert.deepEqual(
    after.slots.map((s) => s.state),
    ["available", "available", "upcoming"]
  );
  assert.equal(after.slots[0].song.id, songs.x.id);
});

test("groups don't share unlocks; other entitlements and plain songs still work", { skip: !isR2Configured() }, async () => {
  at(T2, 1);
  const b = await tracks("b1", "x");
  assert.equal(b.status, 403, "group B's month 3 hasn't opened");
  assert.equal(b.data.reason, "locked");
  assert.equal((await tracks("loner", "x")).data.reason, "not_in_term");
  assert.equal((await tracks("loner", "free")).status, 200, "songs in no term keep the old rule");
  assert.match((await tracks("loner", "free")).data.tracks[0].url, /X-Amz-Expires=3600/);

  // A teacher's assignment is its own entitlement, even where a slot opens later.
  await prisma.teacherStudent.createMany({
    data: [
      { teacherId: users.teacher.id, studentId: users.b1.id },
      { teacherId: users.teacher.id, studentId: users.loner.id },
    ],
  });
  for (const who of ["b1", "loner"]) {
    const created = await call("teacher", "POST", "/teacher/assignments", {
      studentId: users[who].id,
      songId: songs.x.id,
      instrument: "Drums",
      level: 1,
      instruction: "Play along with the drums.",
    });
    assert.equal(created.status, 201);
  }
  assert.equal((await tracks("b1", "x")).status, 200);
  assert.equal((await tracks("loner", "x")).status, 200);
  // Unlinking the teacher ends that entitlement again.
  await prisma.teacherStudent.deleteMany({ where: { teacherId: users.teacher.id } });
  assert.equal((await tracks("b1", "x")).status, 403);

  // Staff see everything.
  assert.equal((await tracks("teacher", "x")).status, 200);
  assert.equal((await tracks("admin", "y")).status, 200);
});

test("lessons and the library follow the same rules", async () => {
  at(T1, -1);
  const direct = await call("a2", "GET", `/lessons/${lesson.id}`);
  assert.equal(direct.status, 403);
  const list = (await call("a2", "GET", "/lessons")).data.lessons.find((l) => l.id === lesson.id);
  assert.equal(list.locked, true);
  assert.equal(list.videoUrl, null);
  assert.equal("videos" in list, false, "no raw video rows for a locked lesson");
  at(T1);
  assert.equal((await call("a2", "GET", `/lessons/${lesson.id}`)).status, 200);
  assert.equal((await call("b1", "GET", `/lessons/${lesson.id}`)).status, 403, "not in group B's term");

  const lib = (who) => call(who, "GET", "/library").then((r) => r.data.songs.find((s) => s.id === songs.x.id));
  assert.equal((await lib("a1")).locked, false);
  assert.equal((await lib("b1")).locked, true);
  assert.equal((await lib("loner")).locked, true, "no group and no assignment any more");
  const practice = await call("b1", "GET", `/songs/${songs.x.id}/practice`);
  assert.equal(practice.data.access.allowed, false);
  assert.equal(practice.status, 200, "notes and favourites still load for a locked song");
});

test("the student term view covers no group, lapsed membership and future terms", async () => {
  at(T1, -1000);
  const none = (await call("loner", "GET", "/term")).data;
  assert.equal(none.membership, "active");
  assert.deepEqual(none.term, { state: "none" });
  const upcoming = (await call("a6", "GET", "/term")).data.term;
  assert.equal(upcoming.state, "upcoming");
  assert.equal(upcoming.currentMonth, null);
  assert.ok(upcoming.slots.every((s) => s.state === "upcoming" && !s.song));

  const lapsed = (await call("lapsed", "GET", "/term")).data;
  assert.equal(lapsed.membership, "expired");
  assert.equal(lapsed.term.group.name, `${RUN} A`);
  assert.equal(lapsed.term.slots, undefined, "no song details without a membership");
  at(T2, 1);
  assert.equal((await tracks("lapsed", "x")).status, 402, "the paid check still applies");
});

test("staff create terms in Honolulu time and can't publish an empty month", async () => {
  at(new Date());
  assert.equal((await call("a1", "GET", "/admin/terms")).status, 403);
  assert.equal((await call("teacher", "POST", "/admin/terms", {})).status, 403);

  assert.equal((await call("admin", "POST", "/admin/terms", { name: "x", startDate: "2031-02-30", endDate: "2031-04-30" })).status, 400);
  const created = await call("admin", "POST", "/admin/terms", { name: `${RUN} C`, startDate: "2031-01-31", endDate: "2031-04-30" });
  assert.equal(created.status, 201);
  const g = created.data.group;
  assert.deepEqual(
    g.slots.map((s) => s.unlockAtLocal),
    ["2031-01-31T00:00", "2031-02-28T00:00", "2031-03-31T00:00"],
    "monthly defaults at Honolulu midnight, clamped to short months"
  );
  assert.equal(g.slots[0].unlockAt, "2031-01-31T10:00:00.000Z");
  assert.ok(g.slots.every((s) => !s.published && !s.song));

  const publishEmpty = await call("admin", "PUT", `/admin/terms/${g.id}/slots/2`, { published: true });
  assert.equal(publishEmpty.status, 400);
  assert.ok(publishEmpty.data.warnings.some((w) => w.blocking && /No song/.test(w.text)));

  const moved = await call("admin", "PUT", `/admin/terms/${g.id}/slots/2`, { unlockAtLocal: "2031-03-01T09:30", songId: songs.y.id });
  const slot2 = moved.data.group.slots[1];
  assert.equal(slot2.unlockAt, "2031-03-01T19:30:00.000Z");
  assert.equal(slot2.published, false, "still a draft");
  assert.equal((await call("admin", "PUT", `/admin/terms/${g.id}/slots/2`, { published: true })).status, 200);

  // The setup action finds the real CCR song by lookup and leaves month 1 in draft.
  const setup = await call("admin", "POST", `/admin/terms/${g.id}/setup-first-song`);
  if (setup.status === 200) {
    assert.match(setup.data.group.slots[0].song.title, /Have You Ever Seen the Rain/i);
    assert.equal(setup.data.group.slots[0].published, false);
  } else {
    assert.equal(setup.status, 409, "no CCR song in this database: refuses rather than inventing one");
  }

  const enrol = await call("admin", "POST", `/admin/terms/${g.id}/members`, { userIds: [users.loner.id, users.loner.id] });
  assert.equal(enrol.data.group.members.length, 1);
  assert.equal((await call("admin", "DELETE", `/admin/terms/${g.id}/members/${users.loner.id}`)).status, 204);
});

test("paying for a term plan doesn't put anyone in a group", async () => {
  const buyer = await prisma.user.create({
    data: { email: `${RUN}-buyer@example.test`, passwordHash: "!", plan: "Term", instrument: "Guitar", emailVerifiedAt: new Date() },
  });
  const token = jwt.sign({ sub: buyer.id }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const paid = await fetch(`${base}/billing/demo-pay`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (paid.status === 200) assert.ok((await prisma.user.findUnique({ where: { id: buyer.id } })).paidAt);
  assert.equal(await prisma.termEnrollment.count({ where: { userId: buyer.id } }), 0);
});

test("a song a student has reached stays theirs", { skip: !isR2Configured() }, async () => {
  at(T2, 1); // month 1 open, month 2 open for group A

  // Removed from the term without ever loading anything: staff removal records what was open.
  assert.equal((await call("admin", "DELETE", `/admin/terms/${groupA.id}/members/${users.a3.id}`)).status, 204);
  assert.equal((await tracks("a3", "x")).status, 200, "kept month 1 after leaving the term");
  assert.equal((await tracks("a3", "y")).status, 200, "kept month 2 too");

  // Staff unpublish month 1 after it opened: a1 (who had it) keeps it, a student who joins now doesn't get it.
  assert.equal((await tracks("a1", "x")).status, 200);
  assert.equal((await call("admin", "PUT", `/admin/terms/${groupA.id}/slots/1`, { published: false })).status, 200);
  assert.equal((await tracks("a1", "x")).status, 200, "unpublishing doesn't take it back");
  const keptView = (await call("a1", "GET", "/term")).data.term.slots[0];
  assert.equal(keptView.state, "available", "Your term still lists a song the student kept");
  assert.equal(keptView.song.id, songs.x.id);
  await prisma.termEnrollment.create({ data: { userId: users.a4.id, groupId: groupA.id } });
  const late = await tracks("a4", "x");
  assert.equal(late.status, 403, "a newcomer doesn't get an unpublished month");
  assert.equal(late.data.reason, "preparing");
  assert.equal((await call("admin", "PUT", `/admin/terms/${groupA.id}/slots/1`, { published: true })).status, 200);

  // After the term ends, nothing closes.
  at(new Date("2032-01-01T00:00:00.000Z"));
  assert.equal((await tracks("a1", "y")).status, 200);

  // Deleting a term keeps what its students reached; a month that hadn't opened isn't granted.
  at(T2, 1);
  const d = await prisma.termGroup.create({
    data: {
      name: `${RUN} D`,
      startsAt: T1,
      endsAt: new Date("2031-06-01T09:59:59.999Z"),
      slots: {
        create: [
          // Song x is also in terms A and B, so it stays restricted after D is deleted.
          { month: 1, unlockAt: T1, songId: songs.x.id, published: true },
          { month: 2, unlockAt: new Date("2031-05-01T10:00:00.000Z"), songId: songs.y.id, published: true },
          { month: 3, unlockAt: new Date("2031-05-15T10:00:00.000Z") },
        ],
      },
      members: { create: [{ userId: users.b1.id }] },
    },
  });
  // b1 never loads anything while in D, so only the deletion itself can record the grant.
  // Without it x would be locked for b1: its other term (B) hasn't reached x yet.
  assert.equal((await call("admin", "DELETE", `/admin/terms/${d.id}`)).status, 204);
  assert.equal((await tracks("b1", "x")).status, 200, "kept after the term was deleted");
  assert.equal((await tracks("b1", "y")).status, 403, "month 2 of that term never opened for b1");
});
