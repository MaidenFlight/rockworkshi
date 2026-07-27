const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("../config/passport");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const SALT_ROUNDS = 12;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  const isAdmin = Boolean(ADMIN_EMAIL) && user.email === ADMIN_EMAIL;
  return {
    ...safe,
    isAdmin,
    profileComplete: Boolean(user.instrument),
    // Admins run the school rather than enrol in it, so they're never held at
    // the payment step.
    paymentComplete: isAdmin || Boolean(user.paidAt),
  };
}

// Where a signed-in user still needs to go before the member area will work.
// Both the OAuth callback and the client-side route guard read this, so the
// two can't disagree about what "finished signing up" means.
function nextStepFor(user) {
  const safe = toSafeUser(user);
  if (safe.isAdmin) return "/admin";
  if (!safe.profileComplete) return "/onboarding";
  if (!safe.paymentComplete) return "/onboarding/payment";
  return "/member";
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

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
    const user = await prisma.user.create({ data: { email, passwordHash, ...profile } });

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

// Lets the sign-in/sign-up pages show only the providers this server can
// actually complete, instead of a button that 503s.
router.get("/providers", (req, res) => {
  res.json({ providers: { google: googleEnabled } });
});

router.get("/google", (req, res, next) => {
  if (!googleEnabled) {
    return res
      .status(503)
      .json({ error: "Google sign-in isn't configured on this server yet." });
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (!googleEnabled) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=google_not_configured`);
  }
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/?error=google`,
  })(req, res, () => {
    // A Google account supplies an email and a name but none of the enrolment
    // answers, so new users land on the questionnaire rather than the
    // dashboard.
    res.redirect(`${process.env.FRONTEND_URL}${nextStepFor(req.user)}`);
  });
});

module.exports = router;
