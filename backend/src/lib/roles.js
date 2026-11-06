// Who someone is to the school. A person can hold several roles: a teacher who is also a parent,
// say. Roles come from three places, all read here so no route has to know about them:
//   - User.role ("student", "teacher" or "guardian"), the original single role;
//   - UserRole rows ("teacher", "admin", "guardian"), granted by an admin;
//   - ADMIN_EMAIL, the school's first admin, who is always an admin.
// The session and bearer-token user is loaded with its UserRole rows (see config/passport.js and
// middleware/auth.js), so these checks don't touch the database.
const prisma = require("./prisma");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const GRANTABLE = ["teacher", "admin", "guardian"];

function rolesOf(user) {
  if (!user) return [];
  const roles = new Set(["student", "teacher", "guardian"].includes(user.role) ? [user.role] : ["student"]);
  for (const r of user.roles || []) roles.add(r.role);
  if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) roles.add("admin");
  return [...roles];
}

const isAdmin = (user) => rolesOf(user).includes("admin");
const isTeacher = (user) => rolesOf(user).includes("teacher");
const isGuardian = (user) => rolesOf(user).includes("guardian");

// The roles an admin has granted, replaced as a set. User.role follows for "teacher" so the phone
// app and the older teacher checks agree. The ADMIN_EMAIL account can't lose admin.
async function setRoles(userId, roles, actorId) {
  const wanted = [...new Set(roles)].filter((r) => GRANTABLE.includes(r));
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!user) return null;
  const had = user.roles.map((r) => r.role);
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId, role: { notIn: wanted } } }),
    ...wanted.filter((r) => !had.includes(r)).map((role) => prisma.userRole.create({ data: { userId, role, grantedBy: actorId } })),
    prisma.user.update({
      where: { id: userId },
      data: { role: wanted.includes("teacher") ? "teacher" : user.role === "teacher" ? "student" : user.role },
    }),
  ]);
  return { before: had, after: wanted };
}

module.exports = { GRANTABLE, rolesOf, isAdmin, isTeacher, isGuardian, setRoles };
