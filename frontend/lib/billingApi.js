import { API_URL } from "@/lib/api";

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBillingSummary() {
  const res = await fetch(`${API_URL}/billing/summary`, { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not load your order summary.");
  return data;
}

// Asks the API to open a Stripe checkout and hands back the URL to send the browser to.
export async function startStripeCheckout() {
  const res = await fetch(`${API_URL}/billing/checkout-session`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not start checkout.");
  return data;
}

// Called on the way back from Stripe.
export async function confirmStripeCheckout(sessionId) {
  const res = await fetch(`${API_URL}/billing/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not confirm your payment.");
  return data;
}

export async function fetchSubscription() {
  const res = await fetch(`${API_URL}/billing/subscription`, { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not load your membership.");
  return data.subscription;
}

// Stops the membership renewing at the end of the period already paid for.
export async function cancelSubscription() {
  const res = await fetch(`${API_URL}/billing/cancel`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not cancel your membership.");
  return data.subscription;
}

export async function resumeSubscription() {
  const res = await fetch(`${API_URL}/billing/resume`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not resume your membership.");
  return data.subscription;
}

// Stand-in for a real processor: marks the enrolment paid without taking money.
export async function payDemo() {
  const res = await fetch(`${API_URL}/billing/demo-pay`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not complete checkout.");
  return data;
}
