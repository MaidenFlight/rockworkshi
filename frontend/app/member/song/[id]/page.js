"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import StemPlayer from "@/components/member/StemPlayer";
import FavoriteButton from "@/components/member/library/FavoriteButton";
import PracticeNotes from "@/components/member/library/PracticeNotes";
import { NetworkError, practiceRequest } from "@/lib/practice";

export default function SongPlayAlong() {
  const { id } = useParams();
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
    Promise.allSettled([practiceRequest(`/songs/${id}/practice`), practiceRequest(`/songs/${id}/tracks`)]).then(
      ([practice, tracks]) => {
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
        });
        setFailure(null);
      }
    );
    // For "Continue practising". Not worth an error if it doesn't arrive.
    practiceRequest(`/songs/${id}/practice/opened`, { method: "POST" }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

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

  const { song, practice, tracks } = page;
  // Resume state only goes back to the server when something changed, and at most every few seconds.
  const saveSession = (session, { keepalive } = {}) =>
    practiceRequest(`/songs/${song.id}/practice/session`, {
      method: "PUT",
      keepalive,
      body: JSON.stringify({ session }),
    });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href="/member/library" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        &larr; Practice library
      </Link>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 10, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)" }}>
            Play along{song.level ? ` · ${song.level}` : ""}
          </div>
          <h1 style={{ fontWeight: 600, fontSize: 30, color: "var(--rw-ink)", margin: "6px 0 2px" }}>{song.title}</h1>
          <p style={{ color: "var(--rw-meta)", margin: 0 }}>{song.artist}</p>
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

      {page.access && !page.access.allowed ? (
        // The server refuses the stems too; this just explains why instead of a broken player.
        <div role="status" style={{ padding: 20, background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, lineHeight: 1.55 }}>
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
          <StemPlayer
            tracks={tracks.tracks}
            myPart={tracks.myPart}
            title={song.title}
            songId={song.id}
            mixLevel={tracks.mixLevel}
            resume={practice.session}
            onSaveSession={saveSession}
          />
          <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--rw-meta)", lineHeight: 1.55 }}>
            {practice.session?.position
              ? "Opened where you left off. Press Play when you're ready."
              : "Pick Without one part and choose your instrument to play along with the band."}
          </p>
        </>
      ) : (
        <div style={{ padding: 20, background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14 }}>
          {page.tracksOffline ? (
            <>
              You&apos;re offline, so the band can&apos;t load.{" "}
              <button type="button" onClick={() => setAttempt((n) => n + 1)} style={retryButton}>
                Retry
              </button>
            </>
          ) : (
            "This song doesn't have play-along stems yet. You can still star it and keep notes."
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
  borderRadius: 6,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
