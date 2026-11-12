// A month plan or template: what one can hold, what it gives each student, and what a later change
// would do to work already out there. There's no database in here; routes/plans.routes.js loads and
// saves. A plan is only ever a teacher's working document. What a student sees is the ordinary
// PracticeMonth and Assignments that publishing makes from it.
const crypto = require("crypto");
const { addDays, daysBetween, isDateString } = require("./zoned");
const { INSTRUMENTS, MAX_LEVEL } = require("./lessonVideos");
const { WEEKS, MAX_MONTH_TASKS, MAX_INSTRUCTION, MAX_SECTION, cleanText, validateTaskSettings, statusAfterEdit } = require("./assignments");
const { sectionsOf } = require("./weeklyTemplate");

const KINDS = ["plan", "template"];
const MAX_NAME = 80;
const MAX_WEEK_TITLE = 40;
// Far enough for a month that runs long, and short enough that a typing slip is caught.
const MAX_DUE_DAY = 90;
const TASK_ID = /^[A-Za-z0-9-]{1,64}$/;
// What can be different for one student. Anything else is a change to the plan.
const OVERRIDABLE = ["targetSpeed", "support", "media", "audioAllowed", "dueDay", "instruction"];

// Compared as stored, so an empty list and a list of the same things are the same, and null and
// missing are too.
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isBlank = (v) => v === undefined || v === null || v === "";
const pick = (from, keys) => Object.fromEntries(keys.filter((k) => from[k] !== undefined).map((k) => [k, from[k]]));

// A task's name as a teacher reads it in a list.
const taskLabel = (task) => task.section || "Untitled task";

function dueDayOf(value) {
  if (isBlank(value)) return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_DUE_DAY) return { error: `The due date has to be within ${MAX_DUE_DAY} days after the month starts.` };
  return { value: n };
}

function timeOf(value) {
  if (isBlank(value)) return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { error: true };
  return { value: n };
}

// One task from what the teacher sent. A draft can be unfinished, because people stop halfway through
// writing things; strict is what publishing asks for. Returns { error } or { value }.
function cleanTask(raw, index, { strict = false } = {}) {
  const at = `Task ${index + 1}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: `${at} isn't a task.` };

  const criteria = Array.isArray(raw.criteria) ? raw.criteria.filter((c) => typeof c !== "string" || c.trim()) : raw.criteria;
  const settings = validateTaskSettings({
    kind: raw.kind ?? "checkpoint",
    media: raw.media ?? "audio",
    audioAllowed: raw.audioAllowed ?? false,
    reviewCheckpoint: raw.reviewCheckpoint ?? false,
    support: raw.support ?? null,
    targetSpeed: raw.targetSpeed ?? null,
    week: raw.week,
    criteria: criteria ?? [],
  });
  if (settings.error) return { error: `${at}: ${settings.error}` };
  const { kind, media, audioAllowed, reviewCheckpoint, support, targetSpeed, week } = settings.data;
  if (!week) return { error: `${at}: choose a week.` };

  const level = Number(raw.level);
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return { error: `${at}: level must be a whole number from 1 to ${MAX_LEVEL}.` };

  const section = cleanText(raw.section, MAX_SECTION);
  if (section.error) return { error: `${at}: the name must be ${MAX_SECTION} characters or fewer.` };
  const instruction = cleanText(raw.instruction, MAX_INSTRUCTION);
  if (instruction.error) return { error: `${at}: instructions can be up to ${MAX_INSTRUCTION} characters.` };

  const start = timeOf(raw.sectionStart);
  const end = timeOf(raw.sectionEnd);
  if (start.error || end.error) return { error: `${at}: a section time has to be a moment in the song.` };

  const due = dueDayOf(raw.dueDay);
  if (due.error) return { error: `${at}: ${due.error}` };

  if (strict) {
    const name = `Week ${week}: ${taskLabel({ section: section.value })}`;
    if (!section.value) return { error: `Week ${week}: a task needs a name.` };
    if (!instruction.value) return { error: `${name} needs instructions.` };
    if ((start.value === null) !== (end.value === null)) return { error: `${name} needs both a start and an end time.` };
    if (start.value !== null && end.value <= start.value) return { error: `${name} has to end after it starts.` };
  }

  return {
    value: {
      id: typeof raw.id === "string" && TASK_ID.test(raw.id) ? raw.id : crypto.randomUUID(),
      week,
      position: index,
      kind,
      section: section.value,
      sectionStart: start.value,
      sectionEnd: end.value,
      instruction: instruction.value,
      level,
      media,
      // An audio task has nothing to accept audio instead of; only a checkpoint can join the queue.
      audioAllowed: media === "video" && audioAllowed,
      support,
      targetSpeed,
      dueDay: due.value,
      criteria: kind === "assessment" ? settings.data.criteria : [],
      reviewCheckpoint: kind === "checkpoint" && reviewCheckpoint,
    },
  };
}

