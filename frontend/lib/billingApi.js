import { API_URL } from "@/lib/api";

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// The order summary is priced by the server from the plan on the account, so
// the checkout screen only ever renders numbers it was given.
export async function fetchBillingSummary() {
  const res = await fetch(`${API_URL}/billing/summary`, { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not load your order summary.");
  return data;
}

// Asks the API to open a Stripe checkout and hands back the URL to send the
// browser to. Card details are only ever typed on Stripe's own page, so they
// never touch this site.
export async function startStripeCheckout() {
  const res = await fetch(`${API_URL}/billing/checkout-session`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Could not start checkout.");
  return data;
}

// Called on the way back from Stripe. The webhook is what actually decides who
// has paid; this just asks the server to check now rather than leaving the
// student watching an unpaid screen until the webhook lands.
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
