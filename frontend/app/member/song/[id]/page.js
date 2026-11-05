"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { useAuth } from "@/contexts/AuthContext";
import StemPlayer from "@/components/member/StemPlayer";
import FavoriteButton from "@/components/member/library/FavoriteButton";
import PracticeNotes from "@/components/member/library/PracticeNotes";
import { NetworkError, practiceRequest } from "@/lib/practice";
import { hasLoop, sendForReview } from "@/lib/teaching";

export default function SongPlayAlongPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={null}>
      <SongPlayAlong />
    </Suspense>
  );
}

function SongPlayAlong() {
  const { id } = useParams();
  const router = useRouter();
  // Set when the song was opened from a teacher's practice work.
  const assignmentId = useSearchParams().get("assignment");
  const { user } = useAuth();
  // undefined = loading, null = failed (see failure)
  const [page, setPage] = useState(undefined); // { song, practice, tracks: data | null }
  const [failure, setFailure] = useState(null); // { offline, message }
  const [favorite, setFavorite] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // The practice row says whether the song exists; the tracks may 404 just because
    // the song has no stems yet, which still leaves notes and favourites to show.
    // The assignment only adds the brief, the loop and sending, so the song opens without it.
    Promise.allSettled([
      practiceRequest(`/songs/${id}/practice`),
      practiceRequest(`/songs/${id}/tracks`),
      assignmentId ? practiceRequest(`/assignments/${assignmentId}`) : Promise.resolve(null),
    ]).then(
      ([practice, tracks, assignment]) => {
        if (cancelled) return;
        if (practice.status === "rejected") {
          setFailure({ offline: practice.reason instanceof NetworkError, message: practice.reason.message });
          setPage(null);
          return;
        }
        setFavorite(practice.value.practice.favorite);
        setPage({
          ...practice.value,
          tracks: tracks.status === "fulfilled" ? tracks.value : null,
          tracksOffline: tracks.status === "rejected" && tracks.reason instanceof NetworkError,
          assignment: assignment.status === "fulfilled" && assignment.value?.assignment.song?.id === id ? assignment.value.assignment : null,
        });
        setFailure(null);
      }
    );
    // For "Continue practising". Not worth an error if it doesn't arrive.
    practiceRequest(`/songs/${id}/practice/opened`, { method: "POST" }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, assignmentId, attempt]);

  if (page === undefined) {
    return (
      <div role="status" style={{ maxWidth: 800, margin: "80px auto", textAlign: "center", color: "var(--rw-body)" }}>
        Loading…
      </div>
    );
  }
  if (!page) {
    return (
      <div role="alert" style={{ maxWidth: 800, margin: "80px auto", textAlign: "center", color: "var(--rw-body)", lineHeight: 1.6 }}>
        {failure?.offline ? "You're offline, so this song can't be loaded." : failure?.message || "Song not found."}{" "}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} style={retryButton}>
          Retry
        </button>
        <div style={{ marginTop: 10 }}>
          <Link href="/member/library" style={{ color: "var(--rw-orange-deep)" }}>
            Back to your library
          </Link>
        </div>
      </div>
    );
  }

  const { song, practice, tracks, assignment } = page;
  const backHref = assignment ? `/member/assignment/${assignment.id}` : "/member/library";
  const initialLoop = assignment && hasLoop(assignment) ? { start: assignment.sectionStart, end: assignment.sectionEnd } : null;
  // Resume state only goes back to the server when something changed, and at most every few seconds.
  const saveSession = (session, { keepalive } = {}) =>
    practiceRequest(`/songs/${song.id}/practice/session`, {
      method: "PUT",
      keepalive,
      body: JSON.stringify({ session }),
    });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href={backHref} style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        <Icon name="arrow-left" size={14} /> {assignment ? "Practice work" : "Practice library"}
      </Link>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 10, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 30, color: "var(--rw-ink)", margin: "0 0 2px" }}>{song.title}</h1>
          <p style={{ color: "var(--rw-meta)", margin: 0 }}>{[song.artist, song.level].filter(Boolean).join(" · ")}</p>
        </div>
        <FavoriteButton
          songId={song.id}
          title={song.title}
          favorite={favorite}
          onChange={setFavorite}
          size={26}
          onError={(err) =>
            setNotice(err instanceof NetworkError ? "You're offline, so that favourite wasn't saved." : err.message)
          }
        />
      </div>
      {notice && (
        <p role="status" style={{ margin: "-10px 0 16px", fontSize: 13.5, color: "var(--rw-orange-deep)" }}>
          {notice}
        </p>
      )}

      {assignment && (
        <div style={{ padding: "14px 18px", marginBottom: 16, background: "var(--rw-sand)", borderRadius: "var(--rw-radius-md)", lineHeight: 1.55 }}>
          <div style={{ fontWeight: 700, color: "var(--rw-ink)" }}>
            {[assignment.instrument, `Level ${assignment.level}${assignment.levelName ? ` ${assignment.levelName}` : ""}`, assignment.section].filter(Boolean).join(" · ")}
          </div>
          <div style={{ color: "var(--rw-body)", whiteSpace: "pre-wrap" }}>{assignment.instruction}</div>
        </div>
      )}

      {page.access && !page.access.allowed ? (
        // The server refuses the stems too; this just explains why instead of a broken player.
        <div role="status" style={{ padding: 20, background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--rw-ink)" }}>{page.access.message}</strong>
          <div style={{ marginTop: 6, color: "var(--rw-body)", fontSize: 14 }}>
            Your term&apos;s songs open month by month.{" "}
            <Link href="/member" style={{ color: "var(--rw-orange-deep)" }}>
              See your term
            </Link>
          </div>
        </div>
      ) : tracks ? (
        <>
          {practice.session?.position && !initialLoop ? (
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--rw-meta)", lineHeight: 1.55 }}>
              Opened where you left off. Press Play when you&apos;re ready.
            </p>
          ) : null}
          <StemPlayer
            tracks={tracks.tracks}
            myPart={tracks.myPart}
            title={song.title}
            songId={song.id}
            mixLevel={tracks.mixLevel}
            resume={practice.session}
            onSaveSession={saveSession}
            initialLoop={initialLoop}
            onSendTake={
              assignment && assignment.status !== "ready"
                ? async (take, onProgress) => {
                    await sendForReview(assignment.id, take, onProgress);
                    router.push(`/member/assignment/${assignment.id}`);
                  }
                : null
            }
          />
        </>
      ) : (
        <div style={{ padding: 20, background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)" }}>
          {page.tracksOffline ? (
            <>
              You&apos;re offline, so the band can&apos;t load.{" "}
              <button type="button" onClick={() => setAttempt((n) => n + 1)} style={retryButton}>
                Retry
              </button>
            </>
          ) : (
            "This song's play-along is coming soon."
          )}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        {user?.id && <PracticeNotes key={song.id} songId={song.id} userId={user.id} initialNotes={practice.notes} />}
      </div>
    </div>
  );
}

const retryButton = {
  padding: "5px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
