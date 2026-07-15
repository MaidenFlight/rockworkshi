"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";

export default function MemberLayout({ children }) {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/signin");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div style={{ maxWidth: 600, margin: "100px auto", textAlign: "center", color: "#6a6560" }}>
        Checking your session…
      </div>
    );
  }

  return children;
}
