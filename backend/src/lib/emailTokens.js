const crypto = require("crypto");

// One-time tokens for email verification and password resets.
// Only the sha-256 hash is stored in the database.
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

function tokenMatches(token, storedHash) {
  if (!token || !storedHash) return false;
  const candidate = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function issueVerification() {
  const { token, hash } = createToken();
  const now = new Date();
  return {
    token,
    data: {
      verificationTokenHash: hash,
      verificationSentAt: now,
      verificationExpiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    },
  };
}

function issueReset() {
  const { token, hash } = createToken();
  const now = new Date();
  return {
    token,
    data: {
      resetTokenHash: hash,
      resetSentAt: now,
      resetExpiresAt: new Date(now.getTime() + RESET_TTL_MS),
    },
  };
}

const clearedResetFields = {
  resetTokenHash: null,
  resetExpiresAt: null,
};

function verifiedFields() {
  return {
    emailVerifiedAt: new Date(),
    verificationTokenHash: null,
    verificationExpiresAt: null,
  };
}

function cooledDown(sentAt) {
  if (!sentAt) return true;
  return Date.now() - new Date(sentAt).getTime() >= RESEND_COOLDOWN_MS;
}

function isExpired(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt) < new Date();
}

module.exports = {
  issueVerification,
  issueReset,
  tokenMatches,
  verifiedFields,
  clearedResetFields,
  cooledDown,
  isExpired,
  VERIFICATION_TTL_MS,
  RESET_TTL_MS,
  RESEND_COOLDOWN_MS,
};
