// Validates the mixer settings a student saves as a named preset. The players on the website
// and phone send the same shape; anything unknown is dropped and numbers are kept in range.
const { PARTS } = require("./songTracks");

const MODES = ["full", "solo", "minus"];
const REVERB_SIZES = ["small", "medium", "large"];
const MAX_NAME = 40;
const MAX_PRESETS_PER_SONG = 20;

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

// Percent sliders are whole numbers 0-100; effect amounts are in their own units.
function inRange(v, min, max, step = 1) {
  if (!isNum(v) || v < min || v > max) return null;
  return Math.round(v / step) * step;
}

function cleanEffects(fx) {
  if (fx === undefined || fx === null) return { value: null };
  if (typeof fx !== "object") return { error: "effects must be an object." };
  const out = {
    bypass: fx.bypass === true,
    low: inRange(fx.low, -12, 12, 0.5),
    mid: inRange(fx.mid, -12, 12, 0.5),
    high: inRange(fx.high, -12, 12, 0.5),
    drive: inRange(fx.drive, 0, 100),
    reverb: inRange(fx.reverb, 0, 100),
    size: REVERB_SIZES.includes(fx.size) ? fx.size : null,
    output: inRange(fx.output, -12, 6, 0.5),
  };
  if (Object.values(out).some((v) => v === null)) return { error: "effects has a value out of range." };
  return { value: out };
}

// Returns { settings } or { error }. `parts` are the tracks the person's player has: every stem for
// staff, or a student's own stem and their backing band (see validateMixer in lib/instrumentAccess.js).
function validateSettings(input, parts = PARTS) {
  if (!input || typeof input !== "object") return { error: "settings is required." };

  const stems = {};
  for (const [part, s] of Object.entries(input.stems || {})) {
    if (!parts.includes(part)) continue;
    const volume = inRange(s?.volume, 0, 100);
    if (volume === null) return { error: `${part} volume must be 0 to 100.` };
    stems[part] = { volume, muted: s.muted === true, soloed: s.soloed === true };
  }

  const master = inRange(input.master, 0, 100);
  const take = inRange(input.take, 0, 100);
  if (master === null || take === null) return { error: "master and take volume must be 0 to 100." };

  const mode = MODES.includes(input.mode) ? input.mode : "full";
  const focus = parts.includes(input.focus) ? input.focus : null;

  const effects = cleanEffects(input.effects);
  if (effects.error) return { error: effects.error };

  return {
    settings: { mode, focus, master, take, takeMuted: input.takeMuted === true, stems, effects: effects.value },
  };
}

function validateName(name) {
  if (typeof name !== "string") return { error: "Give the preset a name." };
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME) return { error: `Preset names are 1 to ${MAX_NAME} characters.` };
  return { name: trimmed };
}

function presentPreset(p) {
  return { id: p.id, name: p.name, settings: p.settings, updatedAt: p.updatedAt };
}

module.exports = { MAX_PRESETS_PER_SONG, validateSettings, validateName, presentPreset };
