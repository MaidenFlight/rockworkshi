// What a member may hear and read of a song, by instrument.
//
// Whether they may open the song at all (a paid membership, their term, a teacher's assignment, a
// month they've kept) is decided first, by requirePaid and lib/termAccess.js. This only narrows it:
//   - Staff (the admin and teachers) keep every stem and every part, whatever instrument their own
//     profile names.
//   - A student studies one instrument: the one the school has on file for them, User.instrument,
//     read through canonicalInstrument(). Nothing in a request (a query, a body, a saved setting)
//     can widen it. Of a song they're entitled to they get:
//       audio  their own stem plus one pre-mixed "backing band" of every other stem (SongMix), so no
//              other instrument is ever sent on its own. If the recording has no stem for their
//              instrument, the whole song as one mix: there's nothing to take apart, and nothing
//              else is handed out in its place.
//       chart  the song's form and chords, which every part's chart is laid out on and which drive
//              the bar-by-bar navigation, plus their own instrument's transcription and no other.
//   - A student with no valid instrument gets neither. The pages send them to the school.
// After enrolment a student's instrument is the school's to change (PUT /admin/students/:id/instrument).
const prisma = require("./prisma");
const { INSTRUMENTS } = require("./lessonVideos");
const { isStaff } = require("./termAccess");
const { validateSettings } = require("./mixPresets");
const { mediaLink } = require("./media");
const { WHOLE_SONG, currentMixes } = require("./songMixes");

// For each instrument: the stem in a recording that is its part (SongTrack.part, lib/songTracks.js),
// and the chart its players read. "chords" is the song's chord chart, voiced for the instrument by the
// player; anything else names a transcription in Song.chart.parts (lib/chordChart.js).
// Keys is the recording's keyboard track, whichever keyboard plays it. Ukulele only has a stem when
// one was uploaded for that song: the guitar is never handed out in its place.
const INSTRUMENT_PARTS = {
  Guitar: { stem: "Guitar", chart: "chords" },
  Piano: { stem: "Keys", chart: "chords" },
  Bass: { stem: "Bass", chart: "Bass" },
  Drums: { stem: "Drums", chart: "Drums" },
  Voice: { stem: "Vocals", chart: "Vocals" },
  Ukulele: { stem: "Ukulele", chart: "chords" },
};

// The second track a student plays with: every stem but theirs, mixed into one.
const BACKING = "Backing";

const NO_INSTRUMENT =
  "Your account doesn't have an instrument yet, so there's nothing to practise. Ask the school to set it.";

// "Guitar" for "guitar" or " Guitar ", null for anything that isn't one of the six.
function canonicalInstrument(value) {
  if (typeof value !== "string") return null;
  const wanted = value.trim().toLowerCase();
  return INSTRUMENTS.find((name) => name.toLowerCase() === wanted) || null;
}

function partForInstrument(instrument) {
  return INSTRUMENT_PARTS[canonicalInstrument(instrument)]?.stem || null;
}

// { staff, instrument }: what a person's player may hold. instrument is null when theirs isn't valid.
function scopeFor(user) {
  return { staff: isStaff(user), instrument: canonicalInstrument(user?.instrument) };
}

// Enrolled means they've paid at some point, or the school has put them in a term or with a teacher.
// From then on only staff change a student's instrument. Staff can edit their own: nothing hangs on it.
async function instrumentLocked(user) {
  if (isStaff(user)) return false;
  if (user.paidAt) return true;
  const [payments, terms, teachers] = await Promise.all([
    prisma.payment.count({ where: { userId: user.id } }),
    prisma.termEnrollment.count({ where: { userId: user.id } }),
    prisma.teacherStudent.count({ where: { studentId: user.id } }),
  ]);
  return payments + terms + teachers > 0;
}

// The chart a student of `instrument` reads: the shared form and chords, plus their own
// transcription. available is false when the song has no chart, or none written for them yet.
function chartFor(chart, instrument) {
  if (!chart) return { chart: null, available: false };
  const { parts, ...shared } = chart;
  const wanted = INSTRUMENT_PARTS[instrument].chart;
  if (wanted === "chords") return { chart: shared, available: true };
  const own = parts?.[wanted];
  return own ? { chart: { ...shared, parts: { [wanted]: own } }, available: true } : { chart: shared, available: false };
}

// What /songs/:id/tracks sends a student. song needs its tracks and mixes. Whatever is missing
// (their stem, the backing band, their chart) is reported in `available`, never filled from
// another instrument.
async function studentPlayback(song, instrument, linkSeconds) {
  const stem = INSTRUMENT_PARTS[instrument].stem;
  const own = song.tracks.find((t) => t.part === stem) || null;
  // With their own stem, the band without it; without one, the whole song.
  const backing = currentMixes(song).get(own ? stem : WHOLE_SONG) || null;
  const tracks = [];
  if (own) tracks.push({ part: stem, role: "own", url: await mediaLink(own.storageKey, linkSeconds) });
  if (backing) {
    tracks.push({
      part: BACKING,
      role: "backing",
      url: await mediaLink(backing.storageKey, linkSeconds),
      // The mix was turned down to stay clear of clipping; this puts it back level with the stems.
      makeup: Math.round((1 / backing.gain) * 1e6) / 1e6,
    });
  }
  const { chart, available: chartAvailable } = chartFor(song.chart, instrument);
  return {
    scope: "instrument",
    instrument,
    myPart: stem,
    tracks,
    available: { own: Boolean(own), backing: Boolean(backing), chart: chartAvailable },
    chart,
  };
}

// Validates a mixer someone saves (a preset or resume state) against the player they have.
// A student's covers only their own part and the backing band: other stems are dropped, mute and solo
// are off (the three play modes do that job), the focus is always their own part, and it's stamped with
// their instrument, so it's never applied once the school changes it.
function validateMixer(input, scope) {
  if (scope.staff) return validateSettings(input);
  if (!scope.instrument) return { error: NO_INSTRUMENT };
  const own = INSTRUMENT_PARTS[scope.instrument].stem;
  const { error, settings } = validateSettings(input, [own, BACKING]);
  if (error) return { error };
  const stems = Object.fromEntries(Object.entries(settings.stems).map(([part, s]) => [part, { volume: s.volume, muted: false, soloed: false }]));
  // "Only the backing band" is "without my part" said the other way round, and vice versa.
  const flipped = { solo: "minus", minus: "solo", full: "full" };
  const mode = settings.focus === BACKING ? flipped[settings.mode] : settings.mode;
  return { settings: { ...settings, stems, mode, focus: own, instrument: scope.instrument } };
}

// Whether a saved mixer may be restored for this person now. A student's must have been made for the
// instrument they have today: older ones, for every stem or for another instrument, stay unused.
function mixerFits(settings, scope) {
  if (scope.staff) return true;
  return Boolean(settings && scope.instrument && settings.instrument === scope.instrument);
}

module.exports = {
  INSTRUMENT_PARTS,
  BACKING,
  NO_INSTRUMENT,
  canonicalInstrument,
  partForInstrument,
  scopeFor,
  instrumentLocked,
  chartFor,
  studentPlayback,
  validateMixer,
  mixerFits,
};
