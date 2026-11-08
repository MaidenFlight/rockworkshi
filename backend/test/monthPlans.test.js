// The rules for month plans on their own: what a plan can hold, what it gives each student, and how a
// change is worked out against what a student already has. No database or server here.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const plans = require("../src/lib/monthPlans");

const task = (extra = {}) => ({ id: "a", week: 1, kind: "checkpoint", section: "Verse 1", sectionStart: 10, sectionEnd: 30, instruction: "Loop it.", level: 2, media: "audio", audioAllowed: false, support: "guide", targetSpeed: 80, dueDay: 6, criteria: [], reviewCheckpoint: false, ...extra });
const TITLES = ["One", "Two", "Three", "Four"];
const SONG = { published: true, chart: { end: 40, sections: [{ name: "Verse 1", bars: [{ time: 10 }, { time: 20 }] }, { name: "Chorus 1", bars: [{ time: 30 }, { time: 35 }] }] } };

test("a draft can be unfinished, but its numbers still have to make sense", () => {
  const { value } = plans.cleanTasks([task({ instruction: "", section: "", sectionEnd: null })]);
  assert.equal(value[0].instruction, null);
  assert.equal(value[0].section, null);
  assert.equal(value[0].sectionEnd, null);

  for (const bad of [{ week: 5 }, { week: null }, { level: 9 }, { kind: "quiz" }, { media: "gif" }, { support: "lots" }, { targetSpeed: 20 }, { dueDay: -1 }, { dueDay: 91 }, { dueDay: 1.5 }, { sectionStart: -2 }, { criteria: "x" }, { section: "x".repeat(81) }, { instruction: "x".repeat(501) }]) {
    assert.ok(plans.cleanTasks([task(bad)]).error, JSON.stringify(bad));
  }
  assert.ok(plans.cleanTasks(Array.from({ length: 25 }, (_, i) => task({ id: `t${i}` }))).error, "too many tasks");
  assert.ok(plans.cleanTasks("nope").error);
});

test("tasks are kept in the order a month is read, keeping the teacher's order inside each group", () => {
  const { value } = plans.cleanTasks([
    task({ id: "w2-a", week: 2, kind: "assessment" }),
    task({ id: "w1-a", week: 1, kind: "assessment" }),
    task({ id: "w1-c2", week: 1 }),
    task({ id: "w1-c1", week: 1 }),
    task({ id: "w2-c", week: 2 }),
  ]);
  assert.deepEqual(value.map((t) => t.id), ["w1-c2", "w1-c1", "w1-a", "w2-c", "w2-a"]);
  assert.deepEqual(value.map((t) => t.position), [0, 1, 2, 3, 4]);
});

test("settings that mean nothing for a kind of task are cleared, and ids stay unique", () => {
  const { value } = plans.cleanTasks([
    task({ id: "same", media: "audio", audioAllowed: true, criteria: ["Timing"], reviewCheckpoint: true }),
    task({ id: "same", kind: "assessment", reviewCheckpoint: true, criteria: ["Timing", "  "] }),
  ]);
  assert.equal(value[0].audioAllowed, false, "an audio task has nothing to accept audio instead of");
  assert.deepEqual(value[0].criteria, [], "a checkpoint isn't marked");
  assert.equal(value[0].reviewCheckpoint, true);
  assert.equal(value[1].reviewCheckpoint, false, "an assessment is always in the queue");
  assert.deepEqual(value[1].criteria, ["Timing"], "an empty box isn't a criterion");
  assert.notEqual(value[0].id, value[1].id);
});

