// The student demo (lib/demo.js): the passcode an admin sets, choosing an instrument, the sample
// student's data, what a demo account may and may not do, staying out of the school's lists, and being
// thrown away. Runs against the dev database in .env. Demo households are deleted as the tests go, the
// staff accounts it makes are throwaway @example.test rows, and any passcode already set is put back.
// The last test closes the demo, which ends every demo running in that database.
require("dotenv").config({ quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { signMobileToken } = require("../src/lib/mobileToken");
const { passwordChangedEmail } = require("../src/lib/mailer");
const { DEMO_DOMAIN } = require("../src/lib/demoRules");
const { STUDENTS, endDemo, sweepDemos, startDemo } = require("../src/lib/demo");

const RUN = `demo-test-${Date.now()}`;
const PASSCODE = `alohafriday${Date.now()}`;
let server;
let savedAccess; // the passcode that was set before the tests, if any
let base;
const staff = {};
let kai; // { cookie, user } for the demo the tests share
const started = []; // every demo student made here, so only those are cleared afterwards

async function call(auth, method, path, body) {
  const headers = { ...(body ? { "Content-Type": "application/json" } : {}) };
  if (auth?.cookie) headers.Cookie = auth.cookie;
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null), res };
}

// Starts a demo the way the Demo tab does, keeping the session cookie for later calls.
async function tryDemo(cookie, passcode = PASSCODE, instrument = "Guitar") {
  const r = await call(cookie ? { cookie } : null, "POST", "/auth/demo", { passcode, instrument });
  const set = r.res.headers.getSetCookie().find((c) => c.startsWith("connect.sid="));
  if (r.data?.user) started.push(r.data.user);
  return { status: r.status, user: r.data?.user, cookie: set ? set.split(";")[0] : cookie, setCookie: set };
}

const demoUsers = () => prisma.user.findMany({ where: { demoExpiresAt: { not: null } }, select: { id: true } });
// The song this demo practises, read from its own practice row: other test files add songs to the same
// database while these tests run, so "the first song with a guitar part" can change underneath them.
const demoSong = async (user) => (await prisma.songPractice.findFirst({ where: { userId: user.id }, include: { song: true } }))?.song ?? null;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  for (const [name, role] of [["admin", "admin"], ["teacher", "teacher"]]) {
    staff[name] = await prisma.user.create({
      data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name: `${name} ${RUN}`, role: role === "teacher" ? "teacher" : "student", roles: { create: { role } } },
    });
    staff[name].token = signMobileToken(staff[name], "10m");
  }
  savedAccess = await prisma.demoAccess.findUnique({ where: { id: 1 } });
  await prisma.demoAccess.deleteMany({});
});

