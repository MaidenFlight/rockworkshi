// A song's chord chart: chord names and when each one starts in the recording's stems.
// Chords, section names and notes only. Lyrics are copyrighted and don't belong here.
//   { end, sections: [{ name, bars: [{ time, chords: [{ name, time }] }] }], parts? }
// parts are optional transcriptions, from scripts/transcribe-parts.py:
//   { Bass: { draft?, notes }, Vocals: { draft?, notes }, Drums: { draft?, hits } }
//   a note is { time, len, midi } and a hit is { time, drum }
const DRUMS = ["kick", "snare", "hat"];
const MAX_SECONDS = 24 * 60 * 60;

function isTime(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_SECONDS;
}

function validateNotes(name, part) {
  if (!Array.isArray(part?.notes)) return { error: `${name} needs notes.` };
  let last = -1;
  const notes = [];
  for (const note of part.notes) {
    const ok = isTime(note?.time) && isTime(note?.len) && note.len > 0 && Number.isInteger(note?.midi) && note.midi >= 12 && note.midi <= 108;
    if (!ok) return { error: `${name} has a note without a time, length or pitch.` };
    if (note.time < last) return { error: `${name}: the note at ${note.time}s is out of order.` };
    last = note.time;
    notes.push({ time: note.time, len: note.len, midi: note.midi });
  }
  return { part: { draft: Boolean(part.draft), notes } };
}

function validateHits(name, part) {
  if (!Array.isArray(part?.hits)) return { error: `${name} needs hits.` };
  let last = -1;
  const hits = [];
  for (const hit of part.hits) {
    if (!isTime(hit?.time) || !DRUMS.includes(hit?.drum)) return { error: `${name} has a hit without a time or a known drum.` };
    if (hit.time < last) return { error: `${name}: the hit at ${hit.time}s is out of order.` };
    last = hit.time;
    hits.push({ time: hit.time, drum: hit.drum });
  }
  return { part: { draft: Boolean(part.draft), hits } };
}

function validateParts(input) {
  const parts = {};
  for (const [name, check] of [
    ["Bass", validateNotes],
    ["Vocals", validateNotes],
    ["Drums", validateHits],
  ]) {
    if (input[name] === undefined) continue;
    const { error, part } = check(name, input[name]);
    if (error) return { error };
    parts[name] = part;
  }
  return { parts };
}

// Returns { chart } with only the known fields, or { error }. Times must only ever go forward.
function validateChart(input) {
  if (!input || !Array.isArray(input.sections) || !input.sections.length) return { error: "A chart needs sections." };
  if (!isTime(input.end)) return { error: "A chart needs an end time." };
  let last = -1;
  const sections = [];
  for (const section of input.sections) {
    if (typeof section?.name !== "string" || !section.name.trim()) return { error: "Every section needs a name." };
    if (!Array.isArray(section.bars) || !section.bars.length) return { error: `${section.name} has no bars.` };
    const bars = [];
    for (const bar of section.bars) {
      if (!isTime(bar?.time) || !Array.isArray(bar.chords) || !bar.chords.length) {
        return { error: `${section.name} has a bar without a time or chords.` };
      }
      const chords = [];
      for (const chord of bar.chords) {
        if (typeof chord?.name !== "string" || !chord.name.trim() || !isTime(chord.time)) {
          return { error: `${section.name} has a chord without a name or time.` };
        }
        if (chord.time < last) return { error: `${section.name}: ${chord.name} at ${chord.time}s is out of order.` };
        last = chord.time;
        chords.push({ name: chord.name, time: chord.time });
      }
      if (chords[0].time !== bar.time) return { error: `${section.name}: a bar must start with its first chord.` };
      bars.push({ time: bar.time, chords });
    }
    sections.push({ name: section.name, bars });
  }
  if (input.end <= last) return { error: "The chart must end after its last chord." };
  if (input.parts === undefined) return { chart: { end: input.end, sections } };
  const { error, parts } = validateParts(input.parts);
  if (error) return { error };
  return { chart: { end: input.end, sections, parts } };
}

module.exports = { validateChart };
