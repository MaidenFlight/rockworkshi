"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import MeetingRoom from "@/components/live/MeetingRoom";
import { api, hostPass, send, STATUS } from "@/lib/meetings";

// The host's view of one meeting: start it if it hasn't started, open the mixer, end it for everyone.
export default function MeetingHostPage({ params }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/admin/meetings/${id}`).then((d) => setMeeting(d.meeting)).catch((err) => setError(err.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function call(path, session) {
    setBusy(true);
    setError("");
    try {
      const { meeting: m } = await send(`/admin/meetings/${id}/${path}`, "POST");
      if (path === "end") await session?.leave();
      setMeeting((prev) => ({ ...prev, ...m }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function endButton(session) {
    return (
      <div className="rw-st-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="rw-st-btn"
          data-tone="primary"
          disabled={busy}
          onClick={() => window.confirm("End the meeting for everyone?") && call("end", session)}
        >
          End meeting for everyone
        </button>
      </div>
    );
  }

  return (
    <div className="rw-st">
      <div>
        <Link href="/admin/meetings" className="rw-st-muted">
          ← Meetings
        </Link>
        <h1 className="rw-st-title">{meeting?.title ?? "Meeting"}</h1>
        {meeting && (
          <p className="rw-st-lead">
            {meeting.when} · {meeting.invited.length} invited{" "}
            <span className="rw-st-chip" data-tone={STATUS[meeting.status]?.tone}>
              {STATUS[meeting.status]?.label}
            </span>
          </p>
        )}
      </div>
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      {meeting?.status === "scheduled" && (
        <div className="rw-st-card">
          <p>It hasn&apos;t started. Starting tells everyone invited, and their Join button opens.</p>
          <button type="button" className="rw-st-btn" data-tone="primary" disabled={busy} onClick={() => call("start")}>
            Start now
          </button>
        </div>
      )}
      {meeting?.status === "live" && (
        <MeetingRoom
          role="host"
          name={user?.name || "Host"}
          getPass={hostPass(id)}
          joinLabel="Open the mixer"
          intro="Your camera goes to every student. Nobody hears anyone until you pick them. The metronome stays off until you turn on Click."
          extra={endButton}
        />
      )}
      {(meeting?.status === "ended" || meeting?.status === "cancelled") && (
        <p className="rw-st-muted">This meeting is {meeting.status === "ended" ? "over" : "cancelled"}.</p>
      )}
    </div>
  );
}
