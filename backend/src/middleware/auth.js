const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// Mobile app sends "Authorization: Bearer <token>" instead of a session cookie.
async function bearerAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (req.user || !header.startsWith("Bearer ")) return next();
  try {
    const { sub } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (user) req.user = user;
  } catch {
    // Bad or expired token: carry on unauthenticated, routes will 401.
  }
  next();
}


function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  next();
}

// The client-side guard only controls rendering, so paid access is enforced here.
// Teachers are staff, so they see the material they assign without a membership.
function requirePaid(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  const isAdmin = Boolean(ADMIN_EMAIL) && req.user.email === ADMIN_EMAIL;
  if (!isAdmin && req.user.role !== "teacher" && !req.user.paidAt) {
    return res.status(402).json({ error: "A membership is required." });
  }
  next();
}

// The role is set by the admin. Which students a teacher may see is checked per route,
// against TeacherStudent links.
function requireTeacher(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  if (req.user.role !== "teacher") {
    return res.status(403).json({ error: "Teacher access required." });
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

module.exports = { requireAuth, requirePaid, requireTeacher, requireAdmin, bearerAuth };