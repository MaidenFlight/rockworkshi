// The two training modes, as plain arithmetic over bars played. The sequencer asks these at the
// start of every bar, so a change of tempo or phase always lands on a bar line.
import { barSeconds } from "./rhythm.js";

// The tempo builder's stages: start, then a step at a time toward the target, ending exactly on
// the target even when the step doesn't divide the distance (60 to 100 by 7 ends 95, 100).
// Works downward too.
export function builderStages({ start, target, step }) {
  const size = Math.max(1, Math.abs(step));
  if (start === target) return [start];
  const dir = target > start ? 1 : -1;
  const stages = [];
  for (let t = start; dir > 0 ? t < target : t > target; t += dir * size) stages.push(t);
  stages.push(target);
  return stages;
}

// Where the builder is after `played` bars of training. Holding keeps the target from the moment
// it arrives; stopping plays one full stage at the target and then `finished` turns true.
export function builderAt(builder, played) {
  const stages = builderStages(builder);
  const bars = Math.max(1, builder.bars);
  const raw = Math.floor(played / bars);
  const finished = builder.atTarget === "stop" && raw >= stages.length;
  const stage = Math.min(raw, stages.length - 1);
  const atTarget = stage === stages.length - 1;
  const holding = atTarget && builder.atTarget === "hold";
  const barsLeft = holding ? null : bars - (played - stage * bars);
  return {
    stage,
    stages,
    tempo: stages[stage],
    barInStage: played - stage * bars,
    barsLeft,
    nextTempo: atTarget ? null : stages[stage + 1],
    atTarget,
    holding,
    finished,
  };
}

// How long the whole climb takes, played through once (holding adds nothing after the target).
export function builderSeconds(builder, meter) {
  return builderStages(builder).reduce((total, tempo) => total + builder.bars * barSeconds(meter, tempo), 0);
}

// The silent-bar cycle: `play` audible bars, then `rest` silent ones, repeating.
export function silentAt(silent, played) {
  const length = silent.play + silent.rest;
  const pos = ((played % length) + length) % length;
  const phase = pos < silent.play ? "play" : "rest";
  return {
    phase,
    pos,
    length,
    barsLeft: phase === "play" ? silent.play - pos : length - pos,
  };
}
