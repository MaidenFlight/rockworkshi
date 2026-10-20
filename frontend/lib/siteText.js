import { API_URL } from "@/lib/api";

// The tag every page's copy of the wording is cached under.
export const SITE_TEXT_TAG = "site-text";

// Server-only.
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
