// Converts stored LessonVideo rows into what the player needs.
// Rows store the host's video id, not a URL, because Bunny URLs are signed and expire.

// Must match the list in frontend/lib/content.js. User.instrument is matched
// against this by string, so renaming one side hides every video.
const INSTRUMENTS = ["Guitar", "Piano", "Bass", "Drums", "Voice", "Ukulele"];

const VIDEO_KINDS = ["lesson", "playthrough"];
const VIDEO_PROVIDERS = ["bunny", "direct"];
const MAX_LEVEL = 5;

function playableUrl(video) {
  if (!video) return null;
  if (video.provider === "direct") return video.videoId;
  // TODO: sign Bunny URLs. Until then the UI shows "coming soon".
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
  playableUrl,
  videosForInstrument,
  presentLesson,
  validateSlot,
  INSTRUMENTS,
  VIDEO_KINDS,
  VIDEO_PROVIDERS,
  MAX_LEVEL,
};
