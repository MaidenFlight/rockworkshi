const Stripe = require("stripe");

// Stripe is optional in development so a fresh clone still runs the whole
// enrolment flow with nothing to sign up for — without a key the demo checkout
// takes over (see billing.routes.js). Production gets no such fallback: there
// the demo is refused, so an unconfigured key means nobody can enrol rather
// than everybody enrolling free.
//
// Keys are trimmed because they are pasted into hosting dashboards by hand and
// a trailing space turns a valid key into an authentication error that reads
// like a wrong key.
const SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();

// Signed events are the only ones worth acting on — the webhook URL is public,
// so without this anyone could POST "this account paid" at it.
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

const stripe = SECRET_KEY ? new Stripe(SECRET_KEY) : null;

function stripeEnabled() {
  return Boolean(stripe);
}

// Test keys carry "test" in the prefix (sk_test_…, and sk_live_… for real
// money). Worth surfacing rather than inferring from NODE_ENV, because the two
// can disagree — a live deployment still holding test keys takes no money, and
// a laptop holding live keys charges real cards.
function stripeIsLiveMode() {
  return SECRET_KEY.startsWith("sk_live_") || SECRET_KEY.startsWith("rk_live_");
}

module.exports = { stripe, stripeEnabled, stripeIsLiveMode, WEBHOOK_SECRET };
