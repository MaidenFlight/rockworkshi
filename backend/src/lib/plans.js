// Canonical plan catalogue. This is the only place amounts are defined — the
// client sends a plan name, never a price, so a tampered request can't change
// what gets billed. Amounts are integer cents.
//
// What is being sold here is access to the member area — lessons, the song
// library, the practice tools. Teaching itself is arranged with the school and
// is deliberately not priced here.
//
// `name` must match the labels the signup wizard shows
// (frontend/lib/auth/signupOptions.js); the lookup below falls back to the
// first plan rather than throwing if the two ever drift. That fallback also
// covers accounts created before this catalogue changed, whose stored plan is
// a lesson tier that no longer exists — they land on Monthly.
//
// `interval` and `intervalCount` are the shape a processor wants for a
// recurring price, so a term is three monthly intervals rather than its own
// unit. Keeping them here means the billing cadence is defined in one place
// alongside the amount it applies to.
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

// Builds the order summary from what's stored on the user, so the total shown
// during checkout and the total recorded are always derived the same way.
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
    // How often this recurs, phrased for a reader — "month", "3-month term".
    cadence: plan.cadence,
    // The fine print under the total. Differs per plan: a term is a
    // commitment, so it must not claim you can cancel any time.
    note: plan.note,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
  };
}

module.exports = { PLANS, planFor, summaryFor, formatUsd };
