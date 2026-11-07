// The player's speed trainer: a loop played a few times at each speed, stepping up to the top speed
// the student set (60% → 70% → 80% …). Plain arithmetic over passes of the loop: the player asks it
// at the end of each pass, so a change of speed always lands on the loop's start. It never goes past
// the top speed, and it only ever runs because the student started it.
import { builderStages } from "./metronome/training.js";

export const TRAINER_DEFAULTS = { start: 60, step: 10, passes: 2, top: 100 };

// The choices offered, in percent (passes are a count).
export const TRAINER_CHOICES = {
  start: [50, 60, 70, 80, 90],
  step: [5, 10, 15, 20],
  passes: [1, 2, 3, 4, 6, 8],
  top: [70, 80, 90, 100],
};

// Settings from storage or the form, made safe: offered choices only, and a top speed no lower than
// the start (every start from 70 up is also a top choice).
export function trainerSettings(raw) {
  const pick = (key) => {
    const n = Number(raw?.[key]);
    return TRAINER_CHOICES[key].includes(n) ? n : TRAINER_DEFAULTS[key];
  };
  const settings = { start: pick("start"), step: pick("step"), passes: pick("passes"), top: pick("top") };
  if (settings.top < settings.start) settings.top = settings.start;
  return settings;
}

// The speeds it plays, as fractions of full speed: 0.6, 0.7 … 1. It ends exactly on the top speed
// even when the step doesn't divide the way there (60 to 100 by 15 is 60, 75, 90, 100).
export function trainerSpeeds(settings) {
  return builderStages({ start: settings.start, target: settings.top, step: settings.step }).map((p) => p / 100);
}

// A new run: the first speed, no passes played yet.
export function startRun(settings) {
  const speeds = trainerSpeeds(settings);
  return { stage: 0, pass: 0, speed: speeds[0], atTop: speeds.length === 1 };
}

// After one more pass of the loop: the same speed, or the next once enough passes are in. At the
// top speed it stays there until the student stops it (or records, which plays at full speed).
export function afterPass(settings, run) {
  const speeds = trainerSpeeds(settings);
  const last = speeds.length - 1;
  if (run.stage >= last) return { stage: last, pass: run.pass + 1, speed: speeds[last], atTop: true };
  const pass = run.pass + 1;
  if (pass < settings.passes) return { ...run, pass };
  const stage = run.stage + 1;
  return { stage, pass: 0, speed: speeds[stage], atTop: stage === last };
}

const percent = (fraction) => `${Math.round(fraction * 100)}%`;

// What it's doing, in words: "Pass 1 of 2 at 60% · next 70%", or "At 100%, your top speed".
export function trainerStatus(settings, run) {
  if (run.atTop) return `At ${percent(run.speed)}, your top speed`;
  return `Pass ${run.pass + 1} of ${settings.passes} at ${percent(run.speed)} · next ${percent(trainerSpeeds(settings)[run.stage + 1])}`;
}

// The settings in one line: "60% up to 100%, +10% every 2 passes".
export function trainerPlan(settings) {
  const passes = settings.passes === 1 ? "every pass" : `every ${settings.passes} passes`;
  return `${settings.start}% up to ${settings.top}%, +${settings.step}% ${passes}`;
}
