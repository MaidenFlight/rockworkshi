"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { usePageParam } from "@/lib/paging";
import Icon from "@/components/member/Icon";
import { useAuth } from "@/contexts/AuthContext";
import ContinueCard from "@/components/member/library/ContinueCard";
import FavoriteButton from "@/components/member/library/FavoriteButton";
import {
  EMPTY_FILTERS,
  NetworkError,
  STEM_FILTERS,
  filterSongs,
  formatWhen,
  levelsIn,
  practiceRequest,
  readLibraryCache,
  writeLibraryCache,
} from "@/lib/practice";

const PAGE_SIZE = 20;
const songTitle = { fontFamily: "var(--rw-font-display)", fontWeight: 800, fontSize: "var(--rw-text-2xl)", lineHeight: 1.05, textTransform: "uppercase", color: "var(--rw-ink)", textDecoration: "none" };

export default function PracticeLibraryPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={null}>
      <PracticeLibrary />
    </Suspense>
  );
}

function PracticeLibrary() {
  const { user } = useAuth();
  const [requestedPage, setPage] = usePageParam();
  const [data, setData] = useState(null); // { songs, continue, savedAt? }
  const [state, setState] = useState("loading"); // loading | ready | offline | error
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [notice, setNotice] = useState("");

  function load() {
    return practiceRequest("/library")
      .then((fresh) => {
        setData(fresh);
        setState("ready");
        writeLibraryCache(user.id, fresh);
      })
      .catch((err) => {
        // Fall back to the last copy this browser saw, if there is one.
        setData((current) => current ?? readLibraryCache(user.id));
        setState(err instanceof NetworkError ? "offline" : "error");
        setError(err.message);
      })
      .finally(() => setRetrying(false));
  }

  function retry() {
    setRetrying(true);
    load();
  }

  useEffect(() => {
    if (user?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const songs = useMemo(() => data?.songs ?? [], [data]);
  const levels = useMemo(() => levelsIn(songs), [songs]);
  const shown = useMemo(() => filterSongs(songs, filters), [songs, filters]);
  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // Search and filters work on the whole library in the browser, and it's kept for offline
  // use, so only the drawing is paged. The page shrinks with the list, e.g. after unstarring.
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function setFavorite(id, favorite) {
    setData((d) => ({ ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, favorite } : s)) }));
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href="/member" style={{ fontSize: 13.5, color: "var(--rw-meta)", textDecoration: "none" }}>
        <Icon name="arrow-left" size={14} /> Dashboard
      </Link>
      <h1 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 30, color: "var(--rw-ink)", margin: "10px 0 4px" }}>Practice library</h1>
      <p style={{ color: "var(--rw-body)", margin: "0 0 24px" }}>
        Your favourites, notes and where you left off, on the website and the app.
      </p>

      {state === "offline" && (
        <Banner tone="warn" onRetry={retry} retrying={retrying}>
          {data
            ? `You're offline. Showing your library as it was${data.savedAt ? ` ${formatWhen(data.savedAt)}` : ""}; favourites can't change until you're back.`
            : "You're offline, and this browser has no saved copy of your library yet."}
        </Banner>
      )}
      {state === "error" && (
        <Banner tone="error" onRetry={retry} retrying={retrying}>
          Your library couldn&apos;t be loaded: {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="warn" onDismiss={() => setNotice("")}>
          {notice}
        </Banner>
      )}

      {state === "loading" && !data ? (
        <div aria-busy="true" aria-label="Loading your library" style={{ display: "grid", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 76, borderRadius: "var(--rw-radius-md)", background: "var(--rw-surface)", border: "1px solid var(--rw-border)" }} />
          ))}
        </div>
      ) : data ? (
        <>
          {data.continue && (
            <div style={{ marginBottom: 24 }}>
              <ContinueCard item={data.continue} />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search by song or artist"
              aria-label="Search songs by title or artist"
              style={{ ...control, flex: "1 1 240px" }}
            />
            <select value={filters.level} onChange={(e) => set({ level: e.target.value })} aria-label="Difficulty" style={control}>
              <option value="">All difficulties</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select value={filters.stems} onChange={(e) => set({ stems: e.target.value })} aria-label="Stems" style={control}>
              {STEM_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id === "any" ? "Any stems" : f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => set({ favorites: !filters.favorites })}
              aria-pressed={filters.favorites}
              style={{
                ...control,
                cursor: "pointer",
                fontWeight: 700,
                border: `1px solid ${filters.favorites ? "var(--rw-orange)" : "var(--rw-line)"}`,
                background: filters.favorites ? "var(--rw-orange-tint)" : "#fff",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="star" size={14} />
                Favourites
              </span>
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span role="status" style={{ fontSize: 13, color: "var(--rw-meta)" }}>
              {shown.length} {shown.length === 1 ? "song" : "songs"}
            </span>
            {filtering && (
              <button type="button" onClick={clearFilters} style={linkButton}>
                Clear filters
              </button>
            )}
          </div>

          {songs.length === 0 ? (
            <Empty>There are no songs in the library yet.</Empty>
          ) : shown.length === 0 ? (
            <Empty>
              {filters.favorites && songs.every((s) => !s.favorite)
                ? "You haven't starred any songs yet. Tap the star on a song to keep it here."
                : "No songs match."}{" "}
              <button type="button" onClick={clearFilters} style={linkButton}>
                Clear filters
              </button>
            </Empty>
          ) : (
            <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {visible.map((song) => (
                <li key={song.id} style={songRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {song.hasTracks ? (
                      <Link href={`/member/song/${song.id}`} style={songTitle}>
                        {song.title}
                      </Link>
                    ) : (
                      <span style={{ ...songTitle, color: "var(--rw-meta)" }}>{song.title}</span>
                    )}
                    <div style={{ fontSize: 13.5, color: "var(--rw-meta)" }}>{song.artist || "Unknown artist"}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {song.locked && song.hasTracks && <Tag tone="lock">Unlocks with your term</Tag>}
                      {song.level && <Tag>{song.level}</Tag>}
                      {song.hasTracks ? <Tag tone="teal">Play-along · {song.parts.join(", ")}</Tag> : <Tag tone="lock">Coming soon</Tag>}
                      {song.hasNotes && <Tag>Notes</Tag>}
                      {song.lastOpenedAt && <Tag>Opened {formatWhen(song.lastOpenedAt)}</Tag>}
                    </div>
                  </div>
                  {song.hasTracks && (
                    <FavoriteButton
                      songId={song.id}
                      title={song.title}
                      favorite={song.favorite}
                      onChange={(fav) => setFavorite(song.id, fav)}
                      onError={(err) =>
                        setNotice(
                          err instanceof NetworkError
                            ? "You're offline, so that favourite wasn't saved."
                            : `That favourite wasn't saved: ${err.message}`
                        )
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              pagination={{ page, pageSize: PAGE_SIZE, total: shown.length, totalPages }}
              onChange={setPage}
              label="Song pages"
            />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function Banner({ tone, children, onRetry, retrying, onDismiss }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
        padding: "12px 14px",
        marginBottom: 16,
        borderRadius: "var(--rw-radius-md)",
        fontSize: 14,
        background: tone === "error" ? "var(--rw-orange-tint)" : "var(--rw-sand)",
        border: "1px solid var(--rw-border)",
        color: "var(--rw-ink)",
      }}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} style={smallButton}>
          {retrying ? "Trying…" : "Retry"}
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} style={smallButton}>
          OK
        </button>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <p style={{ padding: "28px 16px", textAlign: "center", color: "var(--rw-meta)", border: "1px dashed var(--rw-border)", borderRadius: "var(--rw-radius-md)" }}>
      {children}
    </p>
  );
}

function Tag({ children, tone }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 8px",
        background: tone === "teal" ? "var(--rw-sand)" : tone === "lock" ? "var(--rw-orange-tint)" : "var(--rw-cream)",
        color: tone === "teal" ? "var(--rw-teal)" : tone === "lock" ? "var(--rw-orange-deep)" : "var(--rw-body)",
      }}
    >
      {children}
    </span>
  );
}

const control = {
  padding: "9px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  color: "var(--rw-ink)",
};
const songRow = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "14px 16px",
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
};
const smallButton = {
  padding: "6px 12px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};
const linkButton = {
  border: 0,
  background: "transparent",
  padding: 0,
  color: "var(--rw-orange-deep)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
