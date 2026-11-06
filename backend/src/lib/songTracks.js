// Stems a song can have, in display order. Playing all of them together is the full song.
const PARTS = ["Vocals", "Guitar", "Keys", "Bass", "Drums"];

// Which stem is "yours" for each student instrument.
// Keys must match INSTRUMENTS in lib/lessonVideos.js.
const PART_FOR_INSTRUMENT = {
  Guitar: "Guitar",
  Ukulele: "Guitar",
  Piano: "Keys",
  Bass: "Bass",
  Drums: "Drums",
  Voice: "Vocals",
};

function partForInstrument(instrument) {
  return PART_FOR_INSTRUMENT[instrument] || null;
}

// Guess a stem's part from its file name, e.g. "... (Keyboards Only).mp3" -> "Keys".
// Returns null for files that aren't a single stem, like the full mix.
function partFromFileName(fileName) {
  const name = fileName.toLowerCase();
  if (!/only|isolated|stem/.test(name)) return null;
  if (/vocal|voice/.test(name)) return "Vocals";
  if (/guitar/.test(name)) return "Guitar";
  if (/key|piano|organ|synth/.test(name)) return "Keys";
  if (/bass/.test(name)) return "Bass";
  if (/drum/.test(name)) return "Drums";
  return null;
}

function storageKeyFor(songId, part) {
  return `songs/${songId}/${part.toLowerCase()}.mp3`;
}

function sortTracks(tracks) {
  return [...tracks].sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part));
}

module.exports = { PARTS, partForInstrument, partFromFileName, storageKeyFor, sortTracks };
