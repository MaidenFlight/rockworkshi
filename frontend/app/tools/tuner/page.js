"use client";

import Tuner from "@/components/tuner/Tuner";

// The tuner, free for everyone. The same tuner is the guided practice session's first step.
export default function TunerPage() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "var(--rw-ink)", marginBottom: 8 }}>Tuner</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 32 }}>Use your microphone to tune by ear, or play a reference tone for any string.</p>
      <Tuner />
    </div>
  );
}
