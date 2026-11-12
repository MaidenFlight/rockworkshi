// Notifications about live meetings: the in-site inbox, email (through the school's mailer) and
// browser push. Making a notification is idempotent: each one has a dedupeKey naming the event and the
// person, so a retried request or a reminder pass that runs twice finds the row that's already there.
// Delivery is a separate, retry-safe step: one NotificationDelivery row per channel is claimed before
// it's sent and marked when done, so a retry only picks up what didn't go.
const webpush = require("web-push");
const prisma = require("./prisma");
const { sendMail, notificationEmail } = require("./mailer");
const { isDemo } = require("./demoRules");
const { display } = require("./honolulu");
const { recipientsFor } = require("./meetings");

const CHANNELS = ["email", "push"];
const MAX_ATTEMPTS = 5;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000; // a claim older than this crashed mid-send; try it again
const GIVE_UP_AFTER_MS = 6 * 60 * 60 * 1000; // news this old isn't worth sending
// Each reminder goes out once it's due, and not after the next one is due (or two hours late, say
// after the server was down), so nobody gets a "24 hours" reminder 30 minutes before.
const REMINDERS = [
  { key: "24h", ms: 24 * 60 * 60 * 1000, label: "in 24 hours" },
  { key: "15m", ms: 15 * 60 * 1000, label: "in 15 minutes" },
];
const LATE_LIMIT_MS = 2 * 60 * 60 * 1000;

const siteUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function readyPush() {
  if (vapidReady) return;
  const contact = process.env.VAPID_SUBJECT || `mailto:${process.env.MAIL_REPLY_TO || "denny.landika@rockworksschoolofmusichawaii.com"}`;
  webpush.setVapidDetails(contact, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  vapidReady = true;
}

// "Ana", "Ana and Ben", "Ana, Ben and Cy".
function names(list) {
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

// The same news reads differently for the student and for a guardian.
function forWhom(recipient, studentLine, guardianLine) {
  return recipient.student ? studentLine : guardianLine(names(recipient.kids), recipient.kids.length > 1);
}

// Makes one notification per recipient of a meeting, once per event, with its delivery rows.
// Returns how many recipients there were.
// onlyFor (a set of student ids) limits it to those students and their guardians.
async function notifyMeeting(meeting, { kind, eventKey, title, body, onlyFor = null }) {
  let recipients = await recipientsFor(meeting.id);
  if (onlyFor) recipients = recipients.filter((r) => (r.student ? onlyFor.has(r.user.id) : r.kidIds.some((id) => onlyFor.has(id))));
  if (!recipients.length) return 0;
  const rows = recipients.map((r) => ({
    userId: r.user.id,
    dedupeKey: `${eventKey}:${r.user.id}`,
    kind,
    meetingId: meeting.id,
    title,
    body: body(r),
    url: "/meetings",
  }));
  await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  const made = await prisma.notification.findMany({ where: { dedupeKey: { in: rows.map((r) => r.dedupeKey) } }, select: { id: true } });
  await prisma.notificationDelivery.createMany({
    data: made.flatMap((n) => CHANNELS.map((channel) => ({ notificationId: n.id, channel }))),
    skipDuplicates: true,
  });
  return recipients.length;
}

const joinLine = "Join from the Meetings page on the Rock Works site when it starts.";

// meetings: every date of what was just scheduled, in order. One message covers a whole series.
function notifyScheduled(meetings, { onlyFor = null } = {}) {
  const [first] = meetings;
  const last = meetings.at(-1);
  const series = meetings.length > 1 ? `\nIt repeats monthly: ${meetings.length} dates, the last on ${display(last.startsAt)}.` : "";
  return notifyMeeting(first, {
    kind: "meeting.scheduled",
    eventKey: `meeting:${first.id}:scheduled`,
    onlyFor,
    title: `${first.title}: you're invited`,
    body: (r) =>
      forWhom(
        r,
        `You're invited to ${first.title} on ${display(first.startsAt)} (Hawaii time).${series}\n${joinLine}`,
        (kids, many) => `${kids} ${many ? "are" : "is"} invited to ${first.title} on ${display(first.startsAt)} (Hawaii time).${series}\nThey join from their Meetings page when it starts.`,
      ),
  });
}

// more: how many later dates of the series moved with it.
function notifyRescheduled(meeting, previousStart, { more = 0 } = {}) {
  const rest = more > 0 ? `
The ${more === 1 ? "next date" : `${more} later dates`} in the series moved to the same time of day.` : "";
  return notifyMeeting(meeting, {
    kind: "meeting.rescheduled",
    eventKey: `meeting:${meeting.id}:moved:${meeting.startsAt.toISOString()}`,
    title: `${meeting.title} has moved`,
    body: (r) =>
      forWhom(
        r,
        `${meeting.title} is now on ${display(meeting.startsAt)} (Hawaii time). It was ${display(previousStart)}.${rest}`,
        (kids) => `For ${kids}: ${meeting.title} is now on ${display(meeting.startsAt)} (Hawaii time). It was ${display(previousStart)}.${rest}`,
      ),
  });
}

// more: how many later dates of the series were cancelled with it.
function notifyCancelled(meeting, { more = 0 } = {}) {
  const rest = more > 0 ? `
${more === 1 ? "The next date" : `The ${more} later dates`} in the series ${more === 1 ? "is" : "are"} cancelled too.` : "";
  return notifyMeeting(meeting, {
    kind: "meeting.cancelled",
    eventKey: `meeting:${meeting.id}:cancelled`,
    title: `${meeting.title} is cancelled`,
    body: (r) =>
      forWhom(
        r,
        `${meeting.title} on ${display(meeting.startsAt)} (Hawaii time) won't happen.${rest}`,
        (kids) => `For ${kids}: ${meeting.title} on ${display(meeting.startsAt)} (Hawaii time) won't happen.${rest}`,
      ),
  });
}

function notifyStarted(meeting) {
  return notifyMeeting(meeting, {
    kind: "meeting.started",
    eventKey: `meeting:${meeting.id}:started:${meeting.startedAt.toISOString()}`,
    title: `${meeting.title} has started`,
    body: (r) =>
      forWhom(r, "Join now from the Meetings page.", (kids) => `For ${kids}: it's on now. They can join from their Meetings page.`),
  });
}

// Reminders 24 hours and 15 minutes before each scheduled meeting. Worked out from the meeting as it
// is now, so a moved meeting is reminded at its new time (the key holds the start), a cancelled one
// not at all, and a meeting set up or moved at short notice skips the reminders already past.
async function runReminders(now = new Date()) {
  const meetings = await prisma.meeting.findMany({
    where: { status: "scheduled", startsAt: { gt: now, lte: new Date(now.getTime() + REMINDERS[0].ms) } },
  });
  let sent = 0;
  for (const m of meetings) {
    for (const [i, r] of REMINDERS.entries()) {
      const due = m.startsAt.getTime() - r.ms;
      const nextDue = i + 1 < REMINDERS.length ? m.startsAt.getTime() - REMINDERS[i + 1].ms : m.startsAt.getTime();
      const t = now.getTime();
      if (t < due || t >= Math.min(nextDue, due + LATE_LIMIT_MS) || m.timeSetAt.getTime() > due) continue;
      const eventKey = `meeting:${m.id}:remind-${r.key}:${m.startsAt.toISOString()}`;
      if (await prisma.notification.findFirst({ where: { dedupeKey: { startsWith: `${eventKey}:` } }, select: { id: true } })) continue;
      sent += await notifyMeeting(m, {
        kind: "meeting.reminder",
        eventKey,
        title: `${m.title} starts ${r.label}`,
        body: (rc) =>
          forWhom(
            rc,
            `${display(m.startsAt)} (Hawaii time). ${joinLine}`,
            (kids) => `For ${kids}: ${display(m.startsAt)} (Hawaii time). They join from their Meetings page.`,
          ),
      });
    }
  }
  return sent;
}

// Whether news about a meeting still holds by the time it's sent.
function outOfDate(n, meeting, now) {
  if (!meeting) return "the meeting is gone";
  if (n.kind === "meeting.reminder" && (meeting.status !== "scheduled" || meeting.startsAt <= now || n.createdAt < meeting.timeSetAt)) {
    return "the meeting changed";
  }
  if (n.kind === "meeting.rescheduled" && (meeting.status === "cancelled" || n.createdAt < meeting.timeSetAt)) return "the meeting changed again";
  if (n.kind === "meeting.started" && meeting.status !== "live") return "the meeting is over";
  return "";
}

async function deliver(d, now) {
  const n = d.notification;
  if (now - n.createdAt > GIVE_UP_AFTER_MS) return { status: "skipped", error: "too old to send" };
  if (n.meetingId) {
    const meeting = await prisma.meeting.findUnique({ where: { id: n.meetingId } });
    const why = outOfDate(n, meeting, now);
    if (why) return { status: "skipped", error: why };
  }
  const pref = (await prisma.notificationPreference.findUnique({ where: { userId: n.userId } })) ?? { email: true, push: true };
  if (d.channel === "email") {
    if (!pref.email) return { status: "skipped", error: "email turned off" };
    if (!n.user.email || isDemo(n.user)) return { status: "skipped", error: "no email address" };
    const mail = notificationEmail({ title: n.title, body: n.body, url: n.url, siteUrl: siteUrl() });
    const result = await sendMail({ to: n.user.email, ...mail });
    return result.delivered ? { status: "sent" } : { status: "skipped", error: "not deliverable" };
  }
  if (!pref.push) return { status: "skipped", error: "push turned off" };
  if (!pushConfigured()) return { status: "skipped", error: "push isn't set up on the server" };
  const subs = await prisma.pushSubscription.findMany({ where: { userId: n.userId } });
  if (!subs.length) return { status: "skipped", error: "no browser has push turned on" };
  readyPush();
  const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url || "/notifications", tag: n.id });
  let delivered = 0;
  let lastError = null;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 });
      delivered++;
    } catch (err) {
      // Gone or unknown: the browser dropped this subscription, so forget it.
      if (err.statusCode === 404 || err.statusCode === 410) await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      else lastError = err;
    }
  }
  if (delivered) return { status: "sent" };
  if (lastError) throw lastError;
  return { status: "skipped", error: "every browser had dropped its subscription" };
}

