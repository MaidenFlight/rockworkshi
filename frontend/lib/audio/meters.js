// Reading levels for the player's meters, straight from AnalyserNodes in the real signal path.
// Nothing here is estimated: a meter shows what the analyser measured on its last block.

export const METER_FLOOR_DB = -48; // the bottom of every meter's scale
const RELEASE_DB_PER_S = 24; // how fast a bar falls once the sound drops, like a console's PPM
const HOLD_S = 1.4; // how long the peak line stays before it falls

export function analyser(ctx) {
  const a = ctx.createAnalyser();
  a.fftSize = 1024;
  a.smoothingTimeConstant = 0;
  return a;
}

// The peak and RMS of the analyser's most recent block of samples.
export function measure(node, scratch) {
  node.getFloatTimeDomainData(scratch);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < scratch.length; i++) {
    const v = scratch[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / scratch.length) };
}

export function toDb(amplitude) {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
}

// Where a level sits on a meter, 0 at the floor and 1 at full scale.
export function meterFraction(db) {
  if (!Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

// Smooths a meter the way a console does: it jumps up at once and falls at a steady rate, with
// a peak line that holds for a moment. Feed it the measured peak each frame.
export function createBallistics() {
  let shown = METER_FLOOR_DB;
  let held = METER_FLOOR_DB;
  let heldFor = 0;
  return {
    step(peakDb, dt) {
      const level = Math.max(METER_FLOOR_DB, peakDb);
      shown = level >= shown ? level : Math.max(level, shown - RELEASE_DB_PER_S * dt);
      if (level >= held) {
        held = level;
        heldFor = 0;
      } else if ((heldFor += dt) > HOLD_S) {
        held = Math.max(shown, held - RELEASE_DB_PER_S * dt);
      }
      return { shown, held };
    },
    reset() {
      shown = held = METER_FLOOR_DB;
      heldFor = 0;
    },
  };
}
