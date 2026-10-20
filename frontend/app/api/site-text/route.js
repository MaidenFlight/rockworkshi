import { revalidateTag } from "next/cache";
import { SITE_TEXT_TAG } from "@/lib/siteText";

// Called by the editor right after a save to the API succeeds.
export async function POST() {
  revalidateTag(SITE_TEXT_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
