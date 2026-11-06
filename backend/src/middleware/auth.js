const { readMobileToken, passwordStamp } = require("../lib/mobileToken");
const { isAdmin, isTeacher, isGuardian } = require("../lib/roles");
const prisma = require("../lib/prisma");

// Mobile app sends "Authorization: Bearer <token>" instead of a session cookie.
async function bearerAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (req.user || !header.startsWith("Bearer ")) return next();
  let claims;
  try {
    claims = readMobileToken(header.slice(7));
  } catch {
    // Bad or expired token: carry on unauthenticated, routes will 401.
    return next();
  }
  // Outside the try: a database failure is a server error, not a signed-out user.
  const user = await prisma.user.findUnique({ where: { id: claims.sub }, include: { roles: true } });
  // A stamp from an older password means the password changed after this token was issued.
  if (user && claims.pw === passwordStamp(user)) req.user = user;
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
  if (!isAdmin(req.user) && !isTeacher(req.user) && !req.user.paidAt) {
    return res.status(402).json({ error: "A membership is required." });
  }
  next();
}

// Roles are granted by an admin (lib/roles.js). Which students a teacher may see is checked per
// route, against TeacherStudent links.
function requireTeacher(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  if (!isTeacher(req.user)) {
    return res.status(403).json({ error: "Teacher access required." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

// Parents and guardians, linked to their children by an admin's invite.
function requireGuardian(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not signed in." });
  }
  if (!isGuardian(req.user)) {
    return res.status(403).json({ error: "Guardian access required." });
  }
  next();
}

module.exports = { requireAuth, requirePaid, requireTeacher, requireAdmin, requireGuardian, bearerAuth };