after(async () => {
  for (const u of started) await endDemo({ ...u, demoExpiresAt: new Date() });
  await prisma.demoAccess.deleteMany({});
  if (savedAccess) await prisma.demoAccess.create({ data: savedAccess });
  await prisma.class.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.auditEvent.deleteMany({ where: { actorId: { in: Object.values(staff).map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  server.close();
});

test("the demo is closed until an admin sets its passcode, and only the right passcode opens it", async () => {
  assert.equal((await call(null, "GET", "/auth/demo")).data.open, false);
  assert.equal((await call(null, "POST", "/auth/demo/check", { passcode: "anything at all" })).status, 403);
  const closed = await tryDemo(null, "anything at all");
  assert.equal(closed.status, 403);
  assert.equal(closed.user, undefined);

  const admin = { token: staff.admin.token };
  assert.equal((await call(null, "PUT", "/admin/demo", { passcode: PASSCODE })).status, 401);
  assert.equal((await call({ token: staff.teacher.token }, "PUT", "/admin/demo", { passcode: PASSCODE })).status, 403, "teachers can't set it");
  assert.equal((await call(admin, "PUT", "/admin/demo", { passcode: "short" })).status, 400);
  // Capitals and spaces don't count, so this is the same passcode.
  const set = await call(admin, "PUT", "/admin/demo", { passcode: `Aloha Friday ${PASSCODE.slice(11)}` });
  assert.equal(set.status, 200);
  assert.equal(set.data.open, true);
  const stored = await prisma.demoAccess.findUnique({ where: { id: 1 } });
  assert.ok(!stored.passcodeHash.includes(PASSCODE), "stored as a hash");
  assert.equal(stored.setBy, staff.admin.id);
  const status = (await call(null, "GET", "/auth/demo")).data;
  assert.equal(status.open, true);
  assert.equal(Object.keys(status).sort().join(), "instruments,open,song", "visitors learn nothing else");
  assert.deepEqual(status.instruments, ["Guitar", "Bass", "Drums"], "the instruments the demo offers for now");

  assert.equal((await call(null, "POST", "/auth/demo/check", { passcode: "not-the-passcode" })).status, 401);
  assert.equal((await call(null, "POST", "/auth/demo/check", { passcode: PASSCODE })).status, 204);
  assert.equal((await call(null, "POST", "/auth/demo/check", { passcode: ` ALOHAFRIDAY${PASSCODE.slice(11)} ` })).status, 204);
  assert.equal(await prisma.user.count({ where: { demoExpiresAt: { not: null }, createdAt: { gte: new Date(Date.now() - 60000) } } }), 0, "checking makes nothing");

  const wrong = await tryDemo(null, "not-the-passcode");
  assert.equal(wrong.status, 401);
  assert.equal(wrong.user, undefined);
  assert.equal((await tryDemo(null, "")).status, 401);
  assert.equal((await tryDemo(null, PASSCODE, "Kazoo")).status, 400);
  const piano = await tryDemo(null, PASSCODE, "Piano");
  assert.equal(piano.status, 400, "a real instrument the demo doesn't offer yet");
  assert.equal(piano.user, undefined);
  kai = await tryDemo();
  assert.equal(kai.status, 201);
  assert.equal((await call(admin, "GET", "/admin/demo")).data.live >= 1, true);
});

test("Try student demo signs in a sample guitar student, with a cookie that ends with the demo", async () => {
  assert.equal(kai.status, 201);
  assert.equal(kai.user.isDemo, true);
  assert.equal(kai.user.name, "Kai Tanaka");
  assert.equal(kai.user.instrument, "Guitar");
  assert.equal(kai.user.paymentComplete, true);
  assert.ok(kai.user.email.endsWith(`@${DEMO_DOMAIN}`));
  assert.equal(kai.user.passwordHash, undefined);
  const expires = Date.parse(/Expires=([^;]+)/.exec(kai.setCookie)[1]);
  assert.ok(Math.abs(expires - Date.parse(kai.user.demoExpiresAt)) < 2000, "the cookie runs out with the demo");
  assert.ok(expires - Date.now() < 3 * 60 * 60 * 1000, "a couple of hours, not the usual week");

  const row = await prisma.session.findFirst({ where: { data: { contains: kai.user.id } } });
  assert.ok(row && Math.abs(row.expiresAt - Date.parse(kai.user.demoExpiresAt)) < 2000, "the stored session ends with the demo too");

  const me = await call(kai, "GET", "/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.user.isDemo, true);
});

test("pressing it again in the same browser carries on with the same demo", async () => {
  const again = await tryDemo(kai.cookie);
  assert.equal(again.status, 200);
  assert.equal(again.user.id, kai.user.id);
});

test("the demo looks like an active student's account", async () => {
  const work = await call(kai, "GET", "/assignments");
  assert.equal(work.status, 200);
  // A month of weekly work on the song: two weeks done, the third under way, the fourth ahead.
  const tasks = [...work.data.assignments].sort((a, b) => a.position - b.position);
  assert.ok(tasks.length >= 12, "a month of tasks");
  assert.ok(tasks.every((a) => a.song && !a.lesson), "only the song: the demo leaves lesson videos out");
  assert.ok(tasks.every((a) => a.month && a.week), "all of it in the month");
  assert.equal(new Set(tasks.map((a) => a.month.id)).size, 1, "the one month");
  const week = (n, kind) => tasks.filter((a) => a.week === n && a.kind === kind);
  const statuses = (n, kind) => week(n, kind).map((a) => a.status);
  assert.ok(statuses(1, "checkpoint").every((s) => s === "saved"));
  assert.deepEqual(statuses(1, "assessment"), ["reviewed"]);
  assert.ok(statuses(2, "checkpoint").every((s) => s === "saved"));
  assert.deepEqual(statuses(2, "assessment"), ["reviewed"]);
  assert.equal(statuses(3, "checkpoint")[0], "saved", "week 3 is under way");
  assert.ok(statuses(3, "checkpoint").slice(1).every((s) => s === "assigned"));
  assert.deepEqual(statuses(3, "assessment"), ["assigned"]);
  assert.ok(tasks.filter((a) => a.week === 4).every((a) => a.status === "assigned"), "week 4 is ahead");
  assert.equal(week(1, "assessment")[0].attempts, 2, "one assessment was sent twice");
  assert.equal(week(1, "checkpoint")[1].attempts, 2, "and one checkpoint");
  assert.equal(week(4, "assessment")[0].media, "video", "the show at the end is filmed");
  assert.equal(week(3, "assessment")[0].support, "chart");
  assert.ok(week(1, "checkpoint").every((a) => /^Sing along/.test(a.section)), "the month starts as a sing-along");
  assert.equal(work.data.canFilm, true);
  assert.ok(tasks.every((a) => a.submissions.every((s) => new Date(s.createdAt) <= new Date())), "nothing dated in the future");
  assert.ok(tasks.every((a) => a.submissions.every((s) => s.recording === null)), "nobody really played it, so there are no recordings");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Honolulu" });
  const daysIn = Math.round((Date.parse(today) - Date.parse(tasks[0].month.startsOn)) / 86400000);
  assert.ok(daysIn >= 14 && daysIn < 21, "today is in the third week");
  const reviewed = week(2, "assessment")[0];
  assert.ok(reviewed.submissions[0].feedback.length > 20);
  assert.equal(reviewed.teacher.name, "Brian Albus");
  // The assessments carry a mark on every criterion, priorities, and a note inside what the task covers.
  for (const task of [week(1, "assessment")[0], reviewed]) {
    const replies = (await call(kai, "GET", `/assignments/${task.id}`)).data.assignment.submissions;
    for (const reply of replies) {
      assert.equal(reply.marks.length, task.criteria.length, `${task.section} is marked on each criterion`);
      assert.ok(reply.priorities.length >= 1 && reply.priorities.length <= 2 && reply.priorities.every((p) => p.length <= 120));
    }
    const notes = replies.flatMap((s) => s.notes);
    assert.ok(notes.length > 0, `${task.section} has a note on a moment`);
    assert.ok(notes.every((n) => n.at >= task.sectionStart && n.at < task.sectionEnd && n.text.length > 10), `${task.section}'s notes are inside it`);
  }
  assert.ok(work.data.priorities[tasks[0].month.id].list.length >= 1, "what to work on next comes from the latest reply");

  const from = new Date();
  const to = new Date(from.getTime() + 21 * 86400000);
  const calendar = await call(kai, "GET", `/calendar?from=${from.toISOString()}&to=${to.toISOString()}`);
  assert.equal(calendar.status, 200);
  const upcoming = calendar.data.events.filter((e) => e.as === "learning" && e.status === "scheduled");
  assert.equal(upcoming.length, 1, "just one lesson coming up");
  assert.equal(upcoming[0].title, "Group lesson");
  assert.equal(upcoming[0].kind, "group");
  assert.equal(upcoming[0].teacher.name, "Brian Albus");
  assert.equal(new Date(upcoming[0].startsAt).toLocaleDateString("en-US", { weekday: "long", timeZone: "Pacific/Honolulu" }), "Saturday");
  assert.equal(upcoming[0].meetingUrl, null, "in person, so no meeting link to follow");

  const profile = await call(kai, "GET", "/me/profile");
  assert.equal(profile.status, 200);
  assert.equal(profile.data.instruments[0].instrument, "Guitar");
  assert.ok(profile.data.profile.goals);

  assert.equal((await call(kai, "GET", "/lessons")).status, 200, "a paid member's lesson videos");
  const library = await call(kai, "GET", "/library");
  assert.equal(library.status, 200);
  const song = await demoSong(kai.user);
  if (song) {
    assert.equal(library.data.continue?.song.id, song.id, "pick up where they left off");
    assert.ok(library.data.songs.find((s) => s.id === song.id).favorite);
  }
});

test("payments, password changes, email and messages to the school are refused, and nothing is stored", async () => {
  for (const path of ["/billing/checkout-session", "/billing/confirm", "/billing/cancel", "/billing/resume", "/billing/demo-pay"]) {
    const r = await call(kai, "POST", path, { sessionId: "cs_test_x" });
    assert.equal(r.status, 403, path);
    assert.equal(r.data.reason, "demo", path);
  }
  assert.equal((await call(kai, "POST", "/auth/change-password", { currentPassword: "x", newPassword: "long-enough-1" })).data.reason, "demo");
  assert.equal((await call(kai, "POST", "/auth/resend-verification")).data.reason, "demo");

  const email = `${RUN}-trial@example.test`;
  const trial = await call(kai, "POST", "/trial", { studentName: "Kai", email });
  assert.equal(trial.status, 403);
  assert.equal(trial.data.reason, "demo");
  assert.equal(await prisma.trialRequest.count({ where: { email } }), 0, "no booking request reaches the school");
  const contact = await call(kai, "POST", "/contact", { name: "Kai", email, message: "Hello" });
  assert.equal(contact.status, 403);
  const request = await call(kai, "POST", "/me/instrument-request", { instrument: "Bass" });
  assert.equal(request.status, 403);
  assert.equal(await prisma.contactMessage.count({ where: { OR: [{ email }, { email: kai.user.email }] } }), 0, "nothing in Admin → Messages");
});

test("a demo student's month asks for a take, and only the demo's own teacher could see it", async () => {
  const { data } = await call(kai, "GET", "/assignments");
  const open = data.assignments.find((a) => a.status === "assigned");
  // An upload link where this machine has song storage; the demo isn't refused either way.
  const upload = await call(kai, "POST", `/assignments/${open.id}/recording-upload`, { size: 1000 });
  assert.ok([200, 503].includes(upload.status), `upload link: ${upload.status}`);

  const sent = await call(kai, "POST", `/assignments/${open.id}/submit`, {});
  assert.equal(sent.status, 400, "a task in a month needs a take");
  assert.equal((await call(kai, "GET", `/assignments/${open.id}`)).data.assignment.submissions.length, 0);
  const link = await prisma.teacherStudent.findFirst({ where: { studentId: kai.user.id }, include: { teacher: true } });
  assert.ok(link.teacher.demoExpiresAt, "the only teacher who could read it is the demo's own");
});

test("a demo student can use the student features on their own data", async () => {
  const renamed = await call(kai, "PATCH", "/auth/me", { name: "Kai T." });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.user.name, "Kai T.");
  const consent = await call(kai, "POST", "/me/consents", { purpose: "band-matching", granted: false });
  assert.equal(consent.status, 201);
  assert.equal(await prisma.auditEvent.count({ where: { actorId: kai.user.id } }), 0, "a demo's clicks aren't the school's record");
  const song = await demoSong(kai.user);
  if (song) {
    assert.equal((await call(kai, "PUT", `/songs/${song.id}/notes`, { notes: "Trying the demo" })).status, 200);
    assert.equal((await call(kai, "PUT", `/songs/${song.id}/favorite`, { favorite: false })).status, 200);
  }
});

test("the demo plays every stem with its student's own chart, or just the chart with DEMO_SONG_AUDIO=off", async () => {
  const song = await demoSong(kai.user);
  if (!song) return;
  const stems = (await prisma.songTrack.findMany({ where: { songId: song.id }, select: { part: true } })).map((t) => t.part);
  const before = process.env.DEMO_SONG_AUDIO;
  try {
    delete process.env.DEMO_SONG_AUDIO;
    const loud = await call(kai, "GET", `/songs/${song.id}/tracks`);
    // 503 only where this machine has no song storage set up; the demo answers like any member either way.
    assert.ok([200, 503].includes(loud.status));
    if (loud.status === 200) {
      assert.equal(loud.data.scope, "all", "the full mixer");
      assert.deepEqual(loud.data.tracks.map((t) => t.part).sort(), [...stems].sort(), "every stem on its own");
      assert.ok(loud.data.tracks.every((t) => t.url));
      assert.equal(loud.data.instrument, "Guitar");
      assert.equal(loud.data.myPart, "Guitar");
      assert.equal(loud.data.chart?.parts, undefined, "a guitar student's chart: the chords, no other part's transcription");
      assert.equal(loud.data.demo, undefined);
    }

    process.env.DEMO_SONG_AUDIO = "off";
    const silent = await call(kai, "GET", `/songs/${song.id}/tracks`);
    assert.equal(silent.status, 200);
    assert.deepEqual(silent.data.tracks, []);
    assert.equal(silent.data.demo.audio, false);
    assert.equal(silent.data.instrument, "Guitar");
    assert.equal(Boolean(silent.data.chart), Boolean(song.chart));
  } finally {
    if (before === undefined) delete process.env.DEMO_SONG_AUDIO;
    else process.env.DEMO_SONG_AUDIO = before;
  }
});

test("the demo's saved mix covers every stem, and a visitor can save one for any part", async () => {
  const song = await demoSong(kai.user);
  if (!song) return;
  const stems = (await prisma.songTrack.findMany({ where: { songId: song.id }, select: { part: true } })).map((t) => t.part);
  if (!stems.includes("Guitar")) return;
  const { data } = await call(kai, "GET", `/songs/${song.id}/mix-presets`);
  const seeded = data.presets.find((p) => p.name === "Guitar up front");
  assert.ok(seeded, "the demo comes with a saved mix");
  assert.deepEqual(Object.keys(seeded.settings.stems).sort(), [...stems].sort());
  assert.equal(seeded.settings.stems.Guitar.volume, 100);

  const other = stems.find((p) => p !== "Guitar");
  if (!other) return;
  const settings = {
    stems: Object.fromEntries(stems.map((p) => [p, { volume: 80, muted: p === "Guitar", soloed: false }])),
    master: 90,
    take: 80,
    mode: "solo",
    focus: other,
  };
  const saved = await call(kai, "PUT", `/songs/${song.id}/mix-presets`, { name: `Just the ${other}`, settings });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.preset.settings.focus, other, "any part, not only their own");
  assert.equal(saved.data.preset.settings.stems.Guitar.muted, true, "mute and solo stay, as on the full mixer");
});

test("no one signs into a demo account with a password, or takes a reset or a phone token for one", async () => {
  for (const path of ["/auth/login", "/auth/mobile/login"]) {
    const r = await call(null, "POST", path, { email: kai.user.email, password: "!student-demo" });
    assert.equal(r.status, 401, path);
  }
  const forgot = await call(null, "POST", "/auth/forgot-password", { email: kai.user.email });
  assert.equal(forgot.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const stored = await prisma.user.findUnique({ where: { id: kai.user.id } });
  assert.equal(stored.resetTokenHash, null, "no reset link is made for a demo account");
  const token = signMobileToken(stored, "10m");
  assert.equal((await call({ token }, "GET", "/auth/me")).status, 401);

  const signup = await call(null, "POST", "/auth/signup", { email: `someone@${DEMO_DOMAIN}`, password: "long-enough-1", name: "Someone" });
  assert.equal(signup.status, 400);
  const mail = await passwordChangedEmail({ to: kai.user.email });
  assert.equal(mail.delivered, false, "the mailer won't send to a demo address");
});

test("staff never see demo accounts or their classes", async () => {
  const admin = { token: staff.admin.token };
  const students = await call(admin, "GET", "/admin/students?search=Kai&pageSize=100");
  assert.equal(students.status, 200);
  assert.ok(!students.data.students.some((s) => s.isDemo || s.email.endsWith(`@${DEMO_DOMAIN}`)));
  const people = await call(admin, "GET", "/admin/people");
  assert.ok(!people.data.people.some((p) => p.email.endsWith(`@${DEMO_DOMAIN}`)));
  const teaching = await call(admin, "GET", "/admin/teaching");
  assert.ok(![...teaching.data.teachers, ...teaching.data.people].some((p) => p.email.endsWith(`@${DEMO_DOMAIN}`)));
  const real = await prisma.class.create({
    data: { teacherId: staff.teacher.id, kind: "group", title: `${RUN} real class`, instruments: [], timeZone: "Pacific/Honolulu", firstDate: "2026-12-01", startMinute: 960, durationMinutes: 60 },
  });
  const classes = await call(admin, "GET", "/admin/classes");
  assert.ok(classes.data.classes.some((c) => c.id === real.id), "real classes are still listed");
  const demoClasses = await prisma.class.findMany({ where: { teacher: { demoExpiresAt: { not: null } } }, select: { id: true } });
  assert.ok(demoClasses.length > 0);
  assert.ok(!classes.data.classes.some((c) => demoClasses.some((d) => d.id === c.id)));
  const overview = await call(admin, "GET", "/admin/overview");
  assert.equal(overview.data.students, await prisma.user.count({ where: { demoExpiresAt: null } }));
  const csv = await fetch(`${base}/admin/students/export.csv`, { headers: { Authorization: `Bearer ${staff.admin.token}` } });
  assert.ok(!(await csv.text()).includes(DEMO_DOMAIN));

  const enrol = await call(admin, "POST", `/admin/classes/${demoClasses[0].id}/enrolments`, { userId: kai.user.id });
  assert.equal(enrol.status, 404, "a demo student can't be enrolled in anything");

  const roster = await call({ token: staff.teacher.token }, "GET", "/teacher/students");
  assert.equal(roster.status, 200);
  assert.equal(roster.data.students.length, 0, "a real teacher is never linked to a demo student");
});

test("leaving the demo deletes it, and the next visitor starts afresh", async () => {
  const other = await tryDemo();
  assert.equal(other.status, 201);
  assert.notEqual(other.user.id, kai.user.id, "every visitor gets their own");

  const out = await call(other, "POST", "/auth/logout");
  assert.equal(out.status, 204);
  assert.equal(await prisma.user.count({ where: { id: other.user.id } }), 0);
  const left = await prisma.user.count({ where: { email: { endsWith: other.user.email.split("+")[1] } } });
  assert.equal(left, 0, "the demo's teacher goes too");
  assert.equal((await call(other, "GET", "/auth/me")).status, 401);
});

test("a demo that has run out is signed out, then swept away with its classes", async () => {
  const stale = await tryDemo();
  await prisma.user.updateMany({ where: { email: { endsWith: stale.user.email.split("+")[1] } }, data: { demoExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call(stale, "GET", "/auth/me")).status, 401);

  const before = (await demoUsers()).length;
  const removed = await sweepDemos();
  assert.ok(removed >= 2);
  assert.equal((await demoUsers()).length, before - removed);
  assert.equal(await prisma.user.count({ where: { id: stale.user.id } }), 0);
  assert.equal(await prisma.class.count({ where: { teacherId: null, title: "Group lesson", createdAt: { gte: new Date(Date.now() - 86400000 * 11) } } }), 0, "no class left behind without its teacher");
});

test("building a demo only reads the school's songs and lessons, and never adds a term slot", async () => {
  // startDemo only reads content; it never adds songs, lessons or term slots.
  const [songs, lessons, slots] = await Promise.all([prisma.song.count(), prisma.lesson.count(), prisma.termSlot.count()]);
  const fresh = await startDemo();
  assert.equal(await prisma.song.count(), songs);
  assert.equal(await prisma.lesson.count(), lessons);
  assert.equal(await prisma.termSlot.count(), slots);
  await endDemo(fresh);
  assert.equal(await prisma.user.count({ where: { id: fresh.id } }), 0);
});

// All six are ready, though the Demo tab offers only some of them for now (DEMO_INSTRUMENTS).
test("every instrument gets its own student: their lessons, their part and their teacher's words", async () => {
  for (const instrument of Object.keys(STUDENTS)) {
    const user = await startDemo({ instrument });
    started.push(user);
    try {
      assert.equal(user.instrument, instrument);
      const [work, classes, practice, skills] = await Promise.all([
        prisma.assignment.findMany({ where: { studentId: user.id }, include: { submissions: true } }),
        prisma.class.findMany({ where: { enrolments: { some: { userId: user.id } } } }),
        prisma.songPractice.findMany({ where: { userId: user.id } }),
        prisma.instrumentSkill.findMany({ where: { userId: user.id } }),
      ]);
      assert.ok(work.length >= 2 && work.every((a) => a.songId), `${instrument}: a month of practice work on the song`);
      assert.ok(work.every((a) => a.instrument === instrument));
      assert.deepEqual(classes.map((c) => c.title), ["Group lesson"], `${instrument}: one group lesson`);
      assert.deepEqual(skills.map((s) => s.instrument), [instrument]);
      const words = [
        ...work.flatMap((a) => [a.instruction, ...a.submissions.map((s) => s.feedback)]),
        ...classes.flatMap((c) => [c.title, c.description]),
        ...practice.map((p) => p.notes),
      ].filter(Boolean);
      assert.ok(words.every((w) => !/[{}]|undefined|null/.test(w)), `${instrument}: every placeholder filled in`);
    } finally {
      await endDemo(user);
    }
  }
});

test("someone in a demo can switch instrument without the passcode, and the old demo goes", async () => {
  const guitar = await tryDemo();
  assert.equal(guitar.status, 201);
  const same = await call(guitar, "POST", "/auth/demo", { instrument: "Guitar" });
  assert.equal(same.status, 200);
  assert.equal(same.data.user.id, guitar.user.id, "the same instrument carries on");

  assert.equal((await call(guitar, "POST", "/auth/demo", { instrument: "Voice" })).status, 400, "not offered, even from inside a demo");
  assert.equal((await call(guitar, "GET", "/auth/me")).data.user.id, guitar.user.id, "and the guitar demo carries on");

  const drums = await tryDemo(guitar.cookie, undefined, "Drums");
  assert.equal(drums.status, 201);
  assert.equal(drums.user.instrument, "Drums");
  assert.notEqual(drums.user.id, guitar.user.id);
  assert.equal(await prisma.user.count({ where: { id: guitar.user.id } }), 0, "the guitar demo is gone");
  const me = await call(drums, "GET", "/auth/me");
  assert.equal(me.data.user.instrument, "Drums");
  const work = await call(drums, "GET", "/assignments");
  assert.ok(work.data.assignments.every((a) => a.instrument === "Drums"));
  await call(drums, "POST", "/auth/logout");
});

test("leaving the demo deletes the takes recorded in it", { skip: !process.env.TEST_R2 }, async () => {
  const { headObject } = require("../src/lib/r2");
  const visitor = await tryDemo();
  const open = (await call(visitor, "GET", "/assignments")).data.assignments.find((a) => a.status === "assigned" && a.media === "audio");
  const wav = Buffer.alloc(44 + 9600);
  wav.write("RIFF", 0);
  wav.write("WAVE", 8);
  const put = await fetch(`${base}/assignments/${open.id}/recording`, { method: "PUT", headers: { Cookie: visitor.cookie, "Content-Type": "audio/wav" }, body: wav });
  assert.equal(put.status, 201);
  const { key } = await put.json();
  assert.equal((await call(visitor, "POST", `/assignments/${open.id}/submit`, { recording: { key, offset: 0, duration: 0.1 } })).status, 201);
  assert.ok(await headObject(key), "stored while the demo runs");
  assert.equal((await call(visitor, "POST", "/auth/logout")).status, 204);
  assert.equal(await headObject(key), null, "gone with the demo");
});

test("changing the passcode keeps demos running; closing the demo ends them all", async () => {
  const admin = { token: staff.admin.token };
  const other = await tryDemo();
  assert.equal(other.status, 201);

  const changed = await call(admin, "PUT", "/admin/demo", { passcode: `${PASSCODE}-2` });
  assert.equal(changed.status, 200);
  assert.equal((await tryDemo(null, PASSCODE)).status, 401, "the old passcode stops working");
  assert.equal((await call(other, "GET", "/auth/me")).status, 200, "a demo already open carries on");

  const closed = await call(admin, "DELETE", "/admin/demo");
  assert.equal(closed.status, 200);
  assert.equal(closed.data.open, false);
  assert.ok(closed.data.ended >= 2, "every running demo ends");
  assert.equal((await call(other, "GET", "/auth/me")).status, 401);
  assert.equal((await call(kai, "GET", "/auth/me")).status, 401);
  assert.equal((await demoUsers()).length, 0);
  assert.equal((await tryDemo(null, `${PASSCODE}-2`)).status, 403);
  assert.ok(await prisma.auditEvent.count({ where: { actorId: staff.admin.id, action: { in: ["demo.passcode", "demo.close"] } } }) >= 2, "an admin's changes are recorded");
});
