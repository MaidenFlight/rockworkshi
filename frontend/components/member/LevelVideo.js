"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/member/Icon";
import { practiceRequest } from "@/lib/practice";

// The song's video for the level a task works at (Level 1 is the Sing-a-long), from the school's own
// tutorials: a way to it once it's published, and "coming soon" until then. Says nothing at all when the
// videos can't be checked, rather than claiming either.
export default function LevelVideo({ songId, level, levelName, assignmentId }) {
  const [state, setState] = useState({ key: null, ready: null });
  const key = `${songId}:${level}`;

  useEffect(() => {
    let stale = false;
    practiceRequest(`/songs/${songId}/tutorials`)
      .then((data) => {
        const here = data?.levels?.find((l) => l.level === level);
        if (!stale) setState({ key, ready: Boolean(here?.videos?.some((v) => v.status === "ready")) });
      })
      .catch(() => !stale && setState({ key, ready: null }));
    return () => {
      stale = true;
    };
  }, [songId, level, key]);

  if (state.key !== key || state.ready === null) return null;
  const name = `Level ${level}${levelName ? ` · ${levelName}` : ""}`;

  return (
    <p style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px", margin: "0 0 16px", color: "var(--rw-body)", lineHeight: 1.5 }}>
      <span aria-hidden="true" style={{ display: "inline-flex", color: "var(--rw-teal)" }}>
        <Icon name="play" size={16} />
      </span>
      {state.ready ? (
        <>
          <span>{`The ${name} video for this song is ready.`}</span>
          <Link href={`/member/song/${songId}?assignment=${assignmentId}`} style={{ color: "var(--rw-orange-deep)", fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            Watch it with the song
          </Link>
        </>
      ) : (
        <span>{`The ${name} video for this song is coming soon.`}</span>
      )}
    </p>
  );
}
