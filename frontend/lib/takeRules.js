// What a final take for a weekly assessment has to be, in the player. The API checks the same rules
// (backend lib/assignments.js takeProblem). These are there to help a student know what's being asked,
// so a take that doesn't fit is kept as practice and the words say what to do next.
import { HELP, HELP_ORDER } from "./months.js";

const rank = (help) => HELP_ORDER.indexOf(help);

// The kind of task where the student submits one chosen take on purpose. Work set before there were
// weeks is sent the way it always was.
export const isWeeklyAssessment = (task) => task?.kind === "assessment" && Boolean(task.week);

// Which of two help levels is more help.
export const moreHelp = (a, b) => (rank(b) > rank(a) ? b : a);

// What the player still has to be set to for a take to fit the assessment, in words. Less help or a
// faster speed than asked is fine. hasChart false means help doesn't come into it.
export function setupGaps(task, { help, speed, hasChart = true }) {
  if (!isWeeklyAssessment(task)) return [];
  const gaps = [];
  if (hasChart && task.support && rank(help) > rank(task.support)) gaps.push(HELP[task.support]);
  if (task.targetSpeed && speed * 100 < task.targetSpeed - 0.5) gaps.push(`${task.targetSpeed}% speed`);
  return gaps;
}

// Whether a recorded take fits. made = { support, speed, raisedBy }: the most help used, what brought
// it up ("mode", "peek", "focus", or nothing when it started that way), and the speed it was played at.
export function takeVerdict(task, made) {
  if (!isWeeklyAssessment(task)) return { ok: true, text: null };
  if (task.support && made.support && rank(made.support) > rank(task.support)) {
    const how =
      made.raisedBy === "peek"
        ? "You peeked at the chart during this take"
        : made.raisedBy === "focus"
          ? "Focus view was open during this take, and it shows what to play"
          : `You had ${HELP[made.support]} on during this take`;
    return { ok: false, why: "help", text: `${how}, so it stays as practice. For the assessment, record a new take with ${HELP[task.support]}.` };
  }
  const speed = made.speed ?? 1;
  if (task.targetSpeed && speed * 100 < task.targetSpeed - 0.5) {
    return { ok: false, why: "speed", text: `This take played at ${Math.round(speed * 100)}%, so it stays as practice. For the assessment, record a new take at ${task.targetSpeed}%.` };
  }
  return { ok: true, text: null };
}
