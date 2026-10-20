// Plan catalogue. Prices are only defined here; the client sends a plan name,
// never an amount. Amounts are in cents.
//
// `name` has to match the labels in frontend/lib/auth/signupOptions.js.
// Unknown or old plan names fall back to Monthly.
const PLANS = [
  {
    key: "monthly",
    name: "Monthly",
    description: "Full access to the member area",
    amountCents: 5500,
    interval: "month",
    intervalCount: 1,
    cadence: "month",
    note: "Cancel any time.",
  },
  {
    key: "term",
    name: "Term",
    description: "Full access, paid up front for a three-month term",
    amountCents: 13500,
    interval: "month",
    intervalCount: 3,
    cadence: "3 months",
    note: "Works out at $45 a month. Renews at the start of each term.",
  },
];

function planFor(nameOrKey) {
  const wanted = (nameOrKey || "").trim().toLowerCase();
  return (
    PLANS.find((p) => p.name.toLowerCase() === wanted || p.key === wanted) || PLANS[0]
  );
}

function formatUsd(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Order summary built from the stored plan, used for both display and billing.
function summaryFor(user) {
  const plan = planFor(user.plan);
  const lines = [{ label: plan.name, detail: plan.description, amountCents: plan.amountCents }];

  const totalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);

  return {
    plan: plan.name,
    planKey: plan.key,
    lines: lines.map((l) => ({ ...l, amount: formatUsd(l.amountCents) })),
    totalCents,
    total: formatUsd(totalCents),
    currency: "usd",
    cadence: plan.cadence,
    note: plan.note,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
  };
}

module.exports = { PLANS, planFor, summaryFor, formatUsd };
