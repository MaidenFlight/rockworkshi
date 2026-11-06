"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";
import { usePageParam } from "@/lib/paging";
import Icon from "@/components/member/Icon";
import { useAuth } from "@/contexts/AuthContext";
import { partForInstrument } from "@/lib/teaching";
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
// Why a term song is shut, from the API's lockReason. Only someone in the term is told it will open.
const LOCK_LABELS = {
  locked: "Unlocks later in your term",
  preparing: "Being prepared for your term",
  not_in_term: "Part of a school term",
};
const SORTS = [
  { id: "", label: "Library order" },
  { id: "recent", label: "Recently opened" },
  { id: "az", label: "A to Z" },
  { id: "level", label: "Easiest first" },
];
const LEVEL_ORDER = { Beginner: 0, Intermediate: 1, Advanced: 2, Expert: 3 };

function sortSongs(songs, sort) {
  const list = [...songs];
  if (sort === "recent") list.sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""));
  if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "level") list.sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9));
  return list;
}

// Search, filters and sort live in the URL, so coming back from a song lands on the same view.
function filtersFrom(params) {
  const stems = params.get("stems");
  return {
    query: params.get("q") ?? "",
    level: params.get("level") ?? "",
    stems: STEM_FILTERS.some((f) => f.id === stems) ? stems : "any",
    favorites: params.get("fav") === "1",
  };
}

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
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(null); // { songs, continue, savedAt? }
  const [state, setState] = useState("loading"); // loading | ready | offline | error
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [filters, setFilters] = useState(() => filtersFrom(params));
  const [sort, setSort] = useState(() => (SORTS.some((s) => s.id === params.get("sort")) ? params.get("sort") : ""));
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
  // A student's list names only their own stem (the server sends no others), so the filter does too.
  const student = data?.scope === "instrument";
  const noun = data?.instrument?.toLowerCase() || null;
  const stemFilters = useMemo(() => {
    if (!student) return STEM_FILTERS.map((f) => ({ ...f, label: f.id === "any" ? "Any stems" : f.label }));
    const own = partForInstrument(data.instrument);
    return [
      { id: "any", label: "Any songs" },
      { id: "stems", label: "With a play-along" },
      ...(own ? [{ id: own, label: `With your ${noun} part` }] : []),
    ];
  }, [student, data, noun]);
  const stemsChoice = stemFilters.some((f) => f.id === filters.stems) ? filters.stems : "any";
  const levels = useMemo(() => levelsIn(songs), [songs]);
  const shown = useMemo(() => sortSongs(filterSongs(songs, { ...filters, stems: stemsChoice }), sort), [songs, filters, stemsChoice, sort]);
  // Songs with a play-along make the main list, ones that open now ahead of term songs that
  // don't. Songs still without one are a short list of their own underneath.
  const playable = shown.filter((s) => s.hasTracks && !s.locked);
  const listed = [...playable, ...shown.filter((s) => s.hasTracks && s.locked)];
  const soon = shown.filter((s) => !s.hasTracks);
  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  // One URL write per change, which also drops the page number.
  function writeUrl(f, s) {
    const search = new URLSearchParams();
    if (f.query) search.set("q", f.query);
    if (f.level) search.set("level", f.level);
    if (f.stems !== "any") search.set("stems", f.stems);
    if (f.favorites) search.set("fav", "1");
    if (s) search.set("sort", s);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  const set = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    writeUrl(next, sort);
  };
  const changeSort = (next) => {
    setSort(next);
    writeUrl(filters, next);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    writeUrl(EMPTY_FILTERS, sort);
  };

  // Search and filters work on the whole library in the browser, and it's kept for offline
  // use, so only the drawing is paged. The page shrinks with the list, e.g. after unstarring.
  const totalPages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function setFavorite(id, favorite) {
    setData((d) => ({ ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, favorite } : s)) }));
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href="/member" className="rw-back">
        <Icon name="arrow-left" size={14} /> Practice
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
            <select value={stemsChoice} onChange={(e) => set({ stems: e.target.value })} aria-label="Stems" style={control}>
              {stemFilters.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => changeSort(e.target.value)} aria-label="Sort" style={control}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
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
            <span role="status" style={{ fontSize: "var(--rw-text-sm)", color: "var(--rw-meta)" }}>
              {playable.length} to play
              {listed.length > playable.length ? ` · ${listed.length - playable.length} in a term` : ""}
              {soon.length ? ` · ${soon.length} coming soon` : ""}
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
            {listed.length === 0 && <Empty>None of these songs has a play-along yet.</Empty>}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {visible.map((song) => (
                <li key={song.id} style={songRow} data-locked={song.locked ? "true" : undefined}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {song.locked ? (
                      // The server would refuse it, so there's no link to a page that only says no.
                      <span style={{ ...songTitle, color: "var(--rw-body)" }}>{song.title}</span>
                    ) : (
                      <Link href={`/member/song/${song.id}`} className="rw-lib-title" style={songTitle}>
                        {song.title}
                      </Link>
                    )}
                    <div style={{ fontSize: 13.5, color: "var(--rw-meta)" }}>{song.artist || "Unknown artist"}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {song.locked && <Tag tone="lock">{LOCK_LABELS[song.lockReason] ?? LOCK_LABELS.not_in_term}</Tag>}
                      {song.level && <Tag>{song.level}</Tag>}
                      <Tag tone="teal">
                        Play-along · {student ? (song.parts.length ? `your ${noun}` : "whole song") : song.parts.join(", ")}
                      </Tag>
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
              pagination={{ page, pageSize: PAGE_SIZE, total: listed.length, totalPages }}
              onChange={setPage}
              label="Song pages"
            />
            {soon.length > 0 && (
              <section aria-labelledby="coming-soon" style={{ marginTop: 32 }}>
                <h2 id="coming-soon" style={{ margin: "0 0 4px", fontFamily: "var(--rw-font-display)", fontWeight: 800, fontSize: "var(--rw-text-xl)", textTransform: "uppercase", color: "var(--rw-ink)" }}>
                  Coming soon
                </h2>
                <p style={{ margin: "0 0 10px", fontSize: "var(--rw-text-sm)", color: "var(--rw-meta)" }}>
                  These songs don&apos;t have a play-along yet.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--rw-border)" }}>
                  {soon.map((song) => (
                    <li key={song.id} style={soonRow}>
                      <span style={{ fontWeight: 700, color: "var(--rw-ink)" }}>{song.title}</span>
                      <span style={{ color: "var(--rw-meta)" }}>{[song.artist, song.level].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
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
  minHeight: 44,
  padding: "0 12px",
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
  minHeight: 44,
  padding: "0 14px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};
const linkButton = {
  minHeight: 44,
  border: 0,
  background: "transparent",
  padding: "0 4px",
  color: "var(--rw-orange-deep)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const soonRow = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "2px 12px",
  padding: "10px 4px",
  borderBottom: "1px solid var(--rw-border)",
  fontSize: "var(--rw-text-base)",
};
