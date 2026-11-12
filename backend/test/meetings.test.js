// Live meetings and their notifications: who can schedule, start and join; Hawaii-time monthly dates;
// invitations to a class and to students by name; one message per guardian; reminders that follow a
// moved or cancelled meeting; and delivery that never sends the same thing twice. Runs against the
// database in .env with throwaway @example.test accounts.
require("dotenv").config({ quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { signMobileToken } = require("../src/lib/mobileToken");
const { seriesStarts } = require("../src/lib/meetings");
const notify = require("../src/lib/notify");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const RUN = `meet-test-${Date.now()}`;
let server;
let base;
const users = {};
const tokens = {};
let classId;

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

async function makeUser(name, data = {}, roles = []) {
  users[name] = await prisma.user.create({
    data: { email: `${RUN}-${name}@example.test`, passwordHash: "!no-login", name: `${name} ${RUN}`, paidAt: new Date(), ...data },
  });
  for (const role of roles) await prisma.userRole.create({ data: { userId: users[name].id, role } });
  // No email in these tests: the mail itself is the mailer's business, and this keeps them offline.
  await prisma.notificationPreference.create({ data: { userId: users[name].id, email: false } });
  tokens[name] = signMobileToken(users[name], "10m");
}

// "YYYY-MM-DDTHH:mm" in Hawaii time, some days from now.
function hawaii(daysAhead, time = "18:00") {
  const d = new Date(Date.now() + daysAhead * 86400000 - 10 * 3600000);
  return `${d.toISOString().slice(0, 10)}T${time}`;
}

const inbox = (who) => prisma.notification.findMany({ where: { userId: users[who].id }, orderBy: { createdAt: "asc" } });

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
  await makeUser("admin", {}, ["admin"]);
  await makeUser("teacher", { role: "teacher" }, ["teacher"]);
  await makeUser("ana");
  await makeUser("ben");
  await makeUser("cy"); // waitlisted
  await makeUser("dee"); // not invited
  await makeUser("parent", {}, ["guardian"]);
  const cls = await prisma.class.create({
    data: {
      teacherId: users.teacher.id,
      kind: "group",
      title: `${RUN} Sing-along class`,
      timeZone: "Pacific/Honolulu",
      firstDate: "2026-12-01",
      startMinute: 960,
      durationMinutes: 60,
    },
  });
  classId = cls.id;
  await prisma.classEnrollment.createMany({
    data: [
      { classId, userId: users.ana.id },
      { classId, userId: users.ben.id },
      { classId, userId: users.cy.id, status: "waitlisted" },
    ],
  });
  // One guardian of two invited children.
  for (const kid of ["ana", "ben"]) {
    await prisma.guardianLink.create({
      data: { studentId: users[kid].id, guardianId: users.parent.id, email: users.parent.email, acceptedAt: new Date() },
    });
  }
});

