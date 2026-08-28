"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { PageHero } from "@/components/ui";

const GENERIC_LEVELS = [
  { n: 1, name: "Sing-a-long" },
  { n: 2, name: "Chords" },
  { n: 3, name: "Scales & fills" },
  { n: 4, name: "Melody" },
  { n: 5, name: "Improv" },
];

export default function SongLibrary() {
  const [songs, setSongs] = useState(undefined);
  const [query, setQuery] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState(null);
  const [levelFilter, setLevelFilter] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/songs`)
      .then((res) => res.json())
      .then((data) => setSongs(data.songs || []))
      .catch(() => setSongs([]));
  }, []);

  const instruments = useMemo(() => [...new Set((songs || []).map((s) => s.instrument).filter(Boolean))], [songs]);
  const levels = useMemo(() => [...new Set((songs || []).map((s) => s.level).filter(Boolean))], [songs]);

  const filtered = (songs || []).filter((s) => {
    if (instrumentFilter && s.instrument !== instrumentFilter) return false;
    if (levelFilter && s.level !== levelFilter) return false;
    if (query && !`${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const openSong = songs?.find((s) => s.id === openId);

  return (
    <div>
      <PageHero title={<>Song Library</>} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "36px 24px 100px" }}>
        {songs === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}

        {openSong ? (
          <div>
            <button
              onClick={() => setOpenId(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "var(--rw-teal)", background: "none", border: "none", cursor: "pointer", marginBottom: 20, padding: 0 }}
            >
              &larr; All songs
            </button>
            <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "28px 30px", borderBottom: "1px solid #f0e7dc" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ fontWeight: 700, fontSize: "clamp(26px,3.2vw,38px)", margin: "0 0 4px", color: "var(--rw-ink)", letterSpacing: "-0.015em" }}>
                      {openSong.title}
                    </h2>
                    <div style={{ fontSize: 16, color: "#7a6d78" }}>{openSong.artist}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {openSong.level && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0e6b78", background: "rgba(14,138,151,0.12)", padding: "6px 12px", borderRadius: 7 }}>
                        {openSong.level}
                      </span>
                    )}
                    {openSong.instrument && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0e6b78", background: "rgba(14,138,151,0.12)", padding: "6px 12px", borderRadius: 7 }}>
                        {openSong.instrument}
                      </span>
                    )}
                  </div>
                </div>
                {openSong.notes && <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.65, color: "var(--rw-body-cool)" }}>{openSong.notes}</p>}
              </div>
              <div style={{ padding: "24px 30px" }}>
                <h3 style={{ fontWeight: 600, fontSize: 19, margin: "0 0 14px", color: "var(--rw-ink)" }}>How you&apos;ll learn it &mdash; five levels</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                  {GENERIC_LEVELS.map((lv) => (
                    <div key={lv.n} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "var(--rw-cream)", borderRadius: 10 }}>
                      <div
                        style={{
                          flexShrink: 0,
                          width: 32,
                          height: 32,
                          borderRadius: 9,
                          background: "linear-gradient(135deg,var(--rw-teal),var(--rw-ink))",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 15,
                        }}
                      >
                        {lv.n}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--rw-ink)" }}>{lv.name}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href="/signup" style={{ padding: "13px 28px", borderRadius: 8, background: "var(--rw-orange)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                    Join the member area &rarr;
                  </Link>
                  <Link href="/program/curriculum" style={{ fontSize: 14, fontWeight: 700, color: "var(--rw-teal)", textDecoration: "none" }}>
                    See the full curriculum
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by song or artist…"
              aria-label="Search songs"
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--rw-line)", fontSize: 15.5, fontFamily: "inherit", background: "#fff", color: "var(--rw-ink)", marginBottom: 16 }}
            />

            {instruments.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a3927f", width: 90 }}>Instrument</span>
                {instruments.map((inst) => (
                  <button key={inst} onClick={() => setInstrumentFilter(instrumentFilter === inst ? null : inst)} style={chipStyle(instrumentFilter === inst)}>
                    {inst}
                  </button>
                ))}
              </div>
            )}
            {levels.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a3927f", width: 90 }}>Level</span>
                {levels.map((lv) => (
                  <button key={lv} onClick={() => setLevelFilter(levelFilter === lv ? null : lv)} style={chipStyle(levelFilter === lv)}>
                    {lv}
                  </button>
                ))}
              </div>
            )}

            {songs && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "44px 20px", background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, fontSize: 15, color: "#7a6d78" }}>
                No songs match those filters yet.
              </div>
            )}

            <div style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-border)", borderRadius: 14, overflow: "hidden" }}>
              {filtered.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="dash-song"
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid #f0e6d8", cursor: "pointer" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 17, color: "var(--rw-ink)" }}>{s.title}</div>
                    <div style={{ fontSize: 13.5, color: "#8a7d86" }}>
                      {s.artist} {s.instrument ? `· ${s.instrument}` : ""}
                    </div>
                  </div>
                  {s.level && (
                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#0e6b78" }}>{s.level}</span>
                  )}
                  <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: "var(--rw-orange)" }}>View &rarr;</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: active ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
    background: active ? "var(--rw-orange-tint)" : "#fff",
    fontWeight: 700,
    fontSize: 12.5,
    color: "var(--rw-ink)",
    cursor: "pointer",
  };
}
