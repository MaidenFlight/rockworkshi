// How a task's name reads inside the guided steps' sentences. The month's milestones are named as things
// to do ("Sing along with Verse 1", "Play an Am chord"), older work names a part of the song ("Verse 1"),
// and some name something to work on ("The whole song", "Your trickiest spot"). So the steps can say
// "practise Verse 1" and "practise the whole song" but never "practise Sing along with Verse 1".

// Words a task's name can start with that make it a thing to do. The month template uses the first five;
// the rest are what a teacher naturally starts a task with. Anything else reads as a part of the song.
const ACTIONS = new Set([
  "sing", "play", "switch", "move", "count",
  "strum", "clap", "tap", "hum", "learn", "practise", "practice", "find", "try", "keep", "hold", "change",
  "start", "follow", "listen", "pick", "review", "work", "warm",
]);
// Words that start a name without being part of a title, so they read lower-case mid-sentence. "A" is left
// out on purpose: it is also a note ("A minor groove").
const LEADS = new Set(["the", "your", "an", "this", "that", "each", "every", "all", "both", "my"]);

// "Sing along with Verse 1" → { kind: "action", name: "Sing along with Verse 1", text: "sing along with Verse 1" }
// "The whole song"          → { kind: "lead", name: "The whole song", text: "the whole song" }
// "Verse 1"                 → { kind: "name", name: "Verse 1", text: "Verse 1" }
// `text` is the name as it reads mid-sentence; `name` starts one. An empty name reads as `fallback`.
export function taskWords(name, fallback = "the section") {
  const words = String(name ?? "").trim();
  if (!words) return { kind: "name", name: fallback, text: fallback };
  const first = words.split(/\s+/)[0].toLowerCase();
  // Only a capital followed by a small letter is lowered: "THE END" stays as it was typed.
  const lower = /^[A-Z][a-z']/.test(words) ? words[0].toLowerCase() + words.slice(1) : words;
  if (ACTIONS.has(first)) return { kind: "action", name: words, text: lower };
  if (LEADS.has(first)) return { kind: "lead", name: words, text: lower };
  return { kind: "name", name: words, text: words };
}

// Level 1 is the Sing-a-long, which needs no instrument yet (lib/content.js), so nothing to tune.
export const singAlong = (assignment) => Number(assignment?.level) === 1;

// The guided steps' words for a task's part of the song.
export function stepWords(assignment) {
  const w = taskWords(assignment?.section);
  return {
    // The dashboard's one-line plan: "sing along with Verse 1", "practise the whole song".
    plan: w.kind === "action" ? w.text : `practise ${w.text}`,
    // The session's step: "Sing along with Verse 1", "Practise Verse 1".
    label: w.kind === "action" ? w.name : `Practise ${w.text}`,
    // What the loop goes round: "Loop this part of the song", "Loop Verse 1".
    loop: w.kind === "action" ? "this part of the song" : w.text,
    // What to record: "Record it", "Record the whole song", "Record the whole of Verse 1".
    record: w.kind === "action" ? "it" : w.kind === "lead" ? w.text : `the whole of ${w.text}`,
    // The dashboard's Today list: "Sing along with Verse 1 until it feels easy", "Loop Verse 1 until…".
    today: w.kind === "action" ? w.name : `Loop ${w.text}`,
  };
}
