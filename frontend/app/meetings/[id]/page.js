"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import MeetingRoom from "@/components/live/MeetingRoom";
import { api, studentPass } from "@/lib/meetings";

export default function MeetingPage({ params }) {
  const { id } = use(params);
  return (
    <ProtectedRoute requireEnrolment={false}>
      <Meeting id={id} />
    </ProtectedRoute>
  );
}

function Meeting({ id }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api(`/meetings/${id}`).then(setData).catch((err) => setError(err.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 100px" }}>
      <Link href="/meetings" className="rw-st-muted">
        ← Meetings
      </Link>
      <h1 className="rw-st-title">{data?.meeting.title ?? "Meeting"}</h1>
      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}
      {data?.host ? (
        <p>
          You&apos;re an admin: run this meeting from the <Link href={`/admin/meetings/${id}/host`}>host view</Link>.
        </p>
      ) : data?.meeting.status === "live" ? (
        <MeetingRoom
          role="kid"
          name={user?.name || "Student"}
          getPass={studentPass(id)}
          joinLabel="Join the meeting"
          intro="You'll see and hear the teacher. Your camera and microphone go only to the teacher, unless they put you on stage."
          onLeft={load}
        />
      ) : data ? (
        <p className="rw-st-muted">
          {data.meeting.status === "scheduled" ? `It starts ${data.meeting.when}. Join opens then.` : "This meeting is over."}
        </p>
      ) : null}
    </main>
  );
}
