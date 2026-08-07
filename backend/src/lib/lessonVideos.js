// Turning a stored LessonVideo row into something a browser can actually load.
//
// The row holds the host's id, never a URL. For Bunny that's deliberate: the
// playable URL carries an expiring token, so a stored one would be stale by the
// time anyone used it. "direct" exists for development seed data and any
// leftover plain-URL video, where the id *is* the URL and there is nothing to
// sign.

function playableUrl(video) {
  if (!video) return null;
  if (video.provider === "direct") return video.videoId;
  // Bunny signing goes here once the library exists. Returning null rather than
  // guessing a URL means an unconfigured host shows "coming soon" instead of a
  // player that silently fails to load.
  return null;
}

// The videos a given student should see for a lesson: their instrument only,
// published only, and the lowest level recorded so far. Levels above 1 aren't
// being recorded yet, so this picks the lowest rather than assuming 1 exists.
function videosForInstrument(videos, instrument) {
  if (!instrument) return { lesson: null, playthrough: null };

  const mine = (videos || []).filter((v) => v.published && v.instrument === instrument);
  const lowest = (kind) =>
    mine
      .filter((v) => v.kind === kind)
      .sort((a, b) => a.level - b.level)[0] || null;

  return { lesson: lowest("lesson"), playthrough: lowest("playthrough") };
}

// Flattens a lesson and its videos into the shape the player consumes. The raw
// video rows are deliberately not included: they carry every other instrument's
// host ids, and a paid guitar student has no reason to receive the drum ones.
function presentLesson(lesson, instrument) {
  const { videos, ...rest } = lesson;
  const picked = videosForInstrument(videos, instrument);

  return {
    ...rest,
    instrument: instrument || null,
    videoUrl: playableUrl(picked.lesson),
    playthroughVideoUrl: playableUrl(picked.playthrough),
    videoProvider: picked.lesson ? picked.lesson.provider : null,
    // What *has* been recorded, so the UI can say "available for Guitar, Piano"
    // rather than leaving a student guessing why their instrument is empty.
    recordedFor: [...new Set((videos || []).filter((v) => v.published).map((v) => v.instrument))].sort(),
  };
}

module.exports = { playableUrl, videosForInstrument, presentLesson };
