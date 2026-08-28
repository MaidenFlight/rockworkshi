import { instruments } from "@/lib/content";

export const INSTRUMENT_NAMES = instruments.map((i) => i.name);

// The homepage's instrument tiles deep-link in as /signup?instrument=Bass, so
// this string now arrives from a URL anyone can retype. It is stored on the
// account and the backend matches lesson videos against it
// (backend/src/lib/lessonVideos.js), which makes it the one query param on the
// site that can write nonsense somewhere durable — so nothing is carried
// through unrecognised.
//
// Returns the canonical name or null, rather than defaulting here: the caller
// needs to know the difference between "arrived with Bass" and "arrived with
// nothing", because only the first one has anything to confirm to the reader.
// Matching is case-insensitive so a hand-typed ?instrument=bass still lands,
// but the value that leaves is always spelled the way the six names are.
export function matchInstrument(value) {
  const wanted = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!wanted) return null;
  return INSTRUMENT_NAMES.find((name) => name.toLowerCase() === wanted) || null;
}

export const EXPERIENCE_OPTIONS = ["None", "Some", "Experienced"];

export const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Expert"];

// Must stay in step with backend/src/lib/plans.js, which holds the amounts that
// are actually charged. `name` is what gets stored on the account and looked up
// there, so these strings are load-bearing — the prices below are only display.
export const PLANS = [
  { key: "monthly", name: "Monthly", sub: "Full access, cancel any time", price: "$55/mo" },
  { key: "term", name: "Term", sub: "Paid up front — works out at $45 a month", price: "$135/term" },
];

export const STEP_LABELS = ["Student & Login", "Experience", "Instruction", "Plan"];
