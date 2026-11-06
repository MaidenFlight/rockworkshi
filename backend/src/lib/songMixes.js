// Tracks mixed ahead of time from a song's stems (SongMix): for each stem, all the others played
// together (that instrument's backing band), and every stem together (the whole song). Students
// get their own stem and one of these, never another instrument's stem by itself
// (lib/instrumentAccess.js). Mixing needs ffmpeg, so it's done once per song by songs:backing and
// songs:upload, never while someone is waiting to play.
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const prisma = require("./prisma");
const { putMedia } = require("./media");

// SongMix.without for the mix of every stem.
const WHOLE_SONG = "";
// A mix is turned down only if it would peak above this (about -1 dBFS), which leaves room for the
// small overshoot MP3 encoding adds. The gain is stored so the players can turn it back up.
const PEAK = 0.89;

// Changes whenever a stem is added, removed or replaced, so an old mix is never served with new stems.
function sourcesOf(tracks) {
  const list = tracks.map((t) => `${t.part}=${t.storageKey}@${new Date(t.updatedAt).toISOString()}`).sort();
  return crypto.createHash("sha256").update(list.join("\n")).digest("hex").slice(0, 16);
}

// Keys include the sources, so a new mix never replaces a file someone may still be playing.
function mixKey(songId, sources, without) {
  return `songs/${songId}/mixes/${sources}/${without ? `without-${without.toLowerCase()}` : "whole-song"}.mp3`;
}

// The song's mixes that were made from its current stems, by `without`. Needs song.tracks and song.mixes.
function currentMixes(song) {
  const sources = sourcesOf(song.tracks);
  return new Map((song.mixes || []).filter((m) => m.sources === sources).map((m) => [m.without, m]));
}

// Every mix a song should have: one without each stem, and the whole song.
function mixesNeeded(tracks) {
  return [...tracks.map((t) => t.part), WHOLE_SONG];
}

function isUpToDate(song) {
  const current = currentMixes(song);
  return song.tracks.length > 0 && mixesNeeded(song.tracks).every((without) => current.has(without));
}

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", (err) => reject(new Error(`Couldn't run ${cmd} (${err.message}). Install ffmpeg and try again.`)));
    child.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${cmd} failed: ${stderr.trim() || code}`))));
    if (input) {
      child.stdin.on("error", () => {}); // reported through the exit code instead
      child.stdin.end(input);
    }
  });
}

async function sampleRateOf(input) {
  const out = await run("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", input]);
  const rate = Number(out.toString().trim());
  if (!Number.isInteger(rate) || rate <= 0) throw new Error(`Couldn't read the sample rate of ${input}.`);
  return rate;
}

// Interleaved stereo floats. ffmpeg drops the encoder's leading silence, so every stem starts on its
// first real sample, as it does in the browsers' decoders.
async function decode(input, rate) {
  const bytes = await run("ffmpeg", ["-loglevel", "error", "-i", input, "-f", "f32le", "-ac", "2", "-ar", String(rate), "-"]);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
}

// Written to a real file rather than a pipe: the MP3 muxer goes back to fill in the gapless header,
// which is what lets players trim the encoder's padding and keep the mix in time with the stems.
async function encode(samples, rate) {
  const file = path.join(os.tmpdir(), `rw-mix-${crypto.randomUUID()}.mp3`);
  try {
    const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    await run("ffmpeg", ["-loglevel", "error", "-y", "-f", "f32le", "-ar", String(rate), "-ac", "2", "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", "192k", file], pcm);
    return fs.readFileSync(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

// stems: [{ part, input }] where input is a file path or URL ffmpeg can read.
// Returns [{ without, gain, mp3 }] for every mix in mixesNeeded().
async function renderMixes(stems) {
  if (!stems.length) throw new Error("A song needs stems before it can have mixes.");
  const rate = await sampleRateOf(stems[0].input);
  const decoded = [];
  for (const stem of stems) decoded.push({ part: stem.part, samples: await decode(stem.input, rate) });
  const length = Math.max(...decoded.map((d) => d.samples.length));

  const out = [];
  for (const without of mixesNeeded(stems)) {
    const mix = new Float32Array(length);
    for (const d of decoded) {
      if (d.part === without) continue;
      for (let i = 0; i < d.samples.length; i++) mix[i] += d.samples[i];
    }
    let peak = 0;
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(mix[i]));
    const gain = peak > PEAK ? PEAK / peak : 1;
    if (gain !== 1) for (let i = 0; i < length; i++) mix[i] *= gain;
    out.push({ without, gain: Math.round(gain * 1e6) / 1e6, mp3: await encode(mix, rate) });
  }
  return out;
}

// Stores rendered mixes and records them against the stems they came from, replacing older records.
async function saveMixes(song, rendered) {
  const sources = sourcesOf(song.tracks);
  for (const { without, gain, mp3 } of rendered) {
    const storageKey = mixKey(song.id, sources, without);
    await putMedia(storageKey, mp3, "audio/mpeg");
    await prisma.songMix.upsert({
      where: { songId_without: { songId: song.id, without } },
      create: { songId: song.id, without, storageKey, gain, sources },
      update: { storageKey, gain, sources },
    });
  }
  // A stem that's gone takes its backing band with it.
  await prisma.songMix.deleteMany({ where: { songId: song.id, without: { notIn: rendered.map((r) => r.without) } } });
}

module.exports = { WHOLE_SONG, sourcesOf, mixKey, currentMixes, mixesNeeded, isUpToDate, renderMixes, saveMixes };
