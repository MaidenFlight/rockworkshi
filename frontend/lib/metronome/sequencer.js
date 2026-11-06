// The musical timeline. Given a config and a start time, it hands out every click in time order:
// count-in, beats, subdivisions, the second polyrhythm layer, and a record at each bar line.
// It knows nothing about audio or the screen; the engine asks it "what's next?" on the audio
// clock. Times are in seconds on whatever clock the caller uses.
//
// When changes take effect:
// - tempo, accents, subdivision and swing: from the next beat that hasn't been handed out yet
//   (the engine looks about a tenth of a second ahead);
// - meter, grouping, presets, training and the timer: at the next bar line;
// - with a polyrhythm, tempo waits for the bar line too, so both layers stay locked to the cycle;
// - the tempo builder sets the tempo itself, one stage per bar line.
import { cellsOf, polyPositions, subPositions } from "./rhythm.js";
import { effective } from "./config.js";
import { builderAt, builderStages, silentAt } from "./training.js";

const EPS = 1e-9;
// Bar records and endings sort before clicks at the same instant, the main layer before the poly.
const ORDER = { bar: 0, end: 0, mark: 0, main: 1, poly: 2 };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function plan(config) {
  const eff = effective(config);
  return {
    cells: cellsOf(config.meter),
    subdivision: eff.subdivision,
    positions: subPositions(eff.subdivision, eff.swing),
    polyNotes: eff.polyNotes,
  };
}

// Which boundary a change from `prev` to `next` must wait for: "bar", "beat", or null when only
// the sound changed (the engine applies sound itself).
export function boundaryFor(prev, next) {
  if (!same(prev.meter, next.meter) || prev.accents.length !== next.accents.length) return "bar";
  if (!same(prev.training, next.training)) return "bar";
  if (prev.practice.timerMinutes !== next.practice.timerMinutes || prev.practice.timerEnd !== next.practice.timerEnd) return "bar";
  const pp = prev.advanced.poly;
  const np = next.advanced.poly;
  if (pp.on !== np.on || (np.on && pp.notes !== np.notes)) return "bar";
  if ((pp.on || np.on) && prev.tempo !== next.tempo) return "bar";
  if (
    prev.tempo !== next.tempo ||
    !same(prev.accents, next.accents) ||
    prev.subdivision !== next.subdivision ||
    prev.advanced.swing !== next.advanced.swing
  ) {
    return "beat";
  }
  return null;
}

// A strong first beat is the bar's own sound; other strong beats are a step down.
function levelOf(accent, cell) {
  if (accent === "strong") return cell === 0 ? "bar" : "strong";
  return accent;
}

export class Sequencer {
  constructor(config, startTime = 0) {
    this.config = config;
    this.plan = plan(config);
    this.queued = null;
    this.queuedAt = null;
    this.time = startTime; // where the next beat begins
    this.cell = 0;
    this.bar = 0; // practice bars begun; the count-in isn't counted
    this.countInTotal = config.practice.countIn;
    this.countInLeft = this.countInTotal;
    this.elapsed = 0; // practice seconds before `this.time`
    this.trainingFrom = 0; // the practice bar the current training began on
    this.timerFrom = 0; // practice seconds when the current timer began
    this.timerNoticed = false;
    this.barInfo = null;
    this.out = [];
    this.done = false;
  }

  // Takes the newest config. It applies at the boundary its changes need (see the top).
  update(config) {
    const at = boundaryFor(this.config, config);
    if (!at) {
      this.config = config;
      this.queued = null;
      this.queuedAt = null;
      return null;
    }
    this.queued = config;
    this.queuedAt = at;
    return at;
  }

  // "bar" while a change is waiting for the next bar line, "beat" for the next beat, else null.
  pending() {
    return this.queued ? this.queuedAt : null;
  }

  peek() {
    this.fill();
    return this.out[0] || null;
  }

  take() {
    this.fill();
    return this.out.shift() || null;
  }

  // Starts again at `time` after an interruption: the next bar begins there, with the count-in
  // again if there is one. Bar numbers, training progress and elapsed time carry on.
  restartAt(time) {
    this.out = [];
    if (this.cell !== 0) {
      if (this.countInLeft > 0) this.countInLeft -= 1;
      else this.bar += 1;
      this.cell = 0;
    }
    this.time = time;
    this.countInTotal = this.config.practice.countIn;
    this.countInLeft = this.countInTotal;
    this.done = false;
  }

  // ---- internals ----

  fill() {
    // A beat not generated yet starts at `this.time`, so anything queued at or after it may
    // still have something ahead of it.
    while (!this.done && (this.out.length === 0 || this.out[0].t >= this.time - EPS)) this.step();
  }

