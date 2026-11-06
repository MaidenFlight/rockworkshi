// Measures how loud a song's stems are when they all play at once. Separate stems are
// often each mastered loud, so their sum can peak far over full scale (one song measured
// 2.2, about +7 dB). The players use this to set headroom so the band doesn't distort.
// Needs ffmpeg on the PATH; inputs can be file paths or URLs.
const { spawn } = require("child_process");

const RATE = 48000;
const PERCENTILE = 0.99999; // ignore the rarest peaks; the players' soft clipper rounds those off
const BIN = 0.0005;
const MAX_LEVEL = 8;

function decode(input) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-loglevel", "error", "-i", input, "-f", "f32le", "-ac", "2", "-ar", String(RATE), "-"]);
    const chunks = [];
    let stderr = "";
    ff.stdout.on("data", (c) => chunks.push(c));
    ff.stderr.on("data", (c) => (stderr += c));
    ff.on("error", (err) => reject(new Error(`Couldn't run ffmpeg (${err.message}). Install it and try again.`)));
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed: ${stderr.trim() || code}`));
      const bytes = Buffer.concat(chunks);
      // Copy into its own ArrayBuffer: a pooled Buffer may not be 4-byte aligned.
      resolve(new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)));
    });
  });
}

// Returns the level, e.g. 1.8, or null if the stems are silent.
async function measureMixLevel(inputs) {
  let sum = null;
  for (const input of inputs) {
    const samples = await decode(input);
    if (!sum) {
      sum = samples;
      continue;
    }
    const n = Math.min(sum.length, samples.length);
    for (let i = 0; i < n; i++) sum[i] += samples[i];
    if (samples.length > sum.length) {
      const longer = new Float32Array(samples.length);
      longer.set(sum);
      longer.set(samples.subarray(sum.length), sum.length);
      sum = longer;
    }
  }
  if (!sum || !sum.length) return null;

  // A histogram finds the percentile without sorting tens of millions of samples.
  const bins = new Uint32Array(Math.ceil(MAX_LEVEL / BIN) + 1);
  for (let i = 0; i < sum.length; i++) {
    bins[Math.min(bins.length - 1, Math.floor(Math.abs(sum[i]) / BIN))]++;
  }
  const target = sum.length * PERCENTILE;
  let seen = 0;
  for (let b = 0; b < bins.length; b++) {
    seen += bins[b];
    if (seen >= target) return b === 0 ? null : Math.round((b + 1) * BIN * 1000) / 1000;
  }
  return MAX_LEVEL;
}

module.exports = { measureMixLevel };
