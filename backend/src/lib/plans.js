// Canonical plan catalogue. This is the only place amounts are defined — the
// client sends a plan name, never a price, so a tampered request can't change
// what gets billed. Amounts are integer cents.
//
// `name` must match the labels the signup wizard shows
// (frontend/lib/auth/signupOptions.js); the lookup below falls back to the
// first plan rather than throwing if the two ever drift.
const PLANS = [
  {
    key: "lesson30",
    name: "30-Minute Lessons",
    description: "Weekly one-on-one",
    amountCents: 4500,
  },
  {
    key: "lesson45",
    name: "45-Minute Lessons",
    description: "Weekly one-on-one, most popular",
    amountCents: 6000,
  },
  {
    key: "band",
    name: "Rock Band Add-on",
    description: "Adds weekly group rehearsal",
    amountCents: 2500,
  },
];

// Charged on top of the plan when a student enrols with a friend or sibling.
const BAND_ADDON = PLANS.find((p) => p.key === "band");

function planFor(nameOrKey) {
  const wanted = (nameOrKey || "").trim().toLowerCase();
  return (
    PLANS.find((p) => p.name.toLowerCase() === wanted || p.key === wanted) || PLANS[0]
  );
}

function formatUsd(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Builds the order summary from what's stored on the user, so the total shown
// during checkout and the total recorded are always derived the same way.
function summaryFor(user) {
  const plan = planFor(user.plan);
  const lines = [{ label: plan.name, detail: plan.description, amountCents: plan.amountCents }];

  // The band add-on is implied by choosing band instruction, unless the plan
  // they picked already is the add-on.
  if (user.instructionType === "band" && plan.key !== BAND_ADDON.key) {
    lines.push({
      label: BAND_ADDON.name,
      detail: BAND_ADDON.description,
      amountCents: BAND_ADDON.amountCents,
    });
  }

  const totalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);

  return {
    plan: plan.name,
    planKey: plan.key,
    lines: lines.map((l) => ({ ...l, amount: formatUsd(l.amountCents) })),
    totalCents,
    total: formatUsd(totalCents),
    currency: "usd",
    // Billing is weekly, so make it explicit rather than implying a one-off.
    cadence: "week",
  };
}

module.exports = { PLANS, planFor, summaryFor, formatUsd };
