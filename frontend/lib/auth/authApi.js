import { API_URL } from "@/lib/api";

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Confirms an address from the token in the emailed link.
export async function verifyEmailToken(token) {
  const res = await fetch(`${API_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not confirm your email.");
  return data?.status || "invalid";
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not change your password.");
  return data;
}

// Starts a reset.
export async function requestPasswordReset(email) {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not send the email.");
  return data;
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not reset your password.");
  return data;
}

// Asks for a fresh verification email for the signed-in account.
export async function resendVerification() {
  const res = await fetch(`${API_URL}/auth/resend-verification`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not send the email.");
  return data;
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

// The student demo (backend lib/demo.js): { open, song, instruments }. Open while an admin has set its
// passcode; instruments are the ones it offers.
export async function demoStatusRequest() {
  const res = await fetch(`${API_URL}/auth/demo`, { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "The demo couldn't be reached. Try again in a moment.");
  return { open: Boolean(data?.open), song: data?.song ?? null, instruments: data?.instruments ?? [] };
}

// The Demo tab's first step: throws with the reason when the passcode won't open the demo.
export async function demoCheckRequest(passcode) {
  const res = await fetch(`${API_URL}/auth/demo/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ passcode }),
  });
  if (res.ok) return true;
  const data = await parseJson(res);
  throw new Error(data?.error || "That passcode couldn't be checked. Try again in a moment.");
}

// Signs this browser into a sample student of that instrument, its own. Someone already in a demo
// needs no passcode, and another instrument swaps their demo for a new one.
export async function demoRequest({ passcode, instrument }) {
  const res = await fetch(`${API_URL}/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ passcode, instrument }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "The demo couldn't start. Try again in a moment.");
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
