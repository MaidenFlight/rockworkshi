// Waveform outlines for the timeline, from the AudioBuffers the player already decoded to play.
// Each buffer is summarised once into a fixed number of min/max pairs, mixing all its channels,
// and kept with the buffer.

const BUCKETS = 2400;
const cache = new WeakMap();

export function peaksOf(buffer) {
  if (cache.has(buffer)) return cache.get(buffer);
  const channels = [...Array(buffer.numberOfChannels)].map((_, c) => buffer.getChannelData(c));
  const per = Math.max(1, Math.floor(buffer.length / BUCKETS));
  const count = Math.ceil(buffer.length / per);
  const out = new Float32Array(count * 2);
  for (let b = 0; b < count; b++) {
    let lo = 0;
    let hi = 0;
    const end = Math.min(buffer.length, (b + 1) * per);
    // Every other sample is plenty for an outline a few hundred pixels wide.
    for (let i = b * per; i < end; i += 2) {
      for (const data of channels) {
        const v = data[i];
        if (v < lo) lo = v;
        else if (v > hi) hi = v;
      }
    }
    out[b * 2] = lo;
    out[b * 2 + 1] = hi;
  }
  const peaks = { data: out, count, seconds: buffer.duration };
  cache.set(buffer, peaks);
  return peaks;
}

// Works out a list of buffers' outlines one per task, so the page stays responsive while it runs.
export function peaksInTurn(entries, onEach) {
  let cancelled = false;
  let i = 0;
  function next() {
    if (cancelled || i >= entries.length) return;
    const [key, buffer] = entries[i++];
    onEach(key, peaksOf(buffer));
    setTimeout(next, 0);
  }
  setTimeout(next, 0);
  return () => {
    cancelled = true;
  };
}

// Draws an outline into a canvas, from song time `from` for `span` seconds of song. `offset` is
// where the buffer starts in the song (a take can start anywhere).
export function drawPeaks(canvas, peaks, { color, offset = 0, from = 0, span }) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!peaks || !span) return;
  ctx.fillStyle = color;
  const mid = h / 2;
  const perBucket = peaks.seconds / peaks.count;
  for (let x = 0; x < w; x++) {
    const t0 = from + (x / w) * span - offset;
    const t1 = from + ((x + 1) / w) * span - offset;
    if (t1 <= 0 || t0 >= peaks.seconds) continue;
    const b0 = Math.max(0, Math.floor(t0 / perBucket));
    const b1 = Math.min(peaks.count - 1, Math.max(b0, Math.ceil(t1 / perBucket) - 1));
    let lo = 0;
    let hi = 0;
    for (let b = b0; b <= b1; b++) {
      if (peaks.data[b * 2] < lo) lo = peaks.data[b * 2];
      if (peaks.data[b * 2 + 1] > hi) hi = peaks.data[b * 2 + 1];
    }
    const top = mid - Math.min(1, hi) * mid;
    const bottom = mid - Math.max(-1, lo) * mid;
    ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
}
