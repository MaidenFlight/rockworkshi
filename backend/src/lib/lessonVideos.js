// Converts stored LessonVideo rows into what the players need.
// Rows store the host's video id, not a URL, because Bunny URLs are signed and expire.
// A row belongs to a lesson (the lesson pages) or to a song (its tutorials on the song page).

// Must match the list in frontend/lib/content.js. User.instrument is matched
// against this by string, so renaming one side hides every video.
const INSTRUMENTS = ["Guitar", "Piano", "Bass", "Drums", "Voice", "Ukulele"];

const VIDEO_KINDS = ["lesson", "playthrough"];
const VIDEO_PROVIDERS = ["bunny", "direct"];
const MAX_LEVEL = 5;

// The school's five levels, in order. Must match songLevels in frontend/lib/content.js.
const LEVEL_NAMES = ["Sing-a-long", "Chords", "Scales & fills", "Melody", "Improv"];

// The INSTRUMENTS name for a stored or requested one, ignoring case and spaces: signup stores one
// of the six, but the settings page takes free text. null for anything else.
function canonicalInstrument(name) {
  const wanted = typeof name === "string" ? name.trim().toLowerCase() : "";
  return INSTRUMENTS.find((i) => i.toLowerCase() === wanted) || null;
}

// Lesson videos aren't ready yet, so every app shows "coming soon" until this is switched on.
function videosReleased() {
  return process.env.LESSON_VIDEOS_READY === "true";
}

function playableUrl(video) {
  if (!videosReleased() || !video) return null;
  if (video.provider === "direct") return video.videoId;
  // TODO: sign Bunny URLs. Until then lessons show "coming soon" and a song's tutorial says it can't play.
  return null;
}

// Published videos for one instrument, lowest recorded level of each kind.
function videosForInstrument(videos, instrument) {
  if (!instrument) return { lesson: null, playthrough: null };

  const mine = (videos || []).filter((v) => v.published && v.instrument === instrument);
  const lowest = (kind) =>
    mine
      .filter((v) => v.kind === kind)
      .sort((a, b) => a.level - b.level)[0] || null;

  return { lesson: lowest("lesson"), playthrough: lowest("playthrough") };
}

// Raw video rows are left out so a student doesn't receive other instruments' ids.
function presentLesson(lesson, instrument) {
  const { videos, ...rest } = lesson;
  const picked = videosForInstrument(videos, instrument);

  return {
    ...rest,
    instrument: instrument || null,
    videoUrl: playableUrl(picked.lesson),
    playthroughVideoUrl: playableUrl(picked.playthrough),
    videoProvider: picked.lesson ? picked.lesson.provider : null,
    recordedFor: [...new Set((videos || []).filter((v) => v.published).map((v) => v.instrument))].sort(),
  };
}

// A song's tutorials for one instrument: all five levels in order, each with its published
// videos, the lesson before the playthrough. Callers load only that instrument's rows, and the
// filter here is a second guard, so nothing about another instrument's videos is in the result.
// Before videos are released every level is empty, which the song page shows as coming soon.
// "unavailable" is a published video with no playable link, which the page reports as a
// playback problem rather than as coming soon.
function presentTutorials(videos, instrument) {
  const levels = LEVEL_NAMES.map((name, i) => ({ level: i + 1, name, videos: [] }));
  if (instrument && videosReleased()) {
    const mine = (videos || []).filter((v) => v.published && v.instrument === instrument);
    mine.sort((a, b) => VIDEO_KINDS.indexOf(a.kind) - VIDEO_KINDS.indexOf(b.kind));
    for (const v of mine) {
      const url = playableUrl(v);
      levels[v.level - 1]?.videos.push({ kind: v.kind, status: url ? "ready" : "unavailable", url });
    }
  }
  return { instrument: instrument || null, levels };
}

// Validates an admin video slot. Returns { error } or { slot }.
function validateSlot({ instrument, level, kind, provider }) {
  if (!INSTRUMENTS.includes(instrument)) {
    return { error: `instrument must be one of: ${INSTRUMENTS.join(", ")}.` };
  }
  const n = Number(level);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LEVEL) {
    return { error: `level must be a whole number from 1 to ${MAX_LEVEL}.` };
  }
  if (!VIDEO_KINDS.includes(kind)) {
    return { error: `kind must be one of: ${VIDEO_KINDS.join(", ")}.` };
  }
  if (provider !== undefined && !VIDEO_PROVIDERS.includes(provider)) {
    return { error: `provider must be one of: ${VIDEO_PROVIDERS.join(", ")}.` };
  }
  return { slot: { instrument, level: n, kind, provider: provider || "bunny" } };
}

module.exports = {
  canonicalInstrument,
  playableUrl,
  videosReleased,
  videosForInstrument,
  presentLesson,
  presentTutorials,
  validateSlot,
  INSTRUMENTS,
  VIDEO_KINDS,
  VIDEO_PROVIDERS,
  MAX_LEVEL,
  LEVEL_NAMES,
};
