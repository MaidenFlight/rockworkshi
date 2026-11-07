// Turns a beat into timed events, one grid step at a time, for the engine to book on the audio
// clock. Pure: no audio, no timers, no DOM, so every timing rule is tested on its own.
//
// It reads the beat afresh at every step, so an edit, a new tempo or a new swing is heard from
// the next step on, while the music keeps going. Events, in time order:
//   { type: "bar",   t, bar, part, block, barInBlock, songBar, crash, countIn }
//   { type: "step",  t, dur, bar, step, steps, part, block, songBar, countIn }
//   { type: "click", t, level: "bar" | "normal", countIn }
//   { type: "hit",   t, piece, level, bar, step, part }
//   { type: "end",   t }   the song has finished (only when it doesn't loop)
// `bar` counts from 0 at the first bar of music; count-in bars are negative.
import { GRID_ORDER, LEVEL } from "./kit.js";
import { meterOf, partById, songBars, stepOffsets, stepsPerBar } from "./beat.js";

// On the 1 of a block that starts on a crash, the hand that keeps time moves to the crash.
const CRASH_REPLACES = new Set(["hatClosed", "hatOpen", "ride"]);

// How many bars of the song come before block `index`.
export function barsBefore(beat, index) {
  return songBars(beat).findIndex((b) => b.block === index);
}

export class Sequencer {
  // mode: { type: "part", part } loops one part; { type: "song", loop, from } plays the song,
  // from block `from`. `click()` says whether the metronome click is on (read every beat).
  constructor(getBeat, mode, startTime, { countInBars = 0, click = () => false } = {}) {
    this.getBeat = getBeat;
    this.mode = mode;
    this.click = click;
    this.countInBars = Math.max(0, Math.min(2, countInBars | 0));
    this.queue = [];
    this.t = startTime;
    this.bar = 0 - this.countInBars; // (not -n: -0 would be a bar of its own to deepEqual)
    this.step = 0;
    this.done = false;
    this.skips = new Set();
    const beat = getBeat();
    this.songStart = mode.type === "song" ? Math.max(0, barsBefore(beat, mode.from || 0)) : 0;
  }

  // What plays in bar `bar`: its part, where it sits in the song, and whether it's a count-in.
  // Null once a song that doesn't loop has run out.
  barInfo(beat, bar) {
    if (bar < 0) return { countIn: true, countInBar: bar + this.countInBars, countInBars: this.countInBars, part: null, block: null, barInBlock: null, songBar: null, crash: false };
    if (this.mode.type === "part") return { countIn: false, part: this.mode.part, block: null, barInBlock: bar, songBar: null, crash: false };
    const list = songBars(beat);
    if (!list.length) return null;
    let index = this.songStart + bar;
    if (index >= list.length) {
      if (!this.mode.loop) return null;
      index %= list.length;
    }
    const b = list[index];
    return { countIn: false, part: b.part, block: b.block, barInBlock: b.barInBlock, songBar: index, crash: b.crash };
  }

  // A recorded note that will be heard live: don't play it again when the loop reaches it.
  skip(bar, step, piece) {
    this.skips.add(`${bar}:${step}:${piece}`);
  }

  // While looping a part: move to another part at the start of the next bar, in time.
  queuePart(part) {
    if (this.mode.type === "part") this.nextPart = part;
  }

  peek() {
    while (!this.queue.length && !this.done) this.fill();
    return this.queue[0] || null;
  }

  take() {
    const e = this.peek();
    if (e) this.queue.shift();
    return e;
  }

  // Books the events of the next step.
  fill() {
    const beat = this.getBeat();
    const meter = meterOf(beat);
    const steps = stepsPerBar(meter);
    // The meter changed mid-bar to a shorter one: start the next bar.
    if (this.step >= steps) {
      this.step = 0;
      this.bar += 1;
    }
    if (this.step === 0 && this.nextPart && this.bar >= 0) {
      this.mode = { ...this.mode, part: this.nextPart };
      this.nextPart = null;
    }
    const info = this.barInfo(beat, this.bar);
    if (!info) {
      this.queue.push({ type: "end", t: this.t });
      this.done = true;
      return;
    }
    const offsets = stepOffsets(meter, beat.swing, beat.swingUnit);
    const sub = this.step % meter.division;
    const beatIndex = (this.step - sub) / meter.division;
    const next = sub + 1 < meter.division ? offsets[sub + 1] : 1;
    const dur = ((next - offsets[sub]) * 60) / beat.tempo;
    const t = this.t;
    const where = { part: info.part, block: info.block, songBar: info.songBar, countIn: info.countIn };

    if (this.step === 0) this.queue.push({ type: "bar", t, bar: this.bar, barInBlock: info.barInBlock, crash: info.crash, ...where });
    this.queue.push({ type: "step", t, dur, bar: this.bar, step: this.step, steps, ...where });
    if (sub === 0 && (info.countIn || this.click())) {
      this.queue.push({ type: "click", t, level: beatIndex === 0 ? "bar" : "normal", countIn: info.countIn });
    }
    if (!info.countIn) {
      const part = partById(beat, info.part);
      const crashHere = info.crash && this.step === 0;
      if (part) {
        for (const piece of GRID_ORDER) {
          let level = part.notes[piece]?.[this.step] || 0;
          if (crashHere && piece === "crash") level = Math.max(level, LEVEL.accent);
          else if (crashHere && CRASH_REPLACES.has(piece)) level = 0;
          if (!level) continue;
          const key = `${this.bar}:${this.step}:${piece}`;
          if (this.skips.has(key)) {
            this.skips.delete(key);
            continue;
          }
          this.queue.push({ type: "hit", t, piece, level, bar: this.bar, step: this.step, part: info.part });
        }
      }
    }

    this.t += dur;
    this.step += 1;
    if (this.step >= steps) {
      this.step = 0;
      this.bar += 1;
    }
  }
}

// Where a note played at `time` belongs, given the step it fell in (`e`, a step event): the
// nearer of that step and the one after. Returns { bar, step, part } or null (in the count-in,
// or past the end of the song).
export function quantize(seq, beat, e, time) {
  if (!e) return null;
  const late = time - e.t > e.t + e.dur - time;
  if (!late) return e.countIn ? null : { bar: e.bar, step: e.step, part: e.part };
  if (e.step + 1 < e.steps) return e.countIn ? null : { bar: e.bar, step: e.step + 1, part: e.part };
  const info = seq.barInfo(beat, e.bar + 1);
  if (!info || info.countIn) return null;
  return { bar: e.bar + 1, step: 0, part: info.part };
}
