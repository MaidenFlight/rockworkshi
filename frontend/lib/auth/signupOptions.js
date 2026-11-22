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

// A plan's price as a bare figure ("$55"), for pages that quote it in a sentence. It is read from
// the list above, so a page cannot quote a price the signup form does not show.
export const planPrice = (key) => PLANS.find((p) => p.key === key).price.split("/")[0];

export const STEP_LABELS = ["Student & login", "Instrument", "Plan"];