// Puts tasks in the order a month is read in, each week's checkpoints then its assessment, keeping the
// teacher's order inside each, and numbers them.
function inOrder(tasks) {
  const rank = (t) => t.week * 2 + (t.kind === "assessment" ? 1 : 0);
  return tasks
    .map((t, i) => [t, i])
    .sort(([a, i], [b, j]) => rank(a) - rank(b) || i - j)
    .map(([t], position) => ({ ...t, position }));
}

function cleanTasks(list, { strict = false } = {}) {
  if (!Array.isArray(list)) return { error: "A plan's tasks have to be a list." };
  if (list.length > MAX_MONTH_TASKS) return { error: `A month can have up to ${MAX_MONTH_TASKS} tasks.` };
  const seen = new Set();
  const value = [];
  for (const [i, raw] of list.entries()) {
    const task = cleanTask(raw, i, { strict });
    if (task.error) return { error: task.error };
    if (seen.has(task.value.id)) task.value.id = crypto.randomUUID();
    seen.add(task.value.id);
    value.push(task.value);
  }
  return { value: inOrder(value) };
}

// Four week names. While drafting one can be left empty; only publishing needs them all.
function cleanWeekTitles(titles, { strict = false } = {}) {
  if (!Array.isArray(titles) || titles.length !== WEEKS) return { error: `A plan has ${WEEKS} week names.` };
  const value = [];
  for (const [i, title] of titles.entries()) {
    const text = cleanText(title, MAX_WEEK_TITLE);
    if (text.error) return { error: `Each week's name can be up to ${MAX_WEEK_TITLE} characters.` };
    if (strict && !text.value) return { error: `Week ${i + 1} needs a name.` };
    value.push(text.value ?? "");
  }
  return { value };
}

// The parts of a save that change the plan's content or details. Only what's in the body comes back,
// so a save changes only what it sends. Returns { error } or { data }.
function parseDocument(body = {}, plan) {
  const data = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, MAX_NAME);
    if (name.error) return { error: `A name can be up to ${MAX_NAME} characters.` };
    // Someone clearing the box to retype it isn't asking for a plan with no name.
    if (name.value) data.name = name.value;
  }
  if (body.instrument !== undefined) {
    if (!INSTRUMENTS.includes(body.instrument)) return { error: `instrument must be one of: ${INSTRUMENTS.join(", ")}.` };
    data.instrument = body.instrument;
  }
  if (body.level !== undefined) {
    const level = Number(body.level);
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return { error: `level must be a whole number from 1 to ${MAX_LEVEL}.` };
    data.level = level;
  }
  if (body.startsOn !== undefined && plan.kind === "plan") {
    if (!isDateString(body.startsOn)) return { error: "Choose the date the month starts." };
    data.startsOn = body.startsOn;
  }
  if (body.weekTitles !== undefined) {
    const titles = cleanWeekTitles(body.weekTitles);
    if (titles.error) return { error: titles.error };
    data.weekTitles = titles.value;
  }
  if (body.tasks !== undefined) {
    const tasks = cleanTasks(body.tasks);
    if (tasks.error) return { error: tasks.error };
    data.tasks = tasks.value;
  }
  return { data };
}

