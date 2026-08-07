const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  next();
}

// The member area is what the membership buys, so the API has to enforce that
// itself. The client-side route guard only decides what to render; it can't
// stop a signed-in account from calling the endpoint directly, and the lesson
// record carries the video URLs.
function requirePaid(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  // Admins run the school rather than enrol in it — same exemption as the
  // paymentComplete flag in auth.routes.js.
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
