import { instruments } from "@/lib/content";

export const INSTRUMENT_NAMES = instruments.map((i) => i.name);

export const EXPERIENCE_OPTIONS = ["None", "Some", "Experienced"];

export const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Expert"];

export const PLANS = [
  { key: "lesson30", name: "30-Minute Lessons", sub: "Weekly one-on-one", price: "$45/wk" },
  { key: "lesson45", name: "45-Minute Lessons", sub: "Weekly one-on-one, most popular", price: "$60/wk" },
  { key: "band", name: "Rock Band Add-on", sub: "Adds weekly group rehearsal", price: "+$25/wk" },
];

export const STEP_LABELS = ["Student & Login", "Experience", "Instruction", "Plan"];
