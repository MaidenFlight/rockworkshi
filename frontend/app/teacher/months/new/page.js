"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewMonthPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <Redirect />
    </Suspense>
  );
}

// Planning a month moved to Plans, where drafts are saved on the server. An old link still lands in it.
function Redirect() {
  const router = useRouter();
  const student = useSearchParams().get("student");
  useEffect(() => {
    router.replace(student ? `/teacher/plans/new?student=${student}` : "/teacher/plans/new");
  }, [router, student]);
  return <p className="rw-st-muted">Loading…</p>;
}
