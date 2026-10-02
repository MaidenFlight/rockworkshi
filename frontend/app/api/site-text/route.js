import { revalidateTag } from "next/cache";
import { SITE_TEXT_TAG } from "@/lib/siteText";

// Called by the editor right after a save to the API succeeds. Expiring
// immediately rather than with "max" so the very next visitor gets the new
// wording instead of one more view of the old.
//
// Unauthenticated on purpose: the admin's session cookie belongs to the API's
// domain, not this one, so there is nothing here to check it against. All this
// can do is make the next page view re-read the wording from the API once, and
// the save itself is what the API guards.
export async function POST() {
  revalidateTag(SITE_TEXT_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
