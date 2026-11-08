// The starting point for a month of practice on one song: four weeks, each with a few small practice
// checkpoints and one larger assessment that connects them. It's only ever a draft, for the teacher to
// change before setting it (teacher.routes.js), and it's built from the sections the song's chart really
// has: a song with no chorus gets no chorus task, and with no chart there's nothing to suggest.
const { addDays } = require("./zoned");
const { HELP_NAMES } = require("./assignments");

const WEEK_TITLES = ["Learn the parts", "Connect the parts", "Build independence", "Perform"];
const CRITERIA = ["Steady timing", "Accurate notes or chords", "Clean transitions", "The week's technique goal"];

// Each week's help, speed and what its assessment is recorded as. The checkpoints are always audio.
const WEEKS = [
  { support: "guide", targetSpeed: 80, media: "audio" },
  { support: "chart", targetSpeed: 90, media: "audio" },
  { support: "solo", targetSpeed: 100, media: "video" },
  { support: "solo", targetSpeed: 100, media: "video" },
];

// How much of the song week 3's run-through covers, at least.
const RUN_THROUGH_SHARE = 0.6;

const round = (n) => Math.round(n * 1000) / 1000;
const lower = (name) => name.charAt(0).toLowerCase() + name.slice(1);
// A section in a sentence: "the intro", but "verse 1".
const the = (name) => (/\d/.test(name) ? lower(name) : `the ${lower(name)}`);

// Every section in the chart, in order: where it starts and ends, and when each of its bars starts.
function sectionsOf(chart) {
  const sections = chart?.sections ?? [];
  return sections
    .map((s, i) => ({ name: s.name, start: s.bars?.[0]?.time, end: sections[i + 1]?.bars?.[0]?.time ?? chart.end, bars: (s.bars ?? []).map((b) => b.time) }))
    .filter((s) => s.name && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .map((s) => ({ ...s, start: round(s.start), end: round(s.end) }));
}

// One section, or two joined up: what's between them is part of it, and the name says so.
function span(from, to) {
  if (from === to) return { section: from.name, sectionStart: from.start, sectionEnd: from.end };
  const next = Math.abs(from.end - to.start) < 0.01;
  return { section: `${from.name} ${next ? "+" : "to"} ${to.name}`, sectionStart: from.start, sectionEnd: to.end };
}

// The last two bars of one section running into the first two of the next.
function transition(from, to) {
  const start = from.bars[Math.max(0, from.bars.length - 2)];
  const end = to.bars[2] ?? to.end;
  return { section: `${from.name} into ${to.name}`, sectionStart: round(start), sectionEnd: round(end) };
}

const part = (section) => span(section, section);

// { weekTitles, tasks, sections }: tasks ready to be edited and sent back to POST /teacher/months.
// readsChart keeps the chart in the "On my own" weeks, for a student who is learning to read it.
function buildMonth(chart, { startsOn, level, readsChart = false }) {
  const sections = sectionsOf(chart);
  const about = sections.map(({ name, start, end }) => ({ name, start, end }));
  const tasks = [];
  if (!sections.length) return { weekTitles: [...WEEK_TITLES], tasks, sections: about };

  const help = (week) => (readsChart && WEEKS[week - 1].support === "solo" ? "chart" : WEEKS[week - 1].support);
  const how = (week) => (help(week) === "solo" ? "from memory, with On my own on" : `with ${HELP_NAMES[help(week)]} on`);
  const add = (week, kind, where, instruction) =>
    tasks.push({
      week,
      kind,
      ...where,
      instruction,
      level,
      media: kind === "assessment" ? WEEKS[week - 1].media : "audio",
      audioAllowed: false,
      support: help(week),
      targetSpeed: WEEKS[week - 1].targetSpeed,
      dueOn: addDays(startsOn, week * 7 - 1),
      criteria: kind === "assessment" ? [...CRITERIA] : [],
      reviewCheckpoint: false,
    });

  const named = (word) => sections.find((s) => new RegExp(`^${word}`, "i").test(s.name));
  const verse = named("verse");
  const chorus = named("chorus");
  // The first parts to learn. A song whose sections have other names starts with its first few.
  let parts = [named("intro"), verse, chorus].filter(Boolean);
  if (parts.length < 2) parts = sections.slice(0, 3);
  parts = [...parts].sort((a, b) => a.start - b.start);
  const practised = new Set(parts);

  // Week 1: each part on its own, then two of them joined up.
  for (const p of parts) add(1, "checkpoint", part(p), `Learn ${the(p.name)} ${how(1)}. Loop it until the changes feel steady, then record a take and save it.`);
  const [from, to] = verse && chorus ? [verse, chorus].sort((a, b) => a.start - b.start) : [parts[0], parts[parts.length - 1]];
  const firstJoin = span(from, to);
  add(1, "assessment", firstJoin, `Record ${firstJoin.section} in one go with the band, ${how(1)}.`);

  // Week 2: the joins between sections, then everything learned so far.
  const learned = sections.indexOf(parts[parts.length - 1]);
  for (let i = 0; i <= learned && i + 1 < sections.length && i < 3; i++) {
    const join = transition(sections[i], sections[i + 1]);
    add(2, "checkpoint", join, `Play from the end of ${the(sections[i].name)} into ${the(sections[i + 1].name)}, ${how(2)}. Slow down for any change that trips you up, then record a take and save it.`);
  }
  const soFar = span(sections[0], sections[learned]);
  add(2, "assessment", soFar, `Record the sections you've learned so far in one go: ${soFar.section}, ${how(2)}.`);

  // Week 3: sections without the guide, your teacher's notes, then a long run-through.
  const nextUp = sections.slice(learned + 1, learned + 3);
  for (const p of nextUp.length ? nextUp : parts.slice(-2)) {
    practised.add(p);
    add(3, "checkpoint", part(p), `Play ${the(p.name)} ${how(3)}. Loop it until you can keep going without looking, then record a take and save it.`);
  }
  add(3, "checkpoint", { section: "Earlier feedback", sectionStart: null, sectionEnd: null }, "Go back to the moments in your teacher's notes from weeks 1 and 2. Work on each one, then record the spot that needed the most and save it.");
  const songStart = sections[0].start;
  const songLength = sections[sections.length - 1].end - songStart;
  const stop = sections.find((s) => s.end - songStart >= songLength * RUN_THROUGH_SHARE) ?? sections[sections.length - 1];
  const runThrough = span(sections[0], stop);
  add(3, "assessment", runThrough, `Film a run-through of ${runThrough.section}, ${how(3)}. Keep going if something slips: it's about how it holds together.`);

  // Week 4: what's left, and the song or an arrangement agreed with the teacher.
  add(4, "checkpoint", { section: "Trouble spots", sectionStart: null, sectionEnd: null }, "Record the spots your teacher's week 3 notes point to, one at a time, until they feel secure. Save your best take of each.");
  for (const p of sections.filter((s) => !practised.has(s)).slice(0, 2)) {
    add(4, "checkpoint", part(p), `Play ${the(p.name)} ${how(4)}, then record a take and save it.`);
  }
  add(4, "assessment", { section: "Whole song or agreed arrangement", sectionStart: null, sectionEnd: null }, `Film the whole song with the band, ${how(4)}, or the arrangement you and your teacher agreed on. If the whole song is too much this month, ask your teacher about a shorter arrangement.`);

  return { weekTitles: [...WEEK_TITLES], tasks, sections: about };
}

module.exports = { WEEK_TITLES, CRITERIA, sectionsOf, buildMonth };
