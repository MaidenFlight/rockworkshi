const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("../config/passport");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { issueFields, tokenMatches, canResend, verifiedFields } = require("../lib/verification");
const { verificationEmail } = require("../lib/mailer");

const router = express.Router();

const SALT_ROUNDS = 12;

// The link points at the app, which posts the token back here. Built from the
// origin the request came from so a link emailed to someone browsing over the
// LAN doesn't send them to localhost — which on a phone is the phone itself.
// Falls back to the configured URL when there's no Origin header.
function appOriginFor(req) {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, "");
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

function verificationLinkFor(req, token) {
  return `${appOriginFor(req)}/verify-email?token=${token}`;
}

async function sendVerificationLink(req, user, token) {
  try {
    await verificationEmail({ to: user.email, link: verificationLinkFor(req, token) });
  } catch (err) {
    // A send failure shouldn't abort signup — the account exists and the link
    // can be resent. Log it so it isn't silent.
    console.error("Could not send verification email:", err.message);
  }
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

function toSafeUser(user) {
  if (!user) return null;
  // Never leave the password hash or the verification token on a response.
  const { passwordHash, verificationTokenHash, ...safe } = user;
  const isAdmin = Boolean(ADMIN_EMAIL) && user.email === ADMIN_EMAIL;
  return {
    ...safe,
    isAdmin,
    emailVerified: Boolean(user.emailVerifiedAt),
    profileComplete: Boolean(user.instrument),
    // Admins run the school rather than enrol in it, so they're never held at
    // the payment step.
    paymentComplete: isAdmin || Boolean(user.paidAt),
  };
}

// Where a signed-in user still needs to go before the member area will work.
// The client-side route guard mirrors this, so the two can't disagree about
// what "finished signing up" means.
function nextStepFor(user) {
  const safe = toSafeUser(user);
  if (safe.isAdmin) return "/admin";
  if (!safe.emailVerified) return "/verify-email";
  if (!safe.profileComplete) return "/onboarding";
  if (!safe.paymentComplete) return "/onboarding/payment";
  return "/member";
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

const PROFILE_STRING_FIELDS = [
  "name",
  "age",
  "phone",
  "sponsorName",
  "sponsorEmail",
  "instrument",
  "experience",
  "level",
  "instructionType",
  "coStudentName",
  "plan",
];

function collectProfileFields(body) {
  const data = {};
  for (const key of PROFILE_STRING_FIELDS) {
    if (typeof body[key] === "string") data[key] = body[key].trim();
  }
  if (typeof body.isMinor === "boolean") data.isMinor = body.isMinor;
  return data;
}

router.post("/signup", async (req, res, next) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const { password } = req.body;
  const profile = collectProfileFields(req.body);

  if (!isEmailValid(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!password || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters." });
  }
  if (!profile.name) {
    return res.status(400).json({ error: "Student name is required." });
  }
  if (profile.isMinor && (!profile.sponsorName || !profile.sponsorEmail)) {
    return res.status(400).json({ error: "A sponsor name and email are required for a minor." });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { token, data: verification } = issueFields();
    const user = await prisma.user.create({
      data: { email, passwordHash, ...profile, ...verification },
    });

    await sendVerificationLink(req, user, token);

    // Signed in straight away, but nextStepFor() holds them at the "check your
    // inbox" step until the address is confirmed.
    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(201).json({ user: toSafeUser(user) });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message || "Invalid credentials." });
    }
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({ user: toSafeUser(user) });
    });
  })(req, res, next);
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie("connect.sid");
      return res.status(204).end();
    });
  });
});

router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  return res.json({ user: toSafeUser(req.user) });
});

router.patch("/me", requireAuth, async (req, res, next) => {
  const data = collectProfileFields(req.body);

  try {
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    next(err);
  }
});

// Called by the app with the token from the emailed link. No auth requirement:
// the token is the proof, so it works from whichever browser opened the email,
// signed in or not. Always 200s with an outcome — the token's validity isn't an
// HTTP-level error, and it keeps the client from guessing from status codes.
router.post("/verify-email", async (req, res, next) => {
  const token = String(req.body?.token || "");
  const done = (status) => res.json({ status });

  if (!token) return done("invalid");

  try {
    // Can't look the token up directly — only its hash is stored — so find the
    // candidates with a live token and compare.
    const candidates = await prisma.user.findMany({
      where: { verificationTokenHash: { not: null } },
      select: { id: true, verificationTokenHash: true, verificationExpiresAt: true, emailVerifiedAt: true },
    });
    const match = candidates.find((u) => tokenMatches(token, u.verificationTokenHash));

    if (!match) return done("invalid");
    if (match.emailVerifiedAt) return done("already");
    if (match.verificationExpiresAt && match.verificationExpiresAt < new Date()) {
      return done("expired");
    }

    await prisma.user.update({ where: { id: match.id }, data: verifiedFields() });
    return done("success");
  } catch (err) {
    next(err);
  }
});

// Re-issues a token for the signed-in account. Rate limited so it can't be used
// to flood an inbox.
router.post("/resend-verification", requireAuth, async (req, res, next) => {
  try {
    if (req.user.emailVerifiedAt) {
      return res.json({ alreadyVerified: true });
    }
    if (!canResend(req.user)) {
      return res.status(429).json({ error: "Please wait a moment before requesting another email." });
    }

    const { token, data } = issueFields();
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    await sendVerificationLink(req, user, token);

    return res.json({ sent: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
