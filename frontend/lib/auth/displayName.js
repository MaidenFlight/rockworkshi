export function firstNameOf(user) {
  if (user?.name) return user.name.trim().split(/\s+/)[0];
  if (user?.email) return user.email.split("@")[0];
  return "there";
}

export function initialsOf(user) {
  const source = (user?.name || user?.email || "").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