// What's different for one student, from what the teacher sent: { taskId: { skip: true } or the
// settings that differ }. Tasks the plan no longer has are dropped, and a setting that matches the plan
// isn't a difference. Returns { error } or { value }.
function cleanOverrides(raw, tasks) {
  if (isBlank(raw)) return { value: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) return { error: "Individual changes have to be listed task by task." };
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const value = {};
  for (const [taskId, patch] of Object.entries(raw)) {
    const task = byId.get(taskId);
    if (!task || !patch || typeof patch !== "object") continue;
    if (patch.skip === true) {
      value[taskId] = { skip: true };
      continue;
    }
    const settings = validateTaskSettings(pick(patch, ["media", "audioAllowed", "support", "targetSpeed"]));
    if (settings.error) return { error: settings.error };
    const clean = settings.data;
    if (patch.dueDay !== undefined) {
      const due = dueDayOf(patch.dueDay);
      if (due.error) return { error: due.error };
      clean.dueDay = due.value;
    }
    if (patch.instruction !== undefined) {
      const text = cleanText(patch.instruction, MAX_INSTRUCTION);
      if (text.error) return { error: `Instructions can be up to ${MAX_INSTRUCTION} characters.` };
      // Blank means back to the plan's own words.
      if (text.value) clean.instruction = text.value;
    }
    for (const key of Object.keys(clean)) if (same(clean[key], task[key])) delete clean[key];
    if (Object.keys(clean).length) value[taskId] = clean;
  }
  return { value };
}

// The tasks one student gets: left out where the teacher left them out, with their own settings where
// they have them.
function forStudent(tasks, overrides) {
  const out = [];
  for (const task of tasks) {
    const change = overrides?.[task.id];
    if (change?.skip) continue;
    const own = { ...task, ...pick(change ?? {}, OVERRIDABLE) };
    own.audioAllowed = own.media === "video" && own.audioAllowed;
    out.push(own);
  }
  return out;
}

const dueOnOf = (task, startsOn) => (task.dueDay === null || task.dueDay === undefined || !startsOn ? null : addDays(startsOn, task.dueDay));

// A plan's task as Assignment columns, for a month starting on startsOn.
function assignmentData(task, startsOn) {
  const { id, dueDay, ...fields } = task;
  return { ...fields, planTaskId: id, dueOn: dueOnOf(task, startsOn) };
}

function hasNoTasks(plan) {
  return !Array.isArray(plan.tasks) || plan.tasks.length === 0;
}

// Whether a plan is fit to reach students. problems stop it; warnings are for the teacher to weigh up,
// because a holiday week or an unusual month can be exactly what they meant. Every line says where.
function checkPlan(plan, { today, song } = {}) {
  const problems = [];
  const warnings = [];
  if (!song || !song.published) problems.push("Choose a song that's still in the library.");
  if (!plan.startsOn) problems.push("Choose the first day of week 1.");
  if (hasNoTasks(plan)) problems.push("Add at least one task.");

  const titles = cleanWeekTitles(plan.weekTitles, { strict: true });
  if (titles.error) problems.push(titles.error);

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  for (const [i, task] of tasks.entries()) {
    const strict = cleanTask(task, i, { strict: true });
    if (strict.error) problems.push(strict.error);
    const name = `Week ${task.week}: ${taskLabel(task)}`;
    if (task.kind === "assessment" && !task.criteria?.length) warnings.push(`${name} has no assessment criteria.`);
    if (task.dueDay === null || task.dueDay === undefined) warnings.push(`${name} has no due date.`);
  }
  for (let week = 1; week <= WEEKS; week++) {
    const here = tasks.filter((t) => t.week === week);
    if (!here.length) {
      warnings.push(`Week ${week} has nothing set.`);
      continue;
    }
    const checkpoints = here.filter((t) => t.kind === "checkpoint").length;
    const assessments = here.length - checkpoints;
    if (assessments === 0) warnings.push(`Week ${week} has no weekly assessment.`);
    if (assessments > 1) warnings.push(`Week ${week} has ${assessments} assessments. A week usually has one.`);
    if (checkpoints < 2 || checkpoints > 4) warnings.push(`Week ${week} has ${checkpoints} milestone${checkpoints === 1 ? "" : "s"}. A week usually has two to four.`);
  }
  if (song && !sectionsOf(song.chart).length) warnings.push("This song has no chart with sections yet, so tasks can't be matched to its sections.");
  if (plan.startsOn && today && plan.startsOn < today) warnings.push("This month starts before today.");
  return { problems, warnings };
}

// The content a snapshot keeps, and whether two are the same.
const contentOf = (p) => ({ startsOn: p.startsOn ?? null, weekTitles: p.weekTitles, tasks: p.tasks });
const sameContent = (a, b) => same(contentOf(a), contentOf(b));

