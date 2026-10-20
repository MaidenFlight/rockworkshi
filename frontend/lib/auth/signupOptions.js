import { instruments } from "@/lib/content";

export const INSTRUMENT_NAMES = instruments.map((i) => i.name);

export function matchInstrument(value) {
  const wanted = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!wanted) return null;
  return INSTRUMENT_NAMES.find((name) => name.toLowerCase() === wanted) || null;
}

export const EXPERIENCE_OPTIONS = ["None", "Some", "Experienced"];

export const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Expert"];

export const PLANS = [
  { key: "monthly", name: "Monthly", sub: "Full access, cancel any time", price: "$55/mo" },
  { key: "term", name: "Term", sub: "Paid up front — works out at $45 a month", price: "$135/term" },
];

export const STEP_LABELS = ["Student & Login", "Experience", "Instruction", "Plan"];
