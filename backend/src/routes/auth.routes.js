const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("../config/passport");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const {
  issueVerification,
  issueReset,
  tokenMatches,
  verifiedFields,
  clearedResetFields,
  cooledDown,
  isExpired,
} = require("../lib/emailTokens");
const {
  verificationEmail,
  passwordResetEmail,
  passwordChangedEmail,
} = require("../lib/mailer");

const router = express.Router();

const SALT_ROUNDS = 12;

// Use the request's origin for email links so they work when testing over the LAN.
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
    // Don't fail signup over this, the link can be resent.
    console.error("Could not send verification email:", err.message);
  }
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, verificationTokenHash, resetTokenHash, ...safe } = user;
  const isAdmin = Boolean(ADMIN_EMAIL) && user.email === ADMIN_EMAIL;
  return {
    ...safe,
    isAdmin,
    emailVerified: Boolean(user.emailVerifiedAt),
    profileComplete: Boolean(user.instrument),
    paymentComplete: isAdmin || Boolean(user.paidAt),
  };
}

// Next enrolment step for a signed-in user.
// Keep in sync with frontend/lib/auth/enrolment.js.
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
    const { token, data: verification } = issueVerification();
    const user = await prisma.user.create({
      data: { email, passwordHash, ...profile, ...verification },
    });

    await sendVerificationLink(req, user, token);

    // Signed in right away; nextStepFor() keeps them on /verify-email until confirmed.
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

// No auth needed, the token is the proof. Always returns 200 with a status string.
router.post("/verify-email", async (req, res, next) => {
  const token = String(req.body?.token || "");
  const done = (status) => res.json({ status });

  if (!token) return done("invalid");

  try {
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

router.post("/resend-verification", requireAuth, async (req, res, next) => {
  try {
    if (req.user.emailVerifiedAt) {
      return res.json({ alreadyVerified: true });
    }
    if (!cooledDown(req.user.verificationSentAt)) {
      return res.status(429).json({ error: "Please wait a moment before requesting another email." });
    }

    const { token, data } = issueVerification();
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    await sendVerificationLink(req, user, token);

    return res.json({ sent: true });
  } catch (err) {
    next(err);
  }
});

// Log out the user's other sessions after a password change.
// The user id appears in the serialized session data.
async function endOtherSessions(userId, keepSid) {
  try {
    await prisma.session.deleteMany({
      where: { data: { contains: userId }, sid: keepSid ? { not: keepSid } : undefined },
    });
  } catch (err) {
    console.error("Could not clear other sessions:", err.message);
  }
}

function passwordProblem(password) {
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

router.post("/change-password", requireAuth, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};

  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ error: problem });

  try {
    const ok = await bcrypt.compare(String(currentPassword || ""), req.user.passwordHash);
    if (!ok) return res.status(400).json({ error: "That isn't your current password." });

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash, ...clearedResetFields },
    });

    await endOtherSessions(req.user.id, req.sessionID);
    passwordChangedEmail({ to: req.user.email }).catch((err) =>
      console.error("Could not send password-changed email:", err.message)
    );

    return res.json({ changed: true });
  } catch (err) {
    next(err);
  }
});

// Same response whether or not the account exists, so this can't be used to
// look up emails. We respond before doing any extra work so timing doesn't
// give it away either.
router.post("/forgot-password", async (req, res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const sameAnswer = () => res.json({ sent: true });

  if (!isEmailValid(email)) return sameAnswer();

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (err) {
    return next(err);
  }

  sameAnswer();

  if (!user) return;
  if (!cooledDown(user.resetSentAt)) return;

  const { token, data } = issueReset();
  prisma.user
    .update({ where: { id: user.id }, data })
    .then(() =>
      passwordResetEmail({
        to: user.email,
        link: `${appOriginFor(req)}/reset-password?token=${token}`,
      })
    )
    .catch((err) => {
      console.error("Could not send password reset email:", err.message);
    });
});

router.post("/reset-password", async (req, res, next) => {
  const token = String(req.body?.token || "");
  const { newPassword } = req.body || {};

  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ error: problem });
  if (!token) return res.status(400).json({ error: "That reset link is not valid." });

  try {
    const candidates = await prisma.user.findMany({
      where: { resetTokenHash: { not: null } },
      select: { id: true, email: true, resetTokenHash: true, resetExpiresAt: true },
    });
    const match = candidates.find((u) => tokenMatches(token, u.resetTokenHash));

    if (!match) return res.status(400).json({ error: "That reset link is not valid." });
    if (isExpired(match.resetExpiresAt)) {
      return res.status(400).json({ error: "That reset link has expired. Request a new one." });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: match.id },
      data: { passwordHash, ...clearedResetFields },
    });

    // Drop every session for this account.
    await endOtherSessions(match.id, null);
    passwordChangedEmail({ to: match.email }).catch((err) =>
      console.error("Could not send password-changed email:", err.message)
    );

    return res.json({ reset: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