// What a student's month has that a change could be applied to. dueOn stands in for dueDay, since a
// month's due dates are real dates. Order isn't here: taking one task out renumbers all the rest,
// which isn't a change to any of them, so it's worked out on its own (orderChange).
const TASK_FIELDS = ["week", "kind", "section", "sectionStart", "sectionEnd", "instruction", "level", "media", "audioAllowed", "support", "targetSpeed", "criteria", "reviewCheckpoint", "dueOn"];
const MONTH_FIELDS = ["startsOn", "weekTitles"];
// The same for a plan taking changes from a template, where due dates are still relative.
const PLAN_FIELDS = [...TASK_FIELDS.filter((f) => f !== "dueOn"), "dueDay"];

// The heart of keeping individual settings. A field changes only if the source changed it AND this copy
// still has what the source used to say. If this copy says something else, somebody chose that for it,
// so it stays and is reported. base is the source as this copy last took it, target as it is now.
function threeWay(base, target, current, fields) {
  const updates = {};
  const changed = [];
  const kept = [];
  for (const field of fields) {
    if (same(base[field], target[field]) || same(current[field], target[field])) continue;
    if (same(current[field], base[field])) {
      updates[field] = target[field] ?? null;
      changed.push({ field, from: current[field] ?? null, to: target[field] ?? null });
    } else {
      kept.push({ field, value: current[field] ?? null, planValue: target[field] ?? null });
    }
  }
  return { updates, changed, kept };
}

const brief = (task) => ({ taskId: task.id, label: taskLabel(task), week: task.week, kind: task.kind });

// What the plan's order means for this month: the new number for each task, written quietly, and
// whether the student would see tasks come in a different order. A task moving to another week says so
// itself, so tasks are compared by the week they're going to.
function orderChange(month, target, assignments) {
  const targetTasks = new Map(target.tasks.map((t) => [t.id, t]));
  const shared = month.tasks.filter((a) => targetTasks.has(a.planTaskId));
  const now = [...shared].sort((a, b) => targetTasks.get(a.planTaskId).week - targetTasks.get(b.planTaskId).week || a.position - b.position).map((a) => a.planTaskId);
  const next = target.tasks.filter((t) => assignments.has(t.id)).map((t) => t.id);
  return {
    reordered: !same(now, next),
    positions: shared.filter((a) => a.position !== targetTasks.get(a.planTaskId).position).map((a) => ({ assignmentId: a.id, position: targetTasks.get(a.planTaskId).position })),
  };
}

// What a plan's current state would do to one student's month. base = { startsOn, weekTitles, tasks }
// as this month last took it, target the same as the plan stands now; month has tasks with attempts
// counted. Takes are never touched, and a task with any takes is never taken away.
function monthImpact({ base, target, month, overrides }) {
  const assignments = new Map(month.tasks.filter((a) => a.planTaskId).map((a) => [a.planTaskId, a]));
  const baseTasks = new Map(base.tasks.map((t) => [t.id, t]));
  const targetTasks = new Map(target.tasks.map((t) => [t.id, t]));

  const head = threeWay(base, target, month, MONTH_FIELDS);
  const changes = [];
  const adds = [];
  const removes = [];
  const keeps = [];

  for (const task of target.tasks) {
    const assignment = assignments.get(task.id);
    const before = baseTasks.get(task.id);
    if (!assignment) {
      // New to the plan. One the plan already had but this student doesn't have was left out on purpose.
      if (!before && forStudent([task], overrides).length) adds.push({ ...brief(task), data: assignmentData(forStudent([task], overrides)[0], target.startsOn) });
      continue;
    }
    const baseValues = before ? assignmentData(before, base.startsOn) : assignment;
    const { updates, changed, kept } = threeWay(baseValues, assignmentData(task, target.startsOn), assignment, TASK_FIELDS);
    if (!changed.length && !kept.length) continue;
    changes.push({
      assignmentId: assignment.id,
      ...brief(task),
      status: assignment.status,
      statusAfter: statusAfterEdit(assignment, { ...assignment, ...updates }),
      attempts: assignment.attempts,
      updates,
      fields: changed,
      individual: kept,
    });
  }

  for (const task of base.tasks) {
    if (targetTasks.has(task.id)) continue;
    const assignment = assignments.get(task.id);
    if (!assignment) continue;
    (assignment.attempts ? keeps : removes).push({ assignmentId: assignment.id, ...brief(task), attempts: assignment.attempts });
  }

  return { monthUpdates: head.updates, monthFields: head.changed, monthKept: head.kept, changes, adds, removes, keeps, ...orderChange(month, target, assignments) };
}

