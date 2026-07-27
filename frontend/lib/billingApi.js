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
