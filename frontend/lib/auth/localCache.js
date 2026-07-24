const KEY = "rockworks_current_user";

export function readCachedUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedUser(user) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(KEY, JSON.stringify(user));
    else window.localStorage.removeItem(KEY);
  } catch {
    // localStorage unavailable (private mode, quota, disabled) — the session
    // cookie remains the source of truth, so this cache is purely optional.
  }
}