// How much of an impact would really change something for the student.
function changeCount(impact) {
  return impact.monthFields.length + impact.changes.filter((c) => c.fields.length).length + impact.adds.length + impact.removes.length + (impact.reordered ? 1 : 0);
}

// A fingerprint of what the teacher was shown, so applying can tell if it's no longer what would happen.
function basisOf(impacts) {
  return crypto.createHash("sha256").update(JSON.stringify(impacts)).digest("hex").slice(0, 32);
}

// A template's newer version brought into a plan made from an older one. What the plan has changed for
// itself stays. base is the template as this plan last took it. Returns the new plan content and a
// report of what happens.
function mergeTemplate({ base, target, plan }) {
  const titles = threeWay(base, target, plan, ["weekTitles"]);
  const baseTasks = new Map(base.tasks.map((t) => [t.id, t]));
  const targetTasks = new Map(target.tasks.map((t) => [t.id, t]));
  const planTasks = new Map(plan.tasks.map((t) => [t.id, t]));

  const changes = [];
  const adds = [];
  const removes = [];
  const keeps = [];
  const merged = [];

  for (const task of plan.tasks) {
    const before = baseTasks.get(task.id);
    if (!before) {
      merged.push(task); // the plan's own addition
      continue;
    }
    const latest = targetTasks.get(task.id);
    if (!latest) {
      if (PLAN_FIELDS.every((f) => same(task[f], before[f]))) removes.push(brief(task));
      else {
        keeps.push(brief(task));
        merged.push(task);
      }
      continue;
    }
    const { updates, changed, kept } = threeWay(before, latest, task, PLAN_FIELDS);
    merged.push({ ...task, ...updates });
    if (changed.length || kept.length) changes.push({ ...brief(task), fields: changed, individual: kept });
  }
  for (const task of target.tasks) {
    if (baseTasks.has(task.id) || planTasks.has(task.id)) continue;
    merged.push(task);
    adds.push(brief(task));
  }

  // The template's new order is only taken if this plan still had the template's old one.
  const inAll = (list) => list.filter((t) => baseTasks.has(t.id) && targetTasks.has(t.id) && planTasks.has(t.id)).map((t) => t.id);
  const reordered = !same(inAll(base.tasks), inAll(target.tasks)) && same(inAll(base.tasks), inAll(plan.tasks));
  const newPlace = (t) => (reordered && targetTasks.has(t.id) ? targetTasks.get(t.id).position : t.position);
  const sorted = [...merged].sort((a, b) => newPlace(a) - newPlace(b));

  const report = { weekTitles: titles.changed, weekTitlesKept: titles.kept, changes, adds, removes, keeps, reordered };
  const changesAnything = titles.changed.length > 0 || changes.some((c) => c.fields.length) || adds.length > 0 || removes.length > 0 || reordered;
  return { weekTitles: titles.updates.weekTitles ?? plan.weekTitles, tasks: inOrder(sorted), report, changesAnything };
}

// The tasks of the template's suggestion for a song, with due dates made relative.
function tasksFromSuggestion(built, startsOn) {
  return built.tasks.map(({ dueOn, ...task }) => ({ ...task, dueDay: dueOn ? daysBetween(startsOn, dueOn) : null }));
}

const statusOf = (plan) => (plan.archivedAt ? "archived" : plan.publishedAt ? "published" : "draft");

module.exports = {
  KINDS,
  MAX_NAME,
  OVERRIDABLE,
  TASK_FIELDS,
  same,
  taskLabel,
  cleanTasks,
  cleanWeekTitles,
  parseDocument,
  cleanOverrides,
  forStudent,
  dueOnOf,
  assignmentData,
  checkPlan,
  contentOf,
  sameContent,
  threeWay,
  monthImpact,
  changeCount,
  basisOf,
  mergeTemplate,
  tasksFromSuggestion,
  statusOf,
};
