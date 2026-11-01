import { practiceRequest } from "@/lib/practice";

// Shared by the admin term pages. Times arrive from the API already formatted for
// Honolulu (…Display) and as Honolulu local values for form fields (…Local), so the
// browser's own time zone never enters into it.
export const termRequest = practiceRequest;

export function slotStatus(slot) {
  if (!slot.published) return { label: "Draft", tone: "draft" };
  return slot.open ? { label: "Published · open", tone: "open" } : { label: "Published · waiting for its date", tone: "ready" };
}

export const MONTH_NAMES = { 1: "Month 1", 2: "Month 2", 3: "Month 3" };

export function pill(tone) {
  const colors = { draft: ["#eef0ec", "var(--rw-body)"], ready: ["#fff7e6", "#8a5a00"], open: ["#e3f3ea", "#1f7a4d"] }[tone];
  return { fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: colors[0], color: colors[1] };
}