test("a plan is only checked as a whole when it's about to reach students", () => {
  const good = [1, 2, 3, 4].flatMap((week) => [task({ id: `${week}a`, week, dueDay: week * 7 - 1 }), task({ id: `${week}b`, week, dueDay: week * 7 - 1 }), task({ id: `${week}c`, week, kind: "assessment", criteria: ["Timing"], dueDay: week * 7 - 1 })]);
  const plan = { startsOn: "2026-12-07", weekTitles: TITLES, tasks: good };
  assert.deepEqual(plans.checkPlan(plan, { song: SONG, today: "2026-12-01" }), { problems: [], warnings: [] });

  assert.deepEqual(plans.checkPlan({ ...plan, tasks: [] }, { song: SONG }).problems, ["Add at least one task."]);
  assert.match(plans.checkPlan({ ...plan, startsOn: null }, { song: SONG }).problems[0], /first day/);
  assert.match(plans.checkPlan(plan, { song: { published: false } }).problems[0], /still in the library/);
  assert.match(plans.checkPlan(plan, { song: null }).problems[0], /still in the library/);
  assert.match(plans.checkPlan({ ...plan, weekTitles: ["One", "", "Three", "Four"] }, { song: SONG }).problems[0], /Week 2 needs a name/);

  const bad = (extra) => plans.checkPlan({ ...plan, tasks: [task(extra), ...good.slice(1)] }, { song: SONG }).problems;
  assert.match(bad({ instruction: "" })[0], /Week 1: Verse 1 needs instructions/);
  assert.match(bad({ section: "" })[0], /needs a name/);
  assert.match(bad({ sectionEnd: null })[0], /both a start and an end/);
  assert.match(bad({ sectionStart: 40, sectionEnd: 10 })[0], /end after it starts/);

  const warned = (tasks, extra = {}) => plans.checkPlan({ ...plan, ...extra, tasks }, { song: SONG, today: "2026-12-10" }).warnings.join(" | ");
  assert.match(warned(good.filter((t) => t.id !== "2c")), /Week 2 has no weekly assessment/);
  assert.match(warned(good.filter((t) => t.id !== "3a")), /Week 3 has 1 practice checkpoint\b/);
  assert.match(warned(good.filter((t) => t.week !== 4)), /Week 4 has nothing set/);
  assert.match(warned(good), /starts before today/);
  assert.match(plans.checkPlan({ ...plan, tasks: [task({ dueDay: null, kind: "assessment" })] }, { song: { published: true, chart: null } }).warnings.join(" "), /no assessment criteria.*no due date.*no chart/s);
});

test("what's different for one student is only what really differs, and only what's allowed", () => {
  const tasks = [task()];
  assert.deepEqual(plans.cleanOverrides({ a: { targetSpeed: 70, support: "guide" }, gone: { targetSpeed: 60 } }, tasks).value, { a: { targetSpeed: 70 } });
  assert.deepEqual(plans.cleanOverrides({ a: { skip: true, targetSpeed: 60 } }, tasks).value, { a: { skip: true } });
  assert.deepEqual(plans.cleanOverrides({ a: { section: "Sneaky", level: 5, week: 3 } }, tasks).value, {}, "the rest belongs to the plan");
  assert.deepEqual(plans.cleanOverrides({ a: { instruction: "  " } }, tasks).value, {}, "blank means the plan's own words");
  assert.deepEqual(plans.cleanOverrides(null, tasks).value, {});
  assert.ok(plans.cleanOverrides({ a: { targetSpeed: 10 } }, tasks).error);
  assert.ok(plans.cleanOverrides({ a: { dueDay: 400 } }, tasks).error);
  assert.ok(plans.cleanOverrides([1], tasks).error);
});

test("each student gets the plan with their own changes", () => {
  const tasks = [task({ id: "a" }), task({ id: "b", media: "video", audioAllowed: true }), task({ id: "c" })];
  const own = plans.forStudent(tasks, { a: { targetSpeed: 60 }, b: { media: "audio" }, c: { skip: true } });
  assert.deepEqual(own.map((t) => t.id), ["a", "b"]);
  assert.equal(own[0].targetSpeed, 60);
  assert.equal(own[1].audioAllowed, false);
  assert.equal(tasks[0].targetSpeed, 80, "the plan itself isn't touched");

  const data = plans.assignmentData(task({ dueDay: 6 }), "2026-11-30");
  assert.equal(data.dueOn, "2026-12-06");
  assert.equal(data.planTaskId, "a");
  assert.equal(data.id, undefined);
  assert.equal(data.dueDay, undefined);
  assert.equal(plans.assignmentData(task({ dueDay: null }), "2026-11-30").dueOn, null);
});

// A month as it would be after publishing this plan.
const START = "2026-11-02";
function monthFrom(base, edits = {}) {
  return {
    startsOn: base.startsOn,
    weekTitles: base.weekTitles,
    tasks: base.tasks.map((t) => ({ id: `row-${t.id}`, status: "assigned", attempts: 0, ...plans.assignmentData(t, base.startsOn), ...edits[t.id] })),
  };
}
const version = (tasks, extra = {}) => ({ startsOn: START, weekTitles: TITLES, tasks, ...extra });

test("a change reaches a task only where it still has what the plan said", () => {
  const base = version([task({ id: "same" }), task({ id: "own" })]);
  const target = version([task({ id: "same", targetSpeed: 90 }), task({ id: "own", targetSpeed: 90 })]);
  const month = monthFrom(base, { own: { targetSpeed: 60 } });
  const impact = plans.monthImpact({ base, target, month });
  assert.equal(impact.changes.length, 2);
  const [same, own] = impact.changes;
  assert.deepEqual(same.fields, [{ field: "targetSpeed", from: 80, to: 90 }]);
  assert.deepEqual(same.updates, { targetSpeed: 90 });
  assert.deepEqual(own.fields, [], "their own speed isn't changed");
  assert.deepEqual(own.individual, [{ field: "targetSpeed", value: 60, planValue: 90 }], "and it's reported");
  assert.equal(plans.changeCount(impact), 1);
});

