const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  next();
}

// The client-side guard only controls rendering, so paid access is enforced here.
function requirePaid(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  const isAdmin = Boolean(ADMIN_EMAIL) && req.user.email === ADMIN_EMAIL;
  if (!isAdmin && !req.user.paidAt) {
    return res.status(402).json({ error: "A membership is required." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  if (!ADMIN_EMAIL || req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

module.exports = { requireAuth, requirePaid, requireAdmin };
