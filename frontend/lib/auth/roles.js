export const ROLES = {
  STUDENT: "student",
  PARENT: "parent",
  INSTRUCTOR: "instructor",
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
