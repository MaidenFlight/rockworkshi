// The starting point for a month of practice on one song, the way Rock Works teaches it to kids: sing it
// first, learn its chords one at a time, play them along with the band, then show what you can do. Each
// week has a few milestones (short takes, saved as practice) and one weekly assessment that pulls them
// together. It's only ever a draft for the teacher to change before setting it (routes/plans.routes.js),
// and it's built from the song's chart: its real sections, chords and bars. A song with no chart gets
// nothing, because there would be nothing true to suggest.
const { addDays } = require("./zoned");
const { HELP_NAMES } = require("./assignments");

const WEEK_TITLES = ["Sing-a-long", "Chords", "Play along", "Show what you can do"];
const CRITERIA = ["Steady timing", "Accurate notes or chords", "Clean transitions", "The week's technique goal"];
const SING_CRITERIA = ["Sings in time with the band", "Knows the words", "Follows the tune"];

// How each instrument takes part in weeks 2 and 3: chord instruments learn the song's chords, bass its
// root notes, drums its beat, and singers its tune. Week 1 is singing for everybody.
const FAMILIES = {
  chords: { week2: "Chords", criteria: ["Clear chord shapes", "Steady rhythm", "Changes on time"] },
  roots: { week2: "Root notes", criteria: ["Right notes", "Steady timing", "Changes on time"] },
  beat: { week2: "The beat", criteria: ["Steady beat", "Fills land on time", "Starts and stops with the band"] },
  voice: { week2: "The tune", criteria: ["In tune", "In time", "Clear words"] },
};
const FAMILY_OF = { Guitar: "chords", Ukulele: "chords", Piano: "chords", Bass: "roots", Drums: "beat", Voice: "voice" };
// What playing a chord sounds like on each chord instrument, for the words of its milestones.
const CHORD_WORDS = {
  Guitar: { verb: "strum", clean: "every string rings" },
  Ukulele: { verb: "strum", clean: "every string rings" },
  Piano: { verb: "play", clean: "every note sounds" },
};

// Each week's help and speed. Week 1 is singing, where the chart's help and the speed don't matter.
const WEEKS = [
  { support: null, targetSpeed: null },
  { support: "guide", targetSpeed: 80 },
  { support: "chart", targetSpeed: 90 },
  { support: "solo", targetSpeed: 100 },
];
// The song levels the weeks work at: Sing-a-long, then Chords for the rest of the month.
const LEVEL_OF_WEEK = [1, 2, 2, 2];
const MAX_CHORDS = 4;
const MAX_CHANGES = 2;

const round = (n) => Math.round(n * 1000) / 1000;

