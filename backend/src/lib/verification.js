const crypto = require("crypto");

// How long a verification link stays usable.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// Minimum gap between "resend" requests, so the endpoint can't be used to spam
// somebody else's inbox.
const RESEND_COOLDOWN_MS = 60 * 1000;

// The raw token goes in the email; only its hash is stored. Compared with
// timingSafeEqual so a wrong token can't be narrowed down by response time.
function createToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token, storedHash) {
  if (!token || !storedHash) return false;
  const candidate = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

// Fields to write on the user when issuing (or clearing) a verification token.
function issueFields() {
  const { token, hash } = createToken();
  const now = new Date();
  return {
    token,
    data: {
      verificationTokenHash: hash,
      verificationSentAt: now,
      verificationExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    },
  };
}

const VERIFIED_FIELDS = {
  emailVerifiedAt: new Date(),
  verificationTokenHash: null,
  verificationExpiresAt: null,
};

function canResend(user) {
  if (!user.verificationSentAt) return true;
  return Date.now() - new Date(user.verificationSentAt).getTime() >= RESEND_COOLDOWN_MS;
}

module.exports = {
  issueFields,
  tokenMatches,
  canResend,
  verifiedFields: () => ({ ...VERIFIED_FIELDS, emailVerifiedAt: new Date() }),
  TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
};
