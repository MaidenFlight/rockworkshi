// Plays hits on one AudioContext, live or offline, through a small mixer: a level per drum (the
// Kit tab's faders) into one kit bus, and before it a mute that only the beat's hits go through, so
// a drum muted to play along with still sounds when you play it. Hits overlap freely; a sound that is hit again
// while it rings keeps ringing until it has too many voices, then the oldest fades. A closed or
// pedalled hi-hat stops an open one, as on a real stand.
import { PIECES, PIECE_BY_ID, layerFor, nextRoundRobin } from "./kit.js";

const CHOKE_TIME = 0.012; // seconds: how fast a closing hi-hat silences an open one
const STEAL_TIME = 0.03; // how fast a voice over the limit fades
const HUMANIZE_DB = 0.6; // sequenced hits vary this much in level, like a real player

const smooth = (param, value, now) => {
  if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
  else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.setTargetAtTime(value, now, 0.015);
};

export class KitVoices {
  // `getSample(file)` returns { buffer, offset } or null; `output` is where the kit bus goes.
  constructor(ctx, output, getSample) {
    this.ctx = ctx;
    this.getSample = getSample;
    this.bus = ctx.createGain();
    this.bus.connect(output);
    this.gains = {};
    this.beatGains = {};
    for (const p of PIECES) {
      const level = ctx.createGain();
      level.connect(this.bus);
      this.gains[p.id] = level;
      const beat = ctx.createGain();
      beat.connect(level);
      this.beatGains[p.id] = beat;
    }
    this.voices = {}; // piece -> [{ src, gain, start, tag }]
    this.lastPick = {};
  }

  // mix: { piece: volume } (missing means 1); muted: [piece]
  setMix(mix = {}, muted = [], { immediate = false } = {}) {
    const now = this.ctx.currentTime;
    for (const p of PIECES) {
      const level = mix[p.id] ?? 1;
      const open = muted.includes(p.id) ? 0 : 1;
      if (immediate) {
        this.gains[p.id].gain.value = level;
        this.beatGains[p.id].gain.value = open;
      } else {
        smooth(this.gains[p.id].gain, level, now);
        smooth(this.beatGains[p.id].gain, open, now);
      }
    }
  }

  // Plays `piece` at `level` (1 ghost, 2 hit, 3 accent) at time `t`. `tag` marks who asked, so
  // Stop can silence the sequencer's hits without cutting off a pad played by hand. `velocityGain`
  // scales this one hit, for a MIDI note that says how hard it was played.
  hit(piece, level, t, { tag = "live", humanize = false, velocityGain = 1 } = {}) {
    const p = PIECE_BY_ID[piece];
    if (!p || !level) return false;
    const layer = layerFor(p, level);
    const key = `${piece}:${level}`;
    const pick = nextRoundRobin(layer.files.length, this.lastPick[key]);
    this.lastPick[key] = pick;
    const sample = this.getSample(layer.files[pick]) || layer.files.map((f) => this.getSample(f)).find(Boolean);
    if (!sample) return false;
    const ctx = this.ctx;
    // Never in the past: a start time behind the clock would be heard late, not early.
    const when = Math.max(t, ctx.currentTime);

    for (const target of p.chokes || []) this.choke(target, when);

    const list = (this.voices[piece] ||= []);
    while (list.length >= p.voices) this.release(list.shift(), when, STEAL_TIME);

    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    const gain = ctx.createGain();
    const vary = humanize ? 10 ** (((Math.random() * 2 - 1) * HUMANIZE_DB) / 20) : 1;
    gain.gain.value = layer.gain * vary * velocityGain;
    src.connect(gain);
    gain.connect(tag === "seq" ? this.beatGains[piece] : this.gains[piece]);
    const voice = { src, gain, start: when, tag, stopping: false };
    list.push(voice);
    src.onended = () => {
      const i = list.indexOf(voice);
      if (i >= 0) list.splice(i, 1);
      try {
        gain.disconnect();
      } catch {
        // Already gone.
      }
    };
    src.start(when, Math.min(sample.offset, Math.max(0, sample.buffer.duration - 0.01)));
    return true;
  }

  // Fades a voice out from time `t`.
  release(voice, t, time) {
    if (!voice || voice.stopping) return;
    voice.stopping = true;
    try {
      voice.gain.gain.setTargetAtTime(0, Math.max(t, voice.start), time);
      voice.src.stop(Math.max(t, voice.start) + time * 8);
    } catch {
      // Already stopped.
    }
  }

  // Silences what `piece` started before `t` (a closing hi-hat on an open one).
  choke(piece, t) {
    for (const v of [...(this.voices[piece] || [])]) {
      if (v.start < t) {
        this.release(v, t, CHOKE_TIME);
        const list = this.voices[piece];
        list.splice(list.indexOf(v), 1);
      }
    }
  }

  // Stops every voice with this tag, quickly but without a click. Hits booked for later never sound.
  stopTagged(tag, fade = 0.02) {
    const now = this.ctx.currentTime;
    for (const list of Object.values(this.voices)) {
      for (const v of [...list]) {
        if (v.tag !== tag) continue;
        if (v.start > now) {
          try {
            v.src.stop();
          } catch {
            // Already stopped.
          }
          v.stopping = true;
        } else {
          this.release(v, now, fade);
        }
        list.splice(list.indexOf(v), 1);
      }
    }
  }

  disconnect() {
    try {
      this.bus.disconnect();
    } catch {
      // Already gone.
    }
  }
}
