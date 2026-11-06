// Share links: the musical settings as short query parameters, so a teacher can send a practice
// setup. Only settings go in. Never a preset's name or anything about the person, and never this
// device's volume. Reading a link validates every field and reports the ones it had to drop.
import { DEFAULT_CONFIG, POLY_NOTES, VOICE_IDS, sanitizeConfig } from "./config.js";
import { cellsOf, defaultAccents, defaultGroups, defaultSubdivision, parseGroups, validGroups } from "./rhythm.js";

const KEYS = ["v", "bpm", "ts", "g", "beat", "sub", "acc", "snd", "sv", "ci", "tm", "te", "tr", "tb", "sb", "sw", "poly", "pv", "pvol"];
const ACCENT_CODE = { strong: "s", normal: "n", silent: "x" };
const CODE_ACCENT = { s: "strong", n: "normal", x: "silent" };

const intIn = (text, min, max) => {
  if (typeof text !== "string" || !/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
};

const pct = (v) => String(Math.round(v * 100));

export function hasShareParams(params) {
  return KEYS.some((k) => params.has(k) && k !== "v");
}

export function toSearchParams(config) {
  const c = sanitizeConfig(config);
  const p = new URLSearchParams();
  p.set("v", "1");
  p.set("bpm", String(c.tempo));
  p.set("ts", `${c.meter.beats}-${c.meter.unit}`);
  if (c.meter.groups.join("-") !== defaultGroups(c.meter.beats, c.meter.unit).join("-")) p.set("g", c.meter.groups.join("-"));
  if (c.meter.unit === 8) p.set("beat", c.meter.pulse === "group" ? "dq" : "e");
  if (c.subdivision !== defaultSubdivision(c.meter)) p.set("sub", String(c.subdivision));
  if (c.accents.join() !== defaultAccents(c.meter).join()) p.set("acc", c.accents.map((a) => ACCENT_CODE[a]).join(""));
  if (c.sound.voice !== DEFAULT_CONFIG.sound.voice) p.set("snd", c.sound.voice);
  if (c.sound.subVolume !== DEFAULT_CONFIG.sound.subVolume) p.set("sv", pct(c.sound.subVolume));
  if (c.practice.countIn) p.set("ci", String(c.practice.countIn));
  if (c.practice.timerMinutes) {
    p.set("tm", String(c.practice.timerMinutes));
    p.set("te", c.practice.timerEnd);
  }
  if (c.training.mode === "builder") {
    const b = c.training.builder;
    p.set("tr", "builder");
    p.set("tb", [b.start, b.target, b.step, b.bars, b.atTarget].join("-"));
  } else if (c.training.mode === "silent") {
    const s = c.training.silent;
    p.set("tr", "silent");
    p.set("sb", [s.play, s.rest, s.showCues ? "show" : "hide"].join("-"));
  }
  if (c.advanced.swing !== 50) p.set("sw", String(c.advanced.swing));
  if (c.advanced.poly.on) {
    p.set("poly", String(c.advanced.poly.notes));
    if (c.advanced.poly.voice !== DEFAULT_CONFIG.advanced.poly.voice) p.set("pv", c.advanced.poly.voice);
    if (c.advanced.poly.volume !== DEFAULT_CONFIG.advanced.poly.volume) p.set("pvol", pct(c.advanced.poly.volume));
  }
  return p;
}

export function shareUrl(config, origin, path = "/tools/metronome") {
  return `${origin}${path}?${toSearchParams(config).toString()}`;
}

// Reads a link's settings. Returns null when the link carries none; otherwise the config (always
// valid) and the plain names of any settings that were unreadable and left at their defaults.
export function fromSearchParams(params) {
  if (!hasShareParams(params)) return null;
  const issues = [];
  const raw = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const get = (k) => (params.has(k) ? params.get(k) : null);
  const bad = (label) => {
    if (!issues.includes(label)) issues.push(label);
  };

  const ts = get("ts");
  if (ts !== null) {
    const m = /^(\d{1,2})-(4|8)$/.exec(ts);
    const beats = m ? Number(m[1]) : 0;
    if (m && beats >= 1 && beats <= 16) {
      raw.meter = { beats, unit: Number(m[2]), groups: defaultGroups(beats, Number(m[2])), pulse: "count" };
    } else {
      bad("time signature");
    }
  }
  const g = get("g");
  if (g !== null) {
    const groups = parseGroups(g);
    if (groups && validGroups(groups, raw.meter.beats)) raw.meter.groups = groups;
    else bad("grouping");
  }
  const beat = get("beat");
  if (beat !== null) {
    if (beat === "dq" && raw.meter.unit === 8) raw.meter.pulse = "group";
    else if ((beat === "e" && raw.meter.unit === 8) || (beat === "q" && raw.meter.unit === 4)) raw.meter.pulse = "count";
    else bad("beat");
  } else if (raw.meter.unit === 8) {
    raw.meter.pulse = undefined; // let the meter's own default decide
  }
  // Resolve the meter now, so the accents and subdivision below are checked against it.
  const meter = sanitizeConfig(raw).meter;
  raw.meter = meter;
  raw.accents = defaultAccents(meter);
  raw.subdivision = defaultSubdivision(meter);

  const bpm = get("bpm");
  if (bpm !== null) {
    const n = intIn(bpm, 20, 300);
    if (n === null) bad("tempo");
    else raw.tempo = n;
  }
  const sub = get("sub");
  if (sub !== null) {
    const n = intIn(sub, 1, 6);
    const probe = sanitizeConfig({ ...raw, subdivision: n });
    if (n === null || probe.subdivision !== n) bad("subdivision");
    else raw.subdivision = n;
  }
  const acc = get("acc");
  if (acc !== null) {
    if (/^[snx]{1,16}$/.test(acc) && acc.length === cellsOf(meter).length) raw.accents = [...acc].map((ch) => CODE_ACCENT[ch]);
    else bad("accents");
  }
  const snd = get("snd");
  if (snd !== null) {
    if (VOICE_IDS.includes(snd)) raw.sound.voice = snd;
    else bad("sound");
  }
  const sv = get("sv");
  if (sv !== null) {
    const n = intIn(sv, 0, 100);
    if (n === null) bad("subdivision volume");
    else raw.sound.subVolume = n / 100;
  }
  const ci = get("ci");
  if (ci !== null) {
    const n = intIn(ci, 0, 2);
    if (n === null) bad("count-in");
    else raw.practice.countIn = n;
  }
  const tm = get("tm");
  if (tm !== null) {
    const n = intIn(tm, 1, 120);
    const te = get("te") ?? "stop";
    if (n === null || !["stop", "continue"].includes(te)) bad("timer");
    else raw.practice = { ...raw.practice, timerMinutes: n, timerEnd: te };
  }
  const tr = get("tr");
  if (tr !== null) {
    if (tr === "builder") {
      const m = /^(\d{1,3})-(\d{1,3})-(\d{1,2})-(\d{1,2})-(hold|stop)$/.exec(get("tb") ?? "");
      const start = m && intIn(m[1], 20, 300);
      const target = m && intIn(m[2], 20, 300);
      const step = m && intIn(m[3], 1, 50);
      const bars = m && intIn(m[4], 1, 64);
      if (start && target && step && bars) {
        raw.training = { ...raw.training, mode: "builder", builder: { start, target, step, bars, atTarget: m[5] } };
      } else {
        bad("tempo builder");
      }
    } else if (tr === "silent") {
      const m = /^(\d{1,2})-(\d{1,2})-(show|hide)$/.exec(get("sb") ?? "");
      const play = m && intIn(m[1], 1, 16);
      const rest = m && intIn(m[2], 1, 16);
      if (play && rest) {
        raw.training = { ...raw.training, mode: "silent", silent: { play, rest, showCues: m[3] === "show" } };
      } else {
        bad("silent bars");
      }
    } else {
      bad("training");
    }
  }
  const sw = get("sw");
  if (sw !== null) {
    const n = intIn(sw, 50, 75);
    if (n === null) bad("swing");
    else raw.advanced.swing = n;
  }
  const poly = get("poly");
  if (poly !== null) {
    const n = intIn(poly, 2, 9);
    if (n === null || !POLY_NOTES.includes(n)) {
      bad("polyrhythm");
    } else {
      raw.advanced.poly = { ...raw.advanced.poly, on: true, notes: n };
      const pv = get("pv");
      if (pv !== null) {
        if (VOICE_IDS.includes(pv)) raw.advanced.poly.voice = pv;
        else bad("polyrhythm sound");
      }
      const pvol = get("pvol");
      if (pvol !== null) {
        const v = intIn(pvol, 0, 100);
        if (v === null) bad("polyrhythm volume");
        else raw.advanced.poly.volume = v / 100;
      }
    }
  }

  const config = sanitizeConfig(raw);
  if (bpm !== null && raw.tempo !== config.tempo) bad("tempo");
  return { config, issues };
}
