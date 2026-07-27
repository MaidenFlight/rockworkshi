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

const app = express();

// In development the frontend is reached from whatever host the browser used —
// localhost on this machine, or the machine's LAN IP when testing on a phone.
// That IP is a DHCP lease and changes, so match the private ranges rather than
// pinning one address. Production still allows only the configured origin.
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
app.use("/", publicRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

module.exports = app;
