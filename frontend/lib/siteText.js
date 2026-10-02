import { API_URL } from "@/lib/api";

// The tag every page's copy of the wording is cached under. Saving an edit
// expires it (app/api/site-text/route.js), so the next visitor to any page gets
// the new text; the five-minute revalidate is only the fallback if that call
// is ever missed.
export const SITE_TEXT_TAG = "site-text";

// Server-only. Returns { key: value } for every piece of wording an admin has
// changed. Anything missing here renders the text written in the page's code,
// so a slow or unreachable API costs nothing but the edits — never the page.
export async function getSiteText() {
  try {
    const res = await fetch(`${API_URL}/site-text`, {
      next: { tags: [SITE_TEXT_TAG], revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.text || {};
  } catch {
    return {};
  }
}
