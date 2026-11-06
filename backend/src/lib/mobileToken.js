// The phone app's login token. It carries a stamp derived from the password hash, so changing
// or resetting a password stops every token issued before it, as it does for website sessions.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function passwordStamp(user) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(user.passwordHash || "").digest("base64url");
}

function signMobileToken(user, expiresIn = "30d") {
  return jwt.sign({ sub: user.id, pw: passwordStamp(user) }, process.env.JWT_SECRET, { expiresIn });
}

// The verified { sub, pw } from a token. Throws if it's bad or expired.
function readMobileToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signMobileToken, readMobileToken, passwordStamp };
