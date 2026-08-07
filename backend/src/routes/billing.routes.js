const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { summaryFor, planFor, formatUsd } = require("../lib/plans");
const { stripe, stripeEnabled, stripeIsLiveMode, WEBHOOK_SECRET } = require("../lib/stripe");

const router = express.Router();

// The demo checkout grants paid access without taking money, so it must never
// be reachable on a real deployment — that would be a free-enrolment hole.
// Opt in explicitly if you ever need it on a staging box.
const DEMO_CHECKOUT_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PAYMENTS === "true";

// Where the browser gets sent back to after Stripe is done with it. Trailing
// slash stripped because these are concatenated with paths.
function siteUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

// What the user is about to pay, priced from their stored plan rather than
// anything the client passes in.
router.get("/summary", requireAuth, (req, res) => {
  res.json({
    summary: summaryFor(req.user),
    demo: DEMO_CHECKOUT_ENABLED,
    // Whether a card can actually be charged, and whether doing so would move
    // real money. The checkout screen says so plainly rather than letting
    // someone believe a test payment enrolled them for real.
    stripe: stripeEnabled(),
    testMode: stripeEnabled() && !stripeIsLiveMode(),
    paidAt: req.user.paidAt,
  });
});

// Records a settled payment and opens the member area.
//
// Two different things call this — the webhook, and the browser coming back
// from Stripe — and either may arrive first, so it has to be safe to run twice.
// The unique `providerRef` is what makes the second run a no-op: checking for
// an existing row first would still race, because both callers can read "no row
// yet" before either writes. Letting the database reject the duplicate is the
// only version of this that is actually correct under concurrency.
async function recordPayment({
  user,
  providerRef,
  amountCents,
  currency,
  planName,
  description,
  customerId,
  subscriptionId,
}) {
  try {
    await prisma.payment.create({
      data: {
        userId: user.id,
        plan: planName,
        description,
        amountCents,
        currency,
        provider: "stripe",
        status: "paid",
        providerRef,
      },
    });
  } catch (err) {
    // P2002 is the unique-constraint violation: this payment is already on
    // record, so the other caller got here first and there is nothing to do.
    if (err.code === "P2002") return { duplicate: true };
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      // A renewal must not move the date the student originally enrolled.
      paidAt: user.paidAt || new Date(),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    },
  });

  return { duplicate: false };
}

// Hands the browser off to Stripe's hosted checkout. Nothing here trusts the
// request body: the plan comes off the account and the price comes off the
// catalogue, so a tampered request can't change what gets billed.
router.post("/checkout-session", requireAuth, async (req, res, next) => {
  if (!stripeEnabled()) {
    return res.status(503).json({ error: "Card payments aren't set up yet." });
  }

  try {
    if (req.user.paidAt) {
      return res.json({ alreadyPaid: true });
    }

    const plan = planFor(req.user.plan);
    const site = siteUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          // Priced inline on every request rather than from a Price object
          // created in the Stripe dashboard, so plans.js stays the single place
          // an amount is written down. A dashboard Price would be a second copy
          // to keep in step, and a stale one bills the wrong number silently.
          price_data: {
            currency: "usd",
            unit_amount: plan.amountCents,
            product_data: { name: plan.name, description: plan.description },
            // A term is three monthly intervals, not a unit of its own — the
            // shape Stripe wants, and already how the catalogue describes it.
            recurring: { interval: plan.interval, interval_count: plan.intervalCount },
          },
        },
      ],
      customer_email: req.user.email,
      client_reference_id: req.user.id,
      metadata: { userId: req.user.id, planKey: plan.key },
      // Copied onto the subscription as well, so a renewal invoice arriving
      // months from now can still say which account it belongs to.
      subscription_data: { metadata: { userId: req.user.id, planKey: plan.key } },
      // {CHECKOUT_SESSION_ID} is a placeholder Stripe substitutes itself — it
      // must reach them literally, so don't interpolate anything into it.
      success_url: `${site}/onboarding/payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/onboarding/payment?checkout=cancelled`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Called when the browser lands back on the success page. This exists so the
// student isn't left staring at an unpaid screen while the webhook is still in
// flight — but it re-reads the session from Stripe rather than believing the
// URL, because a session id in a query string proves nothing by itself.
router.post("/confirm", requireAuth, async (req, res, next) => {
  if (!stripeEnabled()) {
    return res.status(503).json({ error: "Card payments aren't set up yet." });
  }

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({ error: "Missing checkout session." });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Stripe's copy of the session says whose it is. Without this check anyone
    // could paste someone else's session id and be marked paid on their own
    // account.
    if (session.client_reference_id !== req.user.id) {
      return res.status(403).json({ error: "That checkout doesn't belong to this account." });
    }

    if (session.payment_status !== "paid") {
      return res.json({ paid: false, summary: summaryFor(req.user) });
    }

    const plan = planFor(session.metadata?.planKey || req.user.plan);
    await recordPayment({
      user: req.user,
      providerRef: session.id,
      amountCents: session.amount_total,
      currency: session.currency,
      planName: plan.name,
      description: plan.description,
      customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      subscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    });

    return res.json({ paid: true, summary: summaryFor(req.user) });
  } catch (err) {
    next(err);
  }
});

