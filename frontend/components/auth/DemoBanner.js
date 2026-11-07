"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui";

// Under the header on every page while someone is in the student demo (backend lib/demo.js): what it
// is, what it won't do, and the ways on: another instrument (the Demo tab) or out. Leaving deletes the
// demo, so the next visit starts afresh.
export default function DemoBanner() {
  const { user, leaveDemo } = useAuth();
  const [leaving, setLeaving] = useState(false);
  if (!user?.isDemo) return null;

  async function leave() {
    setLeaving(true);
    try {
      await leaveDemo();
    } catch {
      setLeaving(false);
    }
  }

  return (
    <aside className="rw-demo-band" aria-label="Student demo">
      <div className="rw-demo-inner">
        <p className="rw-demo-text">
          <strong className="rw-demo-tag">Student demo{user.instrument ? ` · ${user.instrument}` : ""}</strong>
          Explore with sample data. Nothing is booked, charged or sent to a real teacher, and changes reset when you leave.
        </p>
        <div className="rw-demo-actions">
          <Button href="/demo" variant="secondary" size="sm" className="rw-demo-leave">
            Change instrument
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={leave} disabled={leaving} className="rw-demo-leave">
            {leaving ? "Leaving…" : "Leave demo"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