after(async () => {
  await prisma.meeting.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.class.deleteMany({ where: { id: classId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  server.close();
});

test("monthly dates are Hawaii wall-clock times and clamp to the month's end", () => {
  const starts = seriesStarts("2027-01-31T18:00", "monthly", "2027-04-30");
  assert.deepEqual(
    starts.map((d) => d.toISOString()),
    ["2027-02-01T04:00:00.000Z", "2027-03-01T04:00:00.000Z", "2027-04-01T04:00:00.000Z", "2027-05-01T04:00:00.000Z"],
  );
  assert.equal(seriesStarts("2027-01-15T09:00", "monthly", "2030-01-01").length, 12, "a series stops at a year");
});

test("only admins schedule, and the invitation reaches students and each guardian once", async () => {
  const body = { title: `${RUN} Sing-along`, start: hawaii(10), durationMinutes: 60, repeat: "monthly", repeatUntil: hawaii(75).slice(0, 10), classId };
  assert.equal((await call("teacher", "POST", "/admin/meetings", body)).status, 403);
  assert.equal((await call("ana", "GET", "/admin/meetings")).status, 403);
  assert.equal((await call(null, "GET", "/meetings")).status, 401);

  const made = await call("admin", "POST", "/admin/meetings", body);
  assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.equal(made.data.meetings.length, 3);
  assert.equal(made.data.invited, 2, "enrolled students only, not the waitlist");
  assert.match(made.data.meetings[0].when, /HST$/);

  const [anaNote] = await inbox("ana");
  assert.equal(anaNote.kind, "meeting.scheduled");
  assert.match(anaNote.body, /You're invited/);
  assert.match(anaNote.body, /3 dates/);
  const parentNotes = await inbox("parent");
  assert.equal(parentNotes.length, 1, "one message for a guardian of two invited children");
  assert.match(parentNotes[0].body, /and/);
  assert.equal((await inbox("cy")).length, 0);
  assert.equal((await inbox("dee")).length, 0);

  // Each notification has an email and a push row, made once.
  assert.equal(await prisma.notificationDelivery.count({ where: { notificationId: anaNote.id } }), 2);
});

test("students see their meetings; Join opens only when it starts, only for the invited", async () => {
  const meeting = await prisma.meeting.findFirst({ where: { title: `${RUN} Sing-along` }, orderBy: { startsAt: "asc" } });
  const list = await call("ana", "GET", "/meetings");
  const mine = list.data.meetings.find((m) => m.id === meeting.id);
  assert.ok(mine);
  assert.equal(mine.canJoin, false);
  assert.equal((await call("ana", "POST", `/meetings/${meeting.id}/pass`)).status, 409, "not started yet");

  const guardianView = await call("parent", "GET", "/meetings");
  assert.deepEqual(guardianView.data.meetings.find((m) => m.id === meeting.id).forKids.length, 2);

  const started = await call("admin", "POST", `/admin/meetings/${meeting.id}/start`);
  assert.equal(started.status, 200);
  assert.equal(started.data.meeting.status, "live");

  const pass = await call("ana", "POST", `/meetings/${meeting.id}/pass`);
  assert.equal(pass.status, 200, JSON.stringify(pass.data));
  assert.equal(pass.data.identity, `kid-${users.ana.id}`);
  const claims = JSON.parse(Buffer.from(pass.data.token.split(".")[1], "base64url").toString());
  assert.equal(claims.video.room, `meeting-${meeting.id}`);
  assert.equal(claims.video.canUpdateOwnMetadata, false, "a student can't pose as the mixer");

  assert.equal((await call("dee", "POST", `/meetings/${meeting.id}/pass`)).status, 403);
  assert.equal((await call("parent", "POST", `/meetings/${meeting.id}/pass`)).status, 403, "guardians are told, students join");
  assert.equal((await call("teacher", "POST", `/admin/meetings/${meeting.id}/pass`)).status, 403);

  const host = await call("admin", "POST", `/admin/meetings/${meeting.id}/pass`);
  assert.equal(host.data.identity, "host");
  assert.ok((await inbox("ana")).some((n) => n.kind === "meeting.started"));

  assert.equal((await call("admin", "POST", `/admin/meetings/${meeting.id}/end`)).status, 200);
  assert.equal((await call("ana", "POST", `/meetings/${meeting.id}/pass`)).status, 409, "over");
});

test("reminders: 24 hours and 15 minutes before, once each, following moves and cancellations", async () => {
  const made = await call("admin", "POST", "/admin/meetings", { title: `${RUN} Reminded`, start: hawaii(3), durationMinutes: 45, studentIds: [users.dee.id] });
  const id = made.data.meetings[0].id;
  const m = await prisma.meeting.findUnique({ where: { id } });
  const reminders = () => prisma.notification.findMany({ where: { meetingId: id, kind: "meeting.reminder", userId: users.dee.id } });

  const dayBefore = new Date(m.startsAt.getTime() - 24 * 3600000 + 60000);
  await notify.runReminders(new Date(dayBefore.getTime() - 120000));
  assert.equal((await reminders()).length, 0, "not due yet");
  await notify.runReminders(dayBefore);
  await notify.runReminders(dayBefore);
  assert.equal((await reminders()).length, 1, "once, however many passes run");
  assert.match((await reminders())[0].title, /24 hours/);

  // Moved a day later: the next reminders follow the new time.
  const moved = await call("admin", "PATCH", `/admin/meetings/${id}`, { start: hawaii(4) });
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  const rescheduled = await prisma.notification.findFirst({ where: { meetingId: id, kind: "meeting.rescheduled", userId: users.dee.id } });
  assert.match(rescheduled.body, /It was/);
  const m2 = await prisma.meeting.findUnique({ where: { id } });
  await notify.runReminders(new Date(m2.startsAt.getTime() - 15 * 60000 + 30000));
  const after = await reminders();
  assert.equal(after.length, 2);
  assert.match(after[1].title, /15 minutes/);
  assert.ok(after[1].dedupeKey.includes(m2.startsAt.toISOString()));

  // The 24-hour reminder made before the move is now out of date and won't be sent.
  const stale = await prisma.notificationDelivery.findMany({ where: { notificationId: after[0].id } });
  await notify.processDeliveries(new Date());
  for (const d of await prisma.notificationDelivery.findMany({ where: { id: { in: stale.map((s) => s.id) } } })) {
    assert.equal(d.status, "skipped");
  }

  // Cancelled: no more reminders.
  const another = await call("admin", "POST", "/admin/meetings", { title: `${RUN} Cancelled`, start: hawaii(5), durationMinutes: 30, studentIds: [users.dee.id] });
  const cid = another.data.meetings[0].id;
  assert.equal((await call("admin", "POST", `/admin/meetings/${cid}/cancel`, {})).status, 200);
  const c = await prisma.meeting.findUnique({ where: { id: cid } });
  await notify.runReminders(new Date(c.startsAt.getTime() - 24 * 3600000 + 1000));
  assert.equal(await prisma.notification.count({ where: { meetingId: cid, kind: "meeting.reminder" } }), 0);
  assert.equal(await prisma.notification.count({ where: { meetingId: cid, kind: "meeting.cancelled", userId: users.dee.id } }), 1);
  assert.equal((await call("dee", "GET", "/meetings")).data.meetings.some((x) => x.id === cid), false);

  // Set up at short notice (under 24 hours away): the 24-hour reminder is skipped.
  const soon = await call("admin", "POST", "/admin/meetings", { title: `${RUN} Soon`, start: hawaii(0.5, "23:59").replace(/T.*/, "T23:59"), durationMinutes: 30, studentIds: [users.dee.id] });
  if (soon.status === 201) {
    const s = await prisma.meeting.findUnique({ where: { id: soon.data.meetings[0].id } });
    if (s.startsAt - Date.now() < 24 * 3600000) {
      await notify.runReminders(new Date(Math.max(Date.now(), s.startsAt.getTime() - 24 * 3600000 + 1000)));
      assert.equal(await prisma.notification.count({ where: { meetingId: s.id, kind: "meeting.reminder", title: { contains: "24 hours" } } }), 0);
    }
  }
});

test("delivery: two passes at once send each message once, preferences are respected, failures retry", async () => {
  await prisma.notificationPreference.update({ where: { userId: users.dee.id }, data: { email: false, push: true } });
  const made = await call("admin", "POST", "/admin/meetings", { title: `${RUN} Delivery`, start: hawaii(20), durationMinutes: 30, studentIds: [users.dee.id] });
  const note = await prisma.notification.findFirst({ where: { meetingId: made.data.meetings[0].id, userId: users.dee.id } });
  const rows = () => prisma.notificationDelivery.findMany({ where: { notificationId: note.id }, orderBy: { channel: "asc" } });

  const [a, b] = await Promise.all([notify.processDeliveries(), notify.processDeliveries()]);
  const [email, push] = await rows();
  assert.equal(email.status, "skipped");
  assert.equal(email.error, "email turned off");
  assert.equal(email.attempts, 1, "claimed by one pass only");
  assert.equal(push.attempts, 1);
  assert.ok(a && b);

  // The same event again (a retried request): nothing new is made.
  const before = await prisma.notification.count({ where: { userId: users.dee.id } });
  await notify.notifyScheduled([await prisma.meeting.findUnique({ where: { id: made.data.meetings[0].id } })]);
  assert.equal(await prisma.notification.count({ where: { userId: users.dee.id } }), before);

  // A push that fails for a reason other than a dropped subscription goes back to wait.
  if (notify.pushConfigured()) {
    await prisma.pushSubscription.create({ data: { userId: users.dee.id, endpoint: `https://127.0.0.1:9/${RUN}`, p256dh: "BAD", auth: "BAD" } });
    await prisma.notificationDelivery.update({ where: { id: push.id }, data: { status: "pending", attempts: 0 } });
    await notify.processDeliveries();
    const retried = (await rows())[1];
    assert.equal(retried.status, "pending");
    assert.equal(retried.attempts, 1);
    assert.ok(retried.error);
  }
});

test("the inbox: list, unread count, mark read, preferences and push subscriptions are per person", async () => {
  const list = await call("ana", "GET", "/notifications");
  assert.ok(list.data.notifications.length >= 2);
  assert.equal(list.data.unread, list.data.notifications.filter((n) => !n.read).length);
  const first = list.data.notifications[0];
  assert.equal((await call("dee", "POST", `/notifications/${first.id}/read`)).status, 200);
  assert.equal((await call("ana", "GET", "/notifications")).data.notifications[0].read, false, "someone else can't mark it");
  await call("ana", "POST", `/notifications/${first.id}/read`);
  assert.equal((await call("ana", "GET", "/notifications")).data.notifications[0].read, true);
  assert.equal((await call("ana", "POST", "/notifications/read-all")).data.unread, 0);

  const prefs = await call("ana", "PUT", "/notifications/preferences", { email: true, push: false });
  assert.deepEqual(prefs.data, { email: true, push: false });
  assert.equal((await call("ana", "POST", "/notifications/push", { endpoint: "http://insecure.example", keys: { p256dh: "x", auth: "y" } })).status, 400);
  const endpoint = `https://push.example.test/${RUN}`;
  assert.equal((await call("ana", "POST", "/notifications/push", { endpoint, keys: { p256dh: "x", auth: "y" } })).status, 201);
  assert.equal((await call("ana", "GET", "/notifications/preferences")).data.pushBrowsers, 1);
  await call("ben", "DELETE", "/notifications/push", { endpoint });
  assert.equal((await call("ana", "GET", "/notifications/preferences")).data.pushBrowsers, 1, "only the owner can remove it");
  await call("ana", "DELETE", "/notifications/push", { endpoint });
  assert.equal((await call("ana", "GET", "/notifications/preferences")).data.pushBrowsers, 0);
});