// Every section in the chart, in order: where it starts and ends, and when each of its bars starts.
function sectionsOf(chart) {
  const sections = chart?.sections ?? [];
  return sections
    .map((s, i) => ({ name: s.name, start: s.bars?.[0]?.time, end: sections[i + 1]?.bars?.[0]?.time ?? chart.end, bars: (s.bars ?? []).map((b) => b.time) }))
    .filter((s) => s.name && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .map((s) => ({ ...s, start: round(s.start), end: round(s.end) }));
}

// Every bar in the song, in order: when it starts and ends, and the chords played in it.
function barsOf(chart) {
  const sections = chart?.sections ?? [];
  const out = [];
  sections.forEach((s, i) => {
    const bars = s.bars ?? [];
    bars.forEach((b, k) => {
      const end = bars[k + 1]?.time ?? sections[i + 1]?.bars?.[0]?.time ?? chart.end;
      if (Number.isFinite(b.time) && Number.isFinite(end) && end > b.time) {
        out.push({ start: round(b.time), end: round(end), chords: (b.chords ?? []).map((c) => c.name).filter(Boolean) });
      }
    });
  });
  return out;
}

// A chord a beginner learns on its own: not a passing slash chord, and not "no chord".
const isMainChord = (name) => /^[A-G][#b]?/.test(name) && !name.includes("/");
const rootOf = (name) => /^[A-G][#b]?/.exec(name)?.[0] ?? null;
// "an Am chord", "an F chord", "a C chord".
const an = (name) => (/^[AEF]/.test(name) ? "an" : "a");

// The song's chords, in the order they first come.
function chordsOf(bars) {
  const seen = [];
  for (const bar of bars) for (const name of bar.chords) if (isMainChord(name) && !seen.includes(name)) seen.push(name);
  return seen;
}

// Where a chord can be looped on its own: the first bar that's only that chord, and the one after if it
// is too. A chord only ever played alongside another is looped in the first bar it's in.
function loopFor(bars, chord) {
  const only = (bar) => bar && bar.chords.length > 0 && bar.chords.every((c) => c === chord);
  let i = bars.findIndex(only);
  if (i < 0) i = bars.findIndex((b) => b.chords.includes(chord));
  if (i < 0) return null;
  const last = only(bars[i]) && only(bars[i + 1]) ? i + 1 : i;
  return { sectionStart: bars[i].start, sectionEnd: bars[last].end };
}

// The song's chord changes, the most played first: each with the bars where it first happens.
function changesOf(bars, key = (name) => name) {
  const found = new Map();
  const note = (from, to, where, order) => {
    if (key(from) === key(to)) return;
    const id = `${key(from)}>${key(to)}`;
    if (!found.has(id)) found.set(id, { from, to, count: 0, order, where });
    found.get(id).count += 1;
  };
  bars.forEach((bar, i) => {
    const main = bar.chords.filter(isMainChord);
    for (let n = 1; n < main.length; n++) note(main[n - 1], main[n], { sectionStart: bar.start, sectionEnd: bar.end }, i);
    const next = (bars[i + 1]?.chords ?? []).filter(isMainChord);
    if (main.length && next.length) note(main[main.length - 1], next[0], { sectionStart: bar.start, sectionEnd: bars[i + 1].end }, i);
  });
  return [...found.values()].sort((a, b) => b.count - a.count || a.order - b.order);
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

const range = (section) => ({ sectionStart: section.start, sectionEnd: section.end });
// The first two bars of a section: enough to loop a beat.
const opening = (section) => ({ sectionStart: section.start, sectionEnd: round(section.bars[2] ?? section.end) });

// { weekTitles, tasks, sections }: tasks ready to be edited and published (routes/plans.routes.js).
// instrument decides weeks 2 and 3. readsChart keeps the chart in week 4, for a student who is learning to
// read it. level is the plan's own; the weeks work at the song levels they teach.
function buildMonth(chart, { startsOn, readsChart = false, instrument } = {}) {
  const sections = sectionsOf(chart);
  const about = sections.map(({ name, start, end }) => ({ name, start, end }));
  const familyName = FAMILY_OF[instrument] ?? "chords";
  const family = FAMILIES[familyName];
  const weekTitles = [WEEK_TITLES[0], family.week2, WEEK_TITLES[2], WEEK_TITLES[3]];
  const tasks = [];
  if (!sections.length) return { weekTitles, tasks, sections: about };

  const bars = barsOf(chart);
  const help = (week) => (readsChart && WEEKS[week - 1].support === "solo" ? "chart" : WEEKS[week - 1].support);
  const how = (week) => (help(week) === "solo" ? "from memory, with On my own on" : `with ${HELP_NAMES[help(week)]} on`);
  const add = (week, kind, section, where, instruction, extra = {}) =>
    tasks.push({
      week,
      kind,
      section,
      sectionStart: where?.sectionStart ?? null,
      sectionEnd: where?.sectionEnd ?? null,
      instruction,
      level: LEVEL_OF_WEEK[week - 1],
      media: "audio",
      audioAllowed: false,
      support: help(week),
      targetSpeed: WEEKS[week - 1].targetSpeed,
      dueOn: addDays(startsOn, week * 7 - 1),
      criteria: kind === "assessment" ? [...(week === 1 ? SING_CRITERIA : family.criteria)] : [],
      reviewCheckpoint: false,
      ...extra,
    });

  const named = (word) => sections.find((s) => new RegExp(`^${word}`, "i").test(s.name));
  const verse = named("verse") ?? sections[0];
  const chorus = named("chorus") ?? sections.find((s) => s !== verse) ?? verse;
  const [first, second] = [verse, chorus].sort((a, b) => a.start - b.start);
  const wholeSong = { sectionStart: sections[0].start, sectionEnd: sections[sections.length - 1].end };
  const save = "Record a short take and save it.";
  const sing = familyName === "voice";
  const play = sing ? "Sing" : "Play";

  // Week 1: sing it. The level's video goes with it, once the school has made one.
  add(1, "checkpoint", `Sing along with ${verse.name}`, range(verse), `Listen to the whole song once, and watch the Sing-a-long video if it's up. Then loop ${verse.name} and sing along with the band. ${save}`);
  if (chorus !== verse) add(1, "checkpoint", `Sing along with ${chorus.name}`, range(chorus), `Loop ${chorus.name} and sing along until you know the words. ${save}`);
  add(1, "assessment", "Sing the whole song with the band", wholeSong, "Sing along with the whole song, start to finish. Keep going if you miss a word: it's about singing with the band. Record it and submit it.");

  // Week 2: the song's chords, one at a time, or the instrument's own part of them.
  if (familyName === "chords") {
    const words = CHORD_WORDS[instrument] ?? CHORD_WORDS.Guitar;
    for (const chord of chordsOf(bars).slice(0, MAX_CHORDS)) {
      add(2, "checkpoint", `Play ${an(chord)} ${chord} chord`, loopFor(bars, chord), `Make ${an(chord)} ${chord} chord: the player shows you the shape. Loop the bar and ${words.verb} along with the band until ${words.clean}. ${save}`);
    }
  } else if (familyName === "roots") {
    const roots = [];
    for (const chord of chordsOf(bars)) if (!roots.some((r) => r.root === rootOf(chord))) roots.push({ root: rootOf(chord), chord });
    for (const { root, chord } of roots.slice(0, MAX_CHORDS)) {
      const name = chord === root ? `Play the ${root} note` : `Play the ${root} note for ${chord}`;
      add(2, "checkpoint", name, loopFor(bars, chord), `${root} is the root note of ${chord}. Loop the bar and play ${root} along with the band, one note on each beat. ${save}`);
    }
  } else if (familyName === "beat") {
    const intro = sections[0];
    add(2, "checkpoint", "Count in and start on time", opening(intro), `Count 1, 2, 3, 4 with the band and come in right on beat 1. Loop it until you start on time every time. ${save}`);
    add(2, "checkpoint", `Play the ${verse.name} beat`, opening(verse), `Hi-hat on every beat, snare on 2 and 4, kick on 1 and 3. Loop it with the band until it feels steady. ${save}`);
    if (chorus !== verse) add(2, "checkpoint", `Play the ${chorus.name} beat`, opening(chorus), `Loop the start of ${chorus.name} and keep the same beat going with the band. ${save}`);
  } else {
    add(2, "checkpoint", `Sing the ${verse.name} tune`, range(verse), `Follow the tune in the chart and sing ${verse.name} with the band. Land on the first note of each line. ${save}`);
    if (chorus !== verse) add(2, "checkpoint", `Sing the ${chorus.name} tune`, range(chorus), `Follow the tune in the chart and sing ${chorus.name} with the band. Take a breath before each line. ${save}`);
  }
  const week2 = { chords: `${chorus.name} chords`, roots: `${chorus.name} root notes`, beat: `${chorus.name} beat`, voice: `Sing ${chorus.name}` }[familyName];
  add(2, "assessment", `${week2} with the band`, range(chorus), `${play} ${chorus.name} in one go with the band, ${how(2)}. Record it and submit it.`);

  // Week 3: moving between the chords, then playing along.
  if (familyName === "chords" || familyName === "roots") {
    const roots = familyName === "roots";
    for (const change of changesOf(bars, roots ? rootOf : undefined).slice(0, MAX_CHANGES)) {
      const [from, to] = roots ? [rootOf(change.from), rootOf(change.to)] : [change.from, change.to];
      add(3, "checkpoint", roots ? `Move from ${from} to ${to}` : `Switch ${from} to ${to}`, change.where, `Loop the change from ${from} to ${to}. Get to the new ${roots ? "note" : "chord"} right on beat 1, and slow down if you need to. ${save}`);
    }
  } else if (first !== second) {
    const into = transition(first, second);
    add(3, "checkpoint", sing ? `Sing from ${first.name} into ${second.name}` : `Play a fill into ${second.name}`, into, sing ? `Loop the end of ${first.name} into ${second.name} and keep the tune going across the change. ${save}` : `Play a short fill at the end of ${first.name} and land on beat 1 of ${second.name}. ${save}`);
  }
  add(3, "checkpoint", `${play} ${verse.name} with the band`, range(verse), `${play} ${verse.name} along with the band, ${how(3)}. Keep going if something slips. ${save}`);
  const both = span(first, second);
  add(3, "assessment", `${both.section} with the band`, both, `${play} ${both.section} in one go with the band, ${how(3)}. Record it and submit it.`);

  // Week 4: the whole song, and a show.
  add(4, "checkpoint", "Your trickiest spot", null, `Pick the part that still trips you up. Loop it slowly, speed it up bit by bit, and record a take you're proud of. Save it.`, { support: "chart", targetSpeed: null });
  add(4, "checkpoint", "The whole song at 90% speed", wholeSong, `${play} the whole song with the band at 90% speed, with Chart only on. ${save}`, { support: "chart", targetSpeed: 90 });
  add(4, "assessment", "The whole song", wholeSong, `Show what you can do: ${sing ? "sing" : "play"} the whole song with the band, ${how(4)}. Film it if you can, or send audio. Keep going if something slips.`, { media: "video", audioAllowed: true });

  return { weekTitles, tasks, sections: about };
}

// Every join between one section and the next, to choose from when a task is about a transition.
function transitionsOf(chart) {
  const sections = sectionsOf(chart);
  return sections.slice(0, -1).map((from, i) => {
    const join = transition(from, sections[i + 1]);
    return { name: join.section, start: join.sectionStart, end: join.sectionEnd };
  });
}

module.exports = { WEEK_TITLES, CRITERIA, sectionsOf, barsOf, chordsOf, changesOf, transitionsOf, buildMonth };