test("nothing to do when the plan hasn't moved, even for a student with their own settings", () => {
  const base = version([task()]);
  const impact = plans.monthImpact({ base, target: base, month: monthFrom(base, { a: { targetSpeed: 60 } }) });
  assert.equal(plans.changeCount(impact), 0);
  assert.deepEqual(impact.changes, []);
});

test("moving the start moves the due dates, except one a student was given", () => {
  const base = version([task({ id: "a", dueDay: 6 }), task({ id: "b", dueDay: 6 })]);
  const target = version(base.tasks, { startsOn: "2026-11-09" });
  const month = monthFrom(base, { b: { dueOn: "2026-11-20" } });
  const impact = plans.monthImpact({ base, target, month });
  assert.deepEqual(impact.monthFields, [{ field: "startsOn", from: "2026-11-02", to: "2026-11-09" }]);
  assert.deepEqual(impact.changes[0].fields, [{ field: "dueOn", from: "2026-11-08", to: "2026-11-15" }]);
  assert.deepEqual(impact.changes[1].fields, []);
  assert.equal(impact.changes[1].individual[0].value, "2026-11-20");
});

test("a task removed from the plan only goes if nobody has sent anything for it", () => {
  const base = version([task({ id: "stay" }), task({ id: "go" }), task({ id: "sent" })]);
  const target = version([task({ id: "stay" })]);
  const impact = plans.monthImpact({ base, target, month: monthFrom(base, { sent: { attempts: 2 } }) });
  assert.deepEqual(impact.removes.map((r) => r.label + r.taskId), ["Verse 1go"]);
  assert.deepEqual(impact.keeps.map((r) => [r.taskId, r.attempts]), [["sent", 2]]);
  assert.equal(plans.changeCount(impact), 1, "keeping work isn't a change");
});

test("taking a task out isn't a change to the ones after it, but changing the order is", () => {
  const three = [task({ id: "one", position: 0 }), task({ id: "two", position: 1 }), task({ id: "three", position: 2 })];
  const base = version(three);
  const fewer = version([{ ...three[0] }, { ...three[2], position: 1 }]);
  const shrunk = plans.monthImpact({ base, target: fewer, month: monthFrom(base) });
  assert.equal(shrunk.reordered, false);
  assert.deepEqual(shrunk.changes, [], "the rest aren't reported as changed");
  assert.deepEqual(shrunk.positions, [{ assignmentId: "row-three", position: 1 }], "they're only renumbered");
  assert.equal(plans.changeCount(shrunk), 1, "just the removal");

  const swapped = version([{ ...three[1], position: 0 }, { ...three[0], position: 1 }, three[2]]);
  const moved = plans.monthImpact({ base, target: swapped, month: monthFrom(base) });
  assert.equal(moved.reordered, true);
  assert.equal(plans.changeCount(moved), 1);

  // A task moved to a later week says so on its own.
  const later = version([three[1], three[2], { ...three[0], week: 2 }].map((t, position) => ({ ...t, position })));
  const week = plans.monthImpact({ base, target: later, month: monthFrom(base) });
  assert.equal(week.reordered, false);
  assert.deepEqual(week.changes[0].fields, [{ field: "week", from: 1, to: 2 }]);
});

test("a new task reaches everyone except a student it was left out for, and left-out tasks stay out", () => {
  const base = version([task({ id: "old" })]);
  const target = version([task({ id: "old" }), task({ id: "new", week: 2 })]);
  const all = plans.monthImpact({ base, target, month: monthFrom(base) });
  assert.deepEqual(all.adds.map((a) => a.taskId), ["new"]);
  assert.equal(all.adds[0].data.dueOn, "2026-11-08");

  const skipping = plans.monthImpact({ base, target, month: monthFrom(base), overrides: { new: { skip: true } } });
  assert.deepEqual(skipping.adds, []);

  // "old" was in the plan, and this student has no row for it: they were left out of it.
  const leftOut = plans.monthImpact({ base, target, month: { ...monthFrom(base), tasks: [] } });
  assert.deepEqual(leftOut.adds.map((a) => a.taskId), ["new"]);
});

test("work already in the queue moves with what the task now is, as a teacher's own edit would", () => {
  const base = version([task({ id: "a" }), task({ id: "b", kind: "assessment" })]);
  const target = version([task({ id: "a", reviewCheckpoint: true }), task({ id: "b", kind: "checkpoint" })]);
  const month = monthFrom(base, { a: { status: "saved", attempts: 1 }, b: { status: "ready", attempts: 1 } });
  const { changes } = plans.monthImpact({ base, target, month });
  assert.deepEqual(changes.map((c) => [c.taskId, c.status, c.statusAfter, c.attempts]), [["a", "saved", "ready", 1], ["b", "ready", "saved", 1]]);
});

