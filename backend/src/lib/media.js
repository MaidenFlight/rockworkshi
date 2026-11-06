// Where song audio is kept, and the short-lived links members get to it.
//   Production: the private R2 bucket (lib/r2.js), with presigned links.
//   Development and tests can set MEDIA_DIR to a local folder instead, and then everything is kept
//   there and R2 is never contacted. Files are served by GET /media/<key>?exp=&sig=
//   (localMediaRouter below), signed and expiring like an R2 link, so the access rules can be
//   exercised without touching the real bucket. MEDIA_DIR is ignored in production.
// A key is an object key such as "songs/<id>/guitar.mp3", never a URL.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { isR2Configured, signedUrl, putObject, headObject } = require("./r2");

// Letters, digits and / _ . - only, no ".." anywhere, so a key can't climb out of the folder.
const KEY = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
const TYPES = { ".mp3": "audio/mpeg", ".wav": "audio/wav" };

function mediaDir() {
  const dir = process.env.MEDIA_DIR;
  if (!dir || process.env.NODE_ENV === "production") return null;
  // Relative to the backend folder, wherever the process was started from.
  return path.resolve(__dirname, "../..", dir);
}

function isMediaConfigured() {
  return Boolean(mediaDir()) || isR2Configured();
}

function localPath(key) {
  const root = mediaDir();
  if (!root || typeof key !== "string" || !KEY.test(key)) return null;
  const full = path.resolve(root, key);
  return full.startsWith(root + path.sep) ? full : null;
}

function localFile(key) {
  const full = localPath(key);
  return full && fs.existsSync(full) ? full : null;
}

function secret() {
  return process.env.MEDIA_SECRET || process.env.SESSION_SECRET;
}

function signature(key, exp) {
  return crypto.createHmac("sha256", secret()).update(`${key}\n${exp}`).digest("base64url");
}

function apiOrigin() {
  return (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "");
}

// A link that works for `seconds`, then stops. Like an R2 link, it's made without checking the
// object exists; fetching a missing one is a 404.
async function mediaLink(key, seconds) {
  if (mediaDir()) {
    if (!localPath(key)) throw new Error(`Not a storage key: ${key}`);
    const exp = Math.floor(Date.now() / 1000) + seconds;
    return `${apiOrigin()}/media/${key}?exp=${exp}&sig=${signature(key, exp)}`;
  }
  return signedUrl(key, seconds);
}

// Something ffmpeg can read the object from: the local file, or a short-lived R2 link.
async function mediaSource(key) {
  if (mediaDir()) {
    const file = localFile(key);
    if (!file) throw new Error(`${key} isn't in MEDIA_DIR.`);
    return file;
  }
  return signedUrl(key, 30 * 60);
}

async function putMedia(key, body, contentType) {
  if (mediaDir()) {
    const full = localPath(key);
    if (!full) throw new Error(`Not a storage key: ${key}`);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    return;
  }
  await putObject(key, body, contentType);
}

async function hasMedia(key) {
  if (mediaDir()) return Boolean(localFile(key));
  return isR2Configured() && Boolean(await headObject(key));
}

// Serves MEDIA_DIR to holders of a link from mediaLink, as R2 would. Mounted only outside production.
function localMediaRouter() {
  const router = express.Router();
  router.get("/*key", (req, res) => {
    const key = [].concat(req.params.key).join("/");
    const exp = Number(req.query.exp);
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";
    const expected = Number.isInteger(exp) ? signature(key, exp) : "";
    const valid =
      sig.length === expected.length && sig.length > 0 && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid || exp < Date.now() / 1000) return res.status(403).json({ error: "This link has expired or isn't valid." });
    const file = localFile(key);
    if (!file) return res.status(404).json({ error: "Not found." });
    res.setHeader("Cache-Control", "private, no-store");
    res.type(TYPES[path.extname(file)] || "application/octet-stream");
    // Relative to the folder: the folder's own path may contain dot-directories that send() refuses.
    res.sendFile(key, { root: mediaDir() });
  });
  return router;
}

module.exports = { mediaDir, isMediaConfigured, mediaLink, mediaSource, putMedia, hasMedia, localMediaRouter };
