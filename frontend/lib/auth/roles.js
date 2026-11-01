// user.role comes from the API ("student" or "teacher"). Administrator isn't stored:
// it's the ADMIN_EMAIL account, flagged as user.isAdmin.
export const ROLES = {
  STUDENT: "student",
  PARENT: "parent",
  TEACHER: "teacher",
  ADMINISTRATOR: "administrator",
};

export function getUserRole(user) {
  if (!user) return null;
  if (user.isAdmin) return ROLES.ADMINISTRATOR;
  return user.role || ROLES.STUDENT;
}

export function hasRole(user, role) {
  return getUserRole(user) === role;
}

export function hasAnyRole(user, roles) {
  const role = getUserRole(user);
  return roles.includes(role);
}
