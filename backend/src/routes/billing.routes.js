const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { summaryFor } = require("../lib/plans");

const router = express.Router();

// The demo checkout grants paid access without taking money, so it must never
// be reachable on a real deployment — that would be a free-enrolment hole.
// Opt in explicitly if you ever need it on a staging box.
const DEMO_CHECKOUT_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PAYMENTS === "true";

// What the user is about to pay, priced from their stored plan rather than
// anything the client passes in.
router.get("/summary", requireAuth, (req, res) => {
  res.json({
    summary: summaryFor(req.user),
    demo: DEMO_CHECKOUT_ENABLED,
    paidAt: req.user.paidAt,
  });
});

// Stand-in for a real processor. Records the enrolment as paid and keeps a
// Payment row so the history is already shaped for a real provider later.
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

module.exports = router;
