// What a student demo account is and what it may do (lib/demo.js makes and deletes them). Kept free of
// other modules so the mailer, the audit log and sign-in can ask "is this the demo?" without pulling in
// the database code that builds one.

// .invalid is reserved (RFC 2606), so no mail can ever be delivered there, whatever else goes wrong.
const DEMO_DOMAIN = "student-demo.invalid";

// A where clause for real people only. Every staff list, count and export uses it.
const REAL = { demoExpiresAt: null };

// The instruments the Demo tab offers, for now (Denny, 2026-11-06). The other instruments' sample
// students are ready in lib/demo.js (STUDENTS); adding a name here offers it.
const DEMO_INSTRUMENTS = ["Guitar", "Bass", "Drums"];

const MESSAGES = {
  payment: "This is the student demo, so there's nothing to pay for or cancel, and no card is ever charged.",
  password: "This is the student demo, so it has no password to change.",
  email: "This is the student demo, so it doesn't send email.",
  school: "This is the student demo, so nothing is sent to the school. Leave the demo to contact us for real.",
};

function isDemo(user) {
  return Boolean(user?.demoExpiresAt);
}

function isDemoAddress(email) {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(`@${DEMO_DOMAIN}`);
}

// For anything that would reach past the sandbox: money, email, the school's inbox.
// Answers 403 with reason "demo", which the site shows as "nothing was sent".
function refuseDemo(kind) {
  return (req, res, next) => (isDemo(req.user) ? res.status(403).json({ error: MESSAGES[kind], reason: "demo" }) : next());
}

// Demo visitors hear the songs like a member: they only get in with the passcode an admin gave them,
// and their own part with the band is what the demo is for. The stems are a commercial recording that
// isn't licensed for public use (which is why the homepage's preview is silent), so DEMO_SONG_AUDIO=off
// gives demo visitors each song's chart without the recording.
function demoSongAudio() {
  return process.env.DEMO_SONG_AUDIO !== "off";
}

module.exports = { DEMO_DOMAIN, DEMO_INSTRUMENTS, REAL, isDemo, isDemoAddress, refuseDemo, demoSongAudio };