// Reads the live subscription from Stripe rather than mirroring it into our
// database. Cancellation state changes at Stripe's initiative as well as ours —
// a card can fail, a term can lapse — so a local copy would be one more thing
// that can silently disagree with the truth.
async function subscriptionStateFor(user) {
  if (!stripeEnabled() || !user.stripeSubscriptionId) return null;

  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  } catch (err) {
    // A subscription that no longer exists on Stripe isn't an error to show a
    // student — it just means there is nothing to manage.
    if (err.statusCode === 404) return null;
    throw err;
  }

  const item = sub.items?.data?.[0];
  // Stripe moved the period onto the subscription item; older shapes keep it on
  // the subscription, so read the item first and fall back.
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const plan = planFor(sub.metadata?.planKey || user.plan);

  return {
    status: sub.status,
    // True once cancellation is scheduled: they keep access until the date
    // below, then it lapses. Stripe calls this cancel_at_period_end.
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    plan: plan.name,
    cadence: plan.cadence,
    amount: formatUsd(item?.price?.unit_amount ?? plan.amountCents),
  };
}

router.get("/subscription", requireAuth, async (req, res, next) => {
  try {
    return res.json({ subscription: await subscriptionStateFor(req.user) });
  } catch (err) {
    next(err);
  }
});

// Stops the membership renewing, at the end of the period already paid for.
//
// Deliberately not an immediate cancellation: a student who has paid for this
// month — or this three-month term — keeps what they bought. It also means one
// path serves both plans, since "end of the paid period" is whatever they
// signed up for.
router.post("/cancel", requireAuth, async (req, res, next) => {
  if (!stripeEnabled() || !req.user.stripeSubscriptionId) {
    return res.status(400).json({ error: "There's no active membership to cancel." });
  }

  try {
    await stripe.subscriptions.update(req.user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    return res.json({ subscription: await subscriptionStateFor(req.user) });
  } catch (err) {
    next(err);
  }
});

// Undoes the above, while the period is still running.
router.post("/resume", requireAuth, async (req, res, next) => {
  if (!stripeEnabled() || !req.user.stripeSubscriptionId) {
    return res.status(400).json({ error: "There's no membership to resume." });
  }

  try {
    await stripe.subscriptions.update(req.user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    return res.json({ subscription: await subscriptionStateFor(req.user) });
  } catch (err) {
    next(err);
  }
});

// Stripe's own account of what happened, and the authority on who has paid —
// the browser may never come back from checkout at all, and renewals have no
// browser involved. Mounted in app.js ahead of the JSON body parser because the
// signature covers the exact bytes sent, which a parsed body has already lost.
async function stripeWebhook(req, res) {
  if (!stripeEnabled() || !WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Webhooks aren't configured." });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      WEBHOOK_SECRET
    );
  } catch (err) {
    // Worth logging loudly: this is either the wrong signing secret, a body
    // that got parsed on the way in, or someone probing a public endpoint.
    console.error("Stripe webhook signature check failed:", err.message);
    return res.status(400).json({ error: "Invalid signature." });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const user = await prisma.user.findUnique({
          where: { id: session.client_reference_id || "" },
        });
        if (user) {
          const plan = planFor(session.metadata?.planKey || user.plan);
          await recordPayment({
            user,
            providerRef: session.id,
            amountCents: session.amount_total,
            currency: session.currency,
            planName: plan.name,
            description: plan.description,
            customerId: session.customer,
            subscriptionId: session.subscription,
          });
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      // The period a cancelled member paid for has now run out — this fires at
      // the end of it, not when they asked to cancel, which is what lets them
      // keep the access they bought. Stripe also sends this when a subscription
      // dies on its own, after repeated failed payments.
      const sub = event.data.object;
      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            // Back to the payment gate. The enrolment history isn't lost —
            // every charge is still a Payment row.
            paidAt: null,
            stripeSubscriptionId: null,
          },
        });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      // Only later cycles. The invoice that opens a subscription is the same
      // money as checkout.session.completed above, and recording both would
      // show every student paying twice on day one.
      // A customer id is the only link back to an account here, so an invoice
      // without one can't be attributed and there is nothing to record.
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (invoice.billing_reason === "subscription_cycle" && customerId) {
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: customerId },
        });
        if (user) {
          const plan = planFor(user.plan);
          await recordPayment({
            user,
            providerRef: invoice.id,
            amountCents: invoice.amount_paid,
            currency: invoice.currency,
            planName: plan.name,
            description: `${plan.description} (renewal)`,
          });
        }
      }
    }
  } catch (err) {
    // Answer 500 so Stripe retries. Swallowing this would mean a student who
    // paid never gets access, with nothing left to replay it from.
    console.error("Stripe webhook handling failed:", err);
    return res.status(500).json({ error: "Webhook handling failed." });
  }

  return res.json({ received: true });
}

// Stand-in for a real processor, kept for development so the enrolment flow can
// be walked end to end without Stripe keys. Records the enrolment as paid and
// writes a Payment row marked "demo", so it is never mistaken for real money.
router.post("/demo-pay", requireAuth, async (req, res, next) => {
  if (!DEMO_CHECKOUT_ENABLED) {
    return res.status(403).json({ error: "Demo checkout is disabled." });
  }

  try {
    if (req.user.paidAt) {
      return res.json({ summary: summaryFor(req.user), alreadyPaid: true });
    }

    // Priced server-side; the request body is deliberately ignored.
    const summary = summaryFor(req.user);

    await prisma.payment.create({
      data: {
        userId: req.user.id,
        plan: summary.plan,
        description: summary.lines.map((l) => l.label).join(" + "),
        amountCents: summary.totalCents,
        currency: summary.currency,
        provider: "demo",
        status: "paid",
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { paidAt: new Date() },
    });

    return res.json({ summary, paid: true });
  } catch (err) {
    next(err);
  }
});

router.get("/payments", requireAuth, async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ payments });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, stripeWebhook };
