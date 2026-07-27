import { API_URL } from "@/lib/api";

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Which social providers this server can actually complete a sign-in with, so
// the pages don't offer a button that errors out.
export async function fetchProviders() {
  try {
    const res = await fetch(`${API_URL}/auth/providers`, { credentials: "include" });
    if (!res.ok) return {};
    const data = await parseJson(res);
    return data?.providers || {};
  } catch {
    // Offline or API down — offer email sign-in only rather than failing.
    return {};
  }
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await parseJson(res);
  return data?.user || null;
}

export async function loginRequest(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Invalid email or password.");
  return data.user;
}

export async function signupRequest(payload) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Something went wrong.");
  return data.user;
}

export async function logoutRequest() {
  await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function updateProfileRequest(fields) {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(fields),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not update your profile.");
  return data.user;
}
