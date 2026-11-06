// A student's own state per song (SongPractice): favourite, notes and resume state.
// The website and phone send the same resume shape. Saves are merged rather than replaced,
// so one never wipes settings the other didn't send.
const { validateSettings } = require("./mixPresets");
const { sortTracks } = require("./songTracks");

const MAX_NOTES = 5000;
const SPEEDS = [0.5, 0.75, 0.9, 1];
const MAX_SECONDS = 24 * 60 * 60;

function seconds(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_SECONDS ? Math.round(v * 100) / 100 : null;
}

// Returns { session } with only the keys that were sent, or { error }.
//   position  seconds into the song
//   speed     one of SPEEDS
//   loop      null or { start, end } (end null while only the start is marked)
//   mixer     mode, focus, volumes, mute/solo and take effects, as in a mix preset
function validateSession(input) {
  if (!input || typeof input !== "object") return { error: "session is required." };
  const session = {};

  if (input.position !== undefined) {
    const position = seconds(input.position);
    if (position === null) return { error: "position must be a number of seconds." };
    session.position = position;
  }
  if (input.speed !== undefined) {
    if (!SPEEDS.includes(input.speed)) return { error: `speed must be one of ${SPEEDS.join(", ")}.` };
    session.speed = input.speed;
  }
  if (input.loop !== undefined) {
    if (input.loop === null) session.loop = null;
    else {
      const start = seconds(input.loop?.start);
      const end = input.loop?.end === null ? null : seconds(input.loop?.end);
      if (start === null || (input.loop?.end !== null && (end === null || end <= start))) {
        return { error: "loop needs a start, and an end after it." };
      }
      session.loop = { start, end };
    }
  }
  if (input.mixer !== undefined) {
    const { error, settings } = validateSettings(input.mixer);
    if (error) return { error: `mixer: ${error}` };
    session.mixer = settings;
  }
  if (!Object.keys(session).length) return { error: "Nothing to save." };
  return { session };
}

function validateNotes(notes) {
  if (notes !== null && typeof notes !== "string") return { error: "notes must be text." };
  const text = (notes || "").replace(/\s+$/, "");
  if (text.length > MAX_NOTES) return { error: `Notes can be up to ${MAX_NOTES} characters.` };
  return { notes: text || null };
}

function presentPractice(p) {
  return {
    favorite: p?.favorite ?? false,
    notes: p?.notes ?? null,
    lastOpenedAt: p?.lastOpenedAt ?? null,
    session: p?.session ?? null,
  };
}

// One row of the library list. The note text and resume state stay out of the list.
function presentLibrarySong(song) {
  const p = song.practice?.[0];
  const parts = sortTracks(song.tracks).map((t) => t.part);
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    level: song.level,
    parts,
    hasTracks: parts.length > 0,
    favorite: p?.favorite ?? false,
    hasNotes: Boolean(p?.notes),
    lastOpenedAt: p?.lastOpenedAt ?? null,
  };
}

module.exports = { MAX_NOTES, validateSession, validateNotes, presentPractice, presentLibrarySong };
