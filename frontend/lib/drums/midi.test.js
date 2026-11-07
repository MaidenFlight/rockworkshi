import test from "node:test";
import assert from "node:assert/strict";
import { beatToMidi, midiFileName } from "./midi.js";
import { Sequencer } from "./sequencer.js";
import { setBeatName, setMeter, setTempo } from "./beat.js";
import { starterBeat } from "./grooves.js";

// Reads a type-0 file back into note-ons with absolute ticks, plus the meta events.
function parse(bytes) {
  const text = (i, n) => String.fromCharCode(...bytes.slice(i, i + n));
  const u32 = (i) => (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
  assert.equal(text(0, 4), "MThd");
  assert.equal(u32(4), 6);
  const ppq = (bytes[12] << 8) | bytes[13];
  assert.equal(text(14, 4), "MTrk");
  const length = u32(18);
  assert.equal(22 + length, bytes.length, "the track length matches the file");
  let i = 22;
  let tick = 0;
  const notes = [];
  const meta = {};
  const vlq = () => {
    let v = 0;
    for (;;) {
      const b = bytes[i++];
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
  };
  while (i < bytes.length) {
    tick += vlq();
    const status = bytes[i++];
    if (status === 0xff) {
      const type = bytes[i++];
      const len = vlq();
      meta[type] = bytes.slice(i, i + len);
      i += len;
    } else {
      const [a, b] = [bytes[i++], bytes[i++]];
      if ((status & 0xf0) === 0x90) notes.push({ tick, note: a, velocity: b, channel: status & 0x0f });
    }
  }
  return { ppq, notes, meta, endTick: tick };
}

test("the song becomes General MIDI drums, every hit where it is heard", () => {
  const beat = setBeatName(starterBeat(), "Song for Brian");
  const { ppq, notes, meta, endTick } = parse(beatToMidi(beat));
  assert.equal(ppq, 480);
  const tempo = (meta[0x51][0] << 16) | (meta[0x51][1] << 8) | meta[0x51][2];
  assert.equal(tempo, 600000, "100 BPM is 600,000 microseconds a quarter");
  assert.deepEqual([...meta[0x58]], [4, 2, 24, 8]);
  assert.equal(new TextDecoder().decode(meta[0x03]), "Song for Brian");
  assert.ok(notes.every((n) => n.channel === 9), "channel 10");

  const seq = new Sequencer(() => beat, { type: "song", loop: false, from: 0 }, 0);
  const hits = [];
  for (let e = seq.take(); e; e = seq.take()) if (e.type === "hit") hits.push(e);
  assert.equal(notes.length, hits.length);
  assert.equal(notes[0].tick, 0);
  assert.equal(endTick, 8 * 4 * 480, "eight bars of 4/4");
  const snare = notes.filter((n) => n.note === 38);
  assert.equal(snare[0].tick, 480, "the first backbeat on beat 2");
});

test("12/8 counts in dotted quarters; one part can be written alone", () => {
  let beat = setMeter(starterBeat(), "12/8");
  beat = setTempo(beat, 80);
  const { meta, endTick } = parse(beatToMidi(beat, { part: beat.parts[0].id, bars: 2 }));
  assert.deepEqual([...meta[0x58]], [12, 3, 36, 8]);
  const tempo = (meta[0x51][0] << 16) | (meta[0x51][1] << 8) | meta[0x51][2];
  assert.equal(tempo, 500000, "dotted quarter 80 is quarter 120");
  assert.equal(endTick, 2 * 4 * 720);
});

test("file names come from the beat's name", () => {
  assert.equal(midiFileName(setBeatName(starterBeat(), "Pāʻina Groove #2")), "paina-groove-2.mid");
  assert.equal(midiFileName(starterBeat()), "rock-works-beat.mid");
});
