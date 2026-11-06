// Tap tempo. It keeps the last few taps, ignores a stray early or late one, follows you when
// you clearly change speed, and forgets everything after a pause.
const MAX_TAPS = 8;
// Just over the 3 seconds between beats at 20 BPM, so the slowest tempo can still be tapped.
const PAUSE_MS = 3200;
// Taps closer than this are a double press, not a beat (it's faster than 300 BPM's 200ms).
const BOUNCE_MS = 120;
const OUTLIER = 0.25; // an interval this far from the median is ignored
const CHANGE = 0.35; // the newest interval this far off means the player changed tempo

const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function createTapTempo({ min = 20, max = 300 } = {}) {
  let taps = [];

  function estimate() {
    const intervals = [];
    for (let i = 1; i < taps.length; i += 1) intervals.push(taps[i] - taps[i - 1]);
    if (!intervals.length) return null;
    if (intervals.length >= 3) {
      const before = median(intervals.slice(0, -1));
      const last = intervals[intervals.length - 1];
      // A clear change of speed: start the run again from the last two taps.
      if (Math.abs(last - before) / before > CHANGE) {
        taps = taps.slice(-2);
        return 60000 / last;
      }
    }
    const mid = median(intervals);
    const kept = intervals.filter((v) => Math.abs(v - mid) / mid <= OUTLIER);
    const avg = (kept.length ? kept : intervals).reduce((a, b) => a + b, 0) / (kept.length || intervals.length);
    return 60000 / avg;
  }

  return {
    // Records a tap at `time` (milliseconds). Returns the tempo so far (null after the first
    // tap), how many taps the estimate rests on, and whether a pause just started a new run.
    tap(time) {
      const last = taps[taps.length - 1];
      let restarted = false;
      if (last !== undefined && time - last < BOUNCE_MS) return { bpm: null, taps: taps.length, restarted, ignored: true };
      if (last !== undefined && time - last > PAUSE_MS) {
        taps = [];
        restarted = true;
      }
      taps.push(time);
      if (taps.length > MAX_TAPS) taps = taps.slice(-MAX_TAPS);
      const raw = estimate();
      const bpm = raw === null ? null : Math.min(max, Math.max(min, Math.round(raw)));
      return { bpm, taps: taps.length, restarted, ignored: false };
    },
    reset() {
      taps = [];
    },
    // True when a pause has made the next tap the first of a new run.
    stale(time) {
      const last = taps[taps.length - 1];
      return last === undefined || time - last > PAUSE_MS;
    },
  };
}
