import { instruments } from "@/lib/content";

export const INSTRUMENT_NAMES = instruments.map((i) => i.name);

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