  push(event) {
    const out = this.out;
    let i = out.length;
    while (i > 0 && (out[i - 1].t > event.t + EPS || (Math.abs(out[i - 1].t - event.t) <= EPS && ORDER[out[i - 1].type] > ORDER[event.type]))) i -= 1;
    out.splice(i, 0, event);
  }

  apply(config) {
    const prev = this.config;
    this.config = config;
    this.plan = plan(config);
    this.queued = null;
    this.queuedAt = null;
    if (!same(prev.training, config.training)) this.trainingFrom = this.bar;
    if (prev.practice.timerMinutes !== config.practice.timerMinutes || prev.practice.timerEnd !== config.practice.timerEnd) {
      this.timerFrom = this.elapsed;
      this.timerNoticed = false;
    }
  }

  finish(reason) {
    this.push({ type: "end", t: this.time, reason, bar: this.bar, elapsed: this.elapsed });
    this.done = true;
  }

  startBar() {
    if (this.queued) this.apply(this.queued);
    const config = this.config;
    const counting = this.countInLeft > 0;
    let tempo = config.tempo;
    let fixed = false;
    let builder = null;
    let silent = null;
    let phase = counting ? "count" : "play";
    let timerLeft = null;

    if (!counting) {
      if (config.practice.timerMinutes > 0) {
        const limit = this.timerFrom + config.practice.timerMinutes * 60;
        timerLeft = Math.max(0, limit - this.elapsed);
        if (this.elapsed >= limit - 1e-6) {
          if (config.practice.timerEnd === "stop") {
            this.finish("timer");
            return;
          }
          if (!this.timerNoticed) {
            this.timerNoticed = true;
            this.push({ type: "mark", t: this.time, reason: "timer" });
          }
        }
      }
      const played = this.bar - this.trainingFrom;
      if (config.training.mode === "builder") {
        builder = builderAt(config.training.builder, played);
        if (builder.finished) {
          this.finish("target");
          return;
        }
        tempo = builder.tempo;
        fixed = true;
      } else if (config.training.mode === "silent") {
        silent = silentAt(config.training.silent, played);
        phase = silent.phase;
      }
    } else if (config.training.mode === "builder") {
      // Count in at the tempo the climb starts from.
      tempo = builderStages(config.training.builder)[0];
      fixed = true;
    }
    if (this.plan.polyNotes) fixed = true;

    const beat = 60 / tempo;
    const cells = this.plan.cells.length;
    this.barInfo = {
      type: "bar",
      t: this.time,
      bar: this.bar,
      countIn: counting,
      countInBar: counting ? this.countInTotal - this.countInLeft + 1 : null,
      countInBars: this.countInTotal,
      tempo,
      fixedTempo: fixed ? tempo : null,
      cells,
      duration: fixed ? beat * cells : null,
      phase,
      builder,
      silent,
      elapsed: this.elapsed,
      timerLeft,
      polyNotes: counting ? 0 : this.plan.polyNotes,
    };
    this.push(this.barInfo);

    if (!counting && this.plan.polyNotes) {
      const duration = beat * cells;
      polyPositions(this.plan.polyNotes).forEach((at, note) => {
        this.push({
          type: "poly",
          t: this.time + at * duration,
          bar: this.bar,
          note,
          notes: this.plan.polyNotes,
          level: note === 0 ? "strong" : "normal",
          audible: phase !== "rest",
          barStart: this.time,
          duration,
        });
      });
    }
  }

  step() {
    if (this.cell === 0) {
      this.startBar();
      if (this.done) return;
    } else if (this.queued && this.queuedAt === "beat") {
      this.apply(this.queued);
    }
    const info = this.barInfo;
    const counting = info.countIn;
    const tempo = info.fixedTempo ?? this.config.tempo;
    const beat = 60 / tempo;
    const cell = this.cell;
    const first = counting ? (cell === 0 ? "bar" : "normal") : levelOf(this.config.accents[cell], cell);
    const positions = counting ? [0] : this.plan.positions;
    const audibleBar = info.phase !== "rest";
    positions.forEach((at, sub) => {
      const level = sub === 0 ? first : "sub";
      this.push({
        type: "main",
        t: this.time + at * beat,
        bar: info.bar,
        countIn: counting,
        cell,
        sub,
        subs: positions.length,
        level,
        audible: audibleBar && level !== "silent",
        beatStart: this.time,
        beat,
        tempo,
        elapsed: this.elapsed,
      });
    });
    this.time += beat;
    if (!counting) this.elapsed += beat;
    this.cell += 1;
    if (this.cell >= this.plan.cells.length) {
      this.cell = 0;
      if (counting) this.countInLeft -= 1;
      else this.bar += 1;
    }
  }
}
