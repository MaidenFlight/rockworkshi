const Stripe = require("stripe");

// Without a key, dev falls back to the demo checkout (see billing.routes.js).
// Production refuses the demo, so a missing key blocks enrolment instead.
const SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

const stripe = SECRET_KEY ? new Stripe(SECRET_KEY) : null;

function stripeEnabled() {
  return Boolean(stripe);
}

// Based on the key prefix rather than NODE_ENV, since the two can disagree.
function stripeIsLiveMode() {
  return SECRET_KEY.startsWith("sk_live_") || SECRET_KEY.startsWith("rk_live_");
}

module.exports = { stripe, stripeEnabled, stripeIsLiveMode, WEBHOOK_SECRET };