test("a template's new version keeps what the plan changed for itself", () => {
  const base = { weekTitles: TITLES, tasks: [task({ id: "follow" }), task({ id: "mine" }), task({ id: "removed" }), task({ id: "removed-but-edited" })] };
  const target = {
    weekTitles: ["New one", "Two", "Three", "Four"],
    tasks: [task({ id: "follow", targetSpeed: 90, dueDay: 7 }), task({ id: "mine", targetSpeed: 90 }), task({ id: "added", week: 3 })],
  };
  const plan = {
    weekTitles: TITLES,
    tasks: [task({ id: "follow" }), task({ id: "mine", targetSpeed: 70 }), task({ id: "removed" }), task({ id: "removed-but-edited", instruction: "My own words." }), task({ id: "plan-only", week: 2 })],
  };
  const { tasks, weekTitles, report, changesAnything } = plans.mergeTemplate({ base, target, plan });
  assert.equal(changesAnything, true);
  assert.deepEqual(weekTitles, target.weekTitles);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  assert.equal(byId.follow.targetSpeed, 90);
  assert.equal(byId.follow.dueDay, 7);
  assert.equal(byId.mine.targetSpeed, 70);
  assert.equal(byId.removed, undefined);
  assert.equal(byId["removed-but-edited"].instruction, "My own words.");
  assert.ok(byId["plan-only"], "a task the plan added stays");
  assert.ok(byId.added, "a task the template added arrives");
  assert.deepEqual(report.removes.map((r) => r.taskId), ["removed"]);
  assert.deepEqual(report.keeps.map((r) => r.taskId), ["removed-but-edited"]);
  assert.deepEqual(report.adds.map((r) => r.taskId), ["added"]);
  assert.deepEqual(report.changes.find((c) => c.taskId === "mine").individual, [{ field: "targetSpeed", value: 70, planValue: 90 }]);
  assert.deepEqual(tasks.map((t) => t.position), tasks.map((_, i) => i));

  assert.equal(plans.mergeTemplate({ base, target: base, plan: base }).changesAnything, false);
});

test("a template's new order is taken unless the plan has its own", () => {
  const list = [task({ id: "one", position: 0 }), task({ id: "two", position: 1 })];
  const flipped = [task({ id: "two", position: 0 }), task({ id: "one", position: 1 })];
  const base = { weekTitles: TITLES, tasks: list };
  const target = { weekTitles: TITLES, tasks: flipped };

  const following = plans.mergeTemplate({ base, target, plan: { weekTitles: TITLES, tasks: list } });
  assert.equal(following.report.reordered, true);
  assert.deepEqual(following.tasks.map((t) => t.id), ["two", "one"]);

  // A plan with the same new order has nothing to take.
  const ownOrder = plans.mergeTemplate({ base: { weekTitles: TITLES, tasks: flipped }, target, plan: { weekTitles: TITLES, tasks: list } });
  assert.equal(ownOrder.changesAnything, false);
  assert.deepEqual(ownOrder.tasks.map((t) => t.id), ["one", "two"]);

  // Taking a task out of the template doesn't flag the rest.
  const shorter = { weekTitles: TITLES, tasks: [{ ...list[1], position: 0 }] };
  const merged = plans.mergeTemplate({ base, target: shorter, plan: { weekTitles: TITLES, tasks: list } });
  assert.deepEqual(merged.report.changes, []);
  assert.deepEqual(merged.tasks.map((t) => [t.id, t.position]), [["two", 0]]);
});

test("the fingerprint of an impact changes when what would happen changes", () => {
  const base = version([task()]);
  const target = version([task({ targetSpeed: 90 })]);
  const a = plans.basisOf([plans.monthImpact({ base, target, month: monthFrom(base) })]);
  const b = plans.basisOf([plans.monthImpact({ base, target, month: monthFrom(base, { a: { attempts: 1 } }) })]);
  assert.notEqual(a, b, "a take arriving since the review shows up");
  assert.equal(a, plans.basisOf([plans.monthImpact({ base, target, month: monthFrom(base) })]));
});

test("suggested tasks get due dates relative to the month", () => {
  const tasks = plans.tasksFromSuggestion({ tasks: [{ week: 1, dueOn: "2026-11-08" }, { week: 2, dueOn: null }] }, "2026-11-02");
  assert.deepEqual(tasks.map((t) => t.dueDay), [6, null]);
  assert.equal(tasks[0].dueOn, undefined);
});
