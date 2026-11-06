const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");
const clock = require("../lib/clock");
const { isDemo } = require("../lib/demoRules");

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          include: { roles: true },
        });
        // A student demo account is only ever entered through "Try student demo" (POST /auth/demo).
        if (!user || !user.passwordHash || isDemo(user)) {
          return done(null, false, { message: "Incorrect email or password." });
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
          return done(null, false, { message: "Incorrect email or password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
    // A demo that has run out is signed out, even before the sweep deletes it (lib/demo.js).
    if (isDemo(user) && user.demoExpiresAt <= clock.now()) return done(null, false);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
