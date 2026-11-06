// Real recordings for the piano and the tuner's reference tones. A set holds a sample every few
// semitones; a note in between plays the nearest one, re-pitched by playback rate (one or two
// semitones, five for the 5-string bass's low B). The files are served from public/samples, so a
// visitor's browser fetches them from this site and nowhere else.
//
//   PIANO   Salamander Grand Piano by Alexander Holm, CC BY 3.0, from the Tone.js web set
//           (github.com/Tonejs/audio). Left in its own tuning: a real piano is stretched, a little
//           flat in the bass and sharp in the treble, and sounds wrong without it.
//   GUITAR  University of Iowa Electronic Music Studios, edited by Nicholaus Brosowsky for
//           tonejs-instruments (github.com/nbrosowsky/tonejs-instruments), CC BY 3.0.
//   BASS    Karoryfer Samples, edited for the same project, CC BY 3.0.
//
// The tuner's numbers are how many cents each file measured off true pitch (harmonics fitted to
// a stiff string, median from 0.45 s to 2.55 s, the stretch you listen to); playback takes them
// back out. Four files from those sets are left out because their pitch wanders as they ring
// (guitar A2 by 3 cents, Bb3 and D4 by up to 14, bass C#1 by 30); their notes come from steady
// neighbours instead. The licence asks for the credit lines shown under each tool.

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "E2", "Eb2", "C#4", or a file name such as "Cs4", to a MIDI note number.
export function noteToMidi(name) {
  const m = /^([A-G])(#|s|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  const accidental = m[2] === "b" ? -1 : m[2] ? 1 : 0;
  return (Number(m[3]) + 1) * 12 + LETTERS[m[1]] + accidental;
}

// `lead` skips the silence a file opens with, so a press sounds at once.
function defineSet(dir, files, { gain, lead = 0 }) {
  const samples = Object.entries(files)
    .map(([name, cents]) => ({ midi: noteToMidi(name), cents, url: `${dir}/${name}.mp3` }))
    .sort((a, b) => a.midi - b.midi);
  return { samples, gain, lead };
}

const pianoFiles = { C8: 0 };
for (let octave = 1; octave <= 7; octave++) {
  for (const letter of ["C", "Ds", "Fs", "A"]) pianoFiles[letter + octave] = 0;
}

export const PIANO = defineSet("/samples/piano", pianoFiles, { gain: 0.7 });

export const GUITAR = defineSet(
  "/samples/guitar",
  {
    D2: -4.9, Ds2: -4.7, E2: -4, G2: -5, Gs2: -6.8, Cs3: -4, D3: -2.3, Fs3: -5.9, G3: -4.1,
    A3: -1.2, B3: -2.5, C4: -4.1, Ds4: -1.8, E4: 2.6, G4: -0.5, A4: -0.9,
  },
  { gain: 0.9, lead: 0.038 },
);

export const BASS = defineSet(
  "/samples/bass",
  { E1: -8.9, As1: -10.1, Cs2: -5, G2: -3.3 },
  { gain: 0.9, lead: 0.022 },
);

// On a tie the sample above wins, which is what sends Bb3 to the steady B3 rather than to A3.
function nearest(set, midi) {
  let best = set.samples[0];
  for (const s of set.samples) if (Math.abs(s.midi - midi) <= Math.abs(best.midi - midi)) best = s;
  return best;
}

// Files are decoded the moment they arrive, in an offline context: unlike the one that plays,
// it needs no tap to start, so the first key pressed already has its sound ready. A decoded
// AudioBuffer plays in any context.
let decoder = null;
const buffers = new Map(); // url -> Promise<AudioBuffer>

function load(url) {
  if (!buffers.has(url)) {
    const buffer = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((bytes) => {
        decoder ??= new OfflineAudioContext(1, 1, 44100);
        return decoder.decodeAudioData(bytes);
      });
    // A failed load is forgotten, so the next press tries again.
    buffer.catch(() => buffers.delete(url));
    buffers.set(url, buffer);
  }
  return buffers.get(url);
}

// Starts loading the recordings these notes need, so pressing one doesn't wait on the network.
export function prepare(set, midis) {
  for (const url of new Set(midis.map((midi) => nearest(set, midi).url))) load(url).catch(() => {});
}

// Plays a note as soon as its recording is ready. The handle's stop(seconds) fades it out, and
// works before the note has started too. `onEnd` runs only if the recording plays out by itself.
export function playNote(ctx, set, midi, { onEnd } = {}) {
  const sample = nearest(set, midi);
  const out = ctx.createGain();
  out.gain.value = set.gain;
  out.connect(ctx.destination);
  let source = null;
  let stopped = false;

  load(sample.url).then(
    (buffer) => {
      if (stopped) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 2 ** ((100 * (midi - sample.midi) - sample.cents) / 1200);
      source.connect(out);
      source.onended = () => {
        out.disconnect();
        if (!stopped) onEnd?.();
      };
      source.start(0, set.lead);
    },
    () => {
      out.disconnect();
      if (!stopped) onEnd?.();
    },
  );

  return {
    stop(seconds) {
      if (stopped) return;
      stopped = true;
      if (!source) {
        out.disconnect();
        return;
      }
      const t = ctx.currentTime;
      out.gain.setTargetAtTime(0, t, seconds / 6);
      source.stop(t + seconds);
    },
  };
}
