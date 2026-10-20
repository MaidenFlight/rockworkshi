const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { summaryFor, planFor, formatUsd } = require("../lib/plans");
const { stripe, stripeEnabled, stripeIsLiveMode, WEBHOOK_SECRET } = require("../lib/stripe");

const router = express.Router();

// Demo checkout marks users as paid without charging, so it's off in production
// unless explicitly enabled (e.g. on staging).
const DEMO_CHECKOUT_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PAYMENTS === "true";

function siteUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

router.get("/summary", requireAuth, (req, res) => {
  res.json({
    summary: summaryFor(req.user),
    demo: DEMO_CHECKOUT_ENABLED,
    stripe: stripeEnabled(),
    testMode: stripeEnabled() && !stripeIsLiveMode(),
    paidAt: req.user.paidAt,
  });
});

// Called from both the webhook and /confirm, possibly at the same time.
// providerRef is unique, so the second insert fails with P2002 and is ignored.
// (A find-then-insert check would still race.)
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
    if (err.code === "P2002") return { duplicate: true };
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      // keep the original enrolment date on renewals
      paidAt: user.paidAt || new Date(),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    },
  });

  return { duplicate: false };
}

// Plan comes from the user record and price from plans.js, never from the request.
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
          // Inline price so plans.js stays the only place amounts are defined.
          price_data: {
            currency: "usd",
            unit_amount: plan.amountCents,
            product_data: { name: plan.name, description: plan.description },
            recurring: { interval: plan.interval, interval_count: plan.intervalCount },
          },
        },
      ],
      customer_email: req.user.email,
      client_reference_id: req.user.id,
      metadata: { userId: req.user.id, planKey: plan.key },
      // Also on the subscription so renewal invoices can be matched to a user.
      subscription_data: { metadata: { userId: req.user.id, planKey: plan.key } },
      // {CHECKOUT_SESSION_ID} is filled in by Stripe.
      success_url: `${site}/onboarding/payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/onboarding/payment?checkout=cancelled`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Called when the browser returns from Stripe, so the user doesn't have to wait
// for the webhook. Re-fetches the session from Stripe instead of trusting the URL.
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

// Read live from Stripe rather than storing a copy that can go stale.
async function subscriptionStateFor(user) {
  if (!stripeEnabled() || !user.stripeSubscriptionId) return null;

  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }

  const item = sub.items?.data?.[0];
  // Newer API versions put the period on the item.
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const plan = planFor(sub.metadata?.planKey || user.plan);

  return {
    status: sub.status,
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

// Cancels at the end of the paid period, not immediately.
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

// Stripe webhook. This is the source of truth for payments, since the browser
// may never come back from checkout and renewals have no browser at all.
// Mounted in app.js before express.json() (needs the raw body).
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
      // Fires when a cancelled subscription reaches the end of its period,
      // or after repeated failed payments. Payment history is kept.
      const sub = event.data.object;
      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            paidAt: null,
            stripeSubscriptionId: null,
          },
        });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      // Renewals only. The first invoice is already covered by checkout.session.completed.
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
    // Return 500 so Stripe retries the event.
    console.error("Stripe webhook handling failed:", err);
    return res.status(500).json({ error: "Webhook handling failed." });
  }

  return res.json({ received: true });
}

// Dev-only stand-in for Stripe so the signup flow works without keys.
router.post("/demo-pay", requireAuth, async (req, res, next) => {
  if (!DEMO_CHECKOUT_ENABLED) {
    return res.status(403).json({ error: "Demo checkout is disabled." });
  }

  try {
    if (req.user.paidAt) {
      return res.json({ summary: summaryFor(req.user), alreadyPaid: true });
    }

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
