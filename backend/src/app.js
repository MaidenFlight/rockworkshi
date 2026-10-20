const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const passport = require("./config/passport");
const prisma = require("./lib/prisma");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const publicRoutes = require("./routes/public.routes");
const lessonsRoutes = require("./routes/lessons.routes");
const { router: billingRoutes, stripeWebhook } = require("./routes/billing.routes");

const app = express();

// Render terminates TLS at its proxy. Without this req.secure is false and
// the secure session cookie never gets set.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Dev: allow localhost and private LAN ranges so the site can be tested from a phone.
const LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === process.env.FRONTEND_URL) return callback(null, true);
      if (process.env.NODE_ENV !== "production" && LAN_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Must be registered before express.json(): signature verification needs the raw body.
app.post("/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriodMs: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    }),
    cookie: {
      httpOnly: true,
      // lax works because the API is on a subdomain of the site (same-site).
      // On a separate domain this would need sameSite "none".
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/lessons", lessonsRoutes);
app.use("/billing", billingRoutes);
app.use("/", publicRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

module.exports = app;
