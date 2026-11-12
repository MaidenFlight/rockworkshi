// The API sends every role someone holds (user.roles) and flags for the main ones. getUserRole
// picks the one that decides where they land: admin, then teacher, then guardian, then student.
export const ROLES = {
  STUDENT: "student",
  GUARDIAN: "guardian",
  TEACHER: "teacher",
  ADMINISTRATOR: "administrator",
};

export function getUserRole(user) {
  if (!user) return null;
  if (user.isAdmin) return ROLES.ADMINISTRATOR;
  if (user.isTeacher || user.role === "teacher") return ROLES.TEACHER;
  if (user.role === "guardian") return ROLES.GUARDIAN;
  return ROLES.STUDENT;
}

// Whether someone holds a role at all, even if it isn't their main one: a teacher who is a parent, or
// the school's director, who teaches and runs the school from one account. The flags cover a user
// saved in this browser before the API sent every role.
export function holds(user, role) {
  if (user?.roles?.includes(role)) return true;
  if (role === "teacher") return Boolean(user?.isTeacher || user?.role === "teacher");
  if (role === "admin") return Boolean(user?.isAdmin);
  return false;
}

export function hasRole(user, role) {
  return getUserRole(user) === role;
}

export function hasAnyRole(user, roles) {
  const role = getUserRole(user);
  return roles.includes(role);
}