// Sends what's waiting. Each row is claimed (pending -> sending) before it's sent, so two passes at
// once never send the same row; a failure goes back to pending until MAX_ATTEMPTS.
async function processDeliveries(now = new Date()) {
  await prisma.notificationDelivery.updateMany({
    where: { status: "sending", claimedAt: { lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
    data: { status: "pending" },
  });
  const waiting = await prisma.notificationDelivery.findMany({
    where: { status: "pending", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { notification: { include: { user: { select: { id: true, email: true, demoExpiresAt: true } } } } },
  });
  const counts = { sent: 0, skipped: 0, failed: 0, retry: 0 };
  for (const d of waiting) {
    const claim = await prisma.notificationDelivery.updateMany({
      where: { id: d.id, status: "pending" },
      data: { status: "sending", claimedAt: now, attempts: { increment: 1 } },
    });
    if (!claim.count) continue;
    let outcome;
    try {
      outcome = await deliver(d, now);
    } catch (err) {
      outcome = { status: d.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending", error: String(err.message || err).slice(0, 500) };
    }
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: outcome.status, error: outcome.error ?? null, sentAt: outcome.status === "sent" ? new Date() : null },
    });
    counts[outcome.status === "pending" ? "retry" : outcome.status]++;
  }
  return counts;
}

// One pass of the background work: due reminders, then anything waiting to send. Never two at once.
let running = null;
function tick(now = new Date()) {
  if (!running) {
    running = (async () => {
      try {
        await runReminders(now);
        return await processDeliveries(now);
      } finally {
        running = null;
      }
    })();
  }
  return running;
}

// After an admin's change: send now rather than at the next minute's pass. Errors only log.
function kick() {
  tick().catch((err) => console.error("Could not send notifications:", err.message));
}

module.exports = {
  REMINDERS,
  pushConfigured,
  notifyScheduled,
  notifyRescheduled,
  notifyCancelled,
  notifyStarted,
  runReminders,
  processDeliveries,
  tick,
  kick,
};
