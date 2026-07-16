"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

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
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg,#06192d 0%,#0b2f43 52%,#0b5563 100%)" }}>
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
          <h1 style={{ fontWeight: 500, fontSize: "clamp(38px,5vw,58px)", margin: 0, color: "#fff", letterSpacing: "-0.015em" }}>
            Song Library
          </h1>
        </div>
        <div style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="#fbf5ec" />
          </svg>
        </div>
      </section>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "36px 24px 100px" }}>
        {songs === undefined && <p style={{ color: "#8a7d6a" }}>Loading…</p>}

        {openSong ? (
          <div>
            <button
              onClick={() => setOpenId(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "#0e8a97", background: "none", border: "none", cursor: "pointer", marginBottom: 20, padding: 0 }}
            >
              &larr; All songs
            </button>
            <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "28px 30px", borderBottom: "1px solid #f0e7dc" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ fontWeight: 700, fontSize: "clamp(26px,3.2vw,38px)", margin: "0 0 4px", color: "#0a2338", letterSpacing: "-0.015em" }}>
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
                {openSong.notes && <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.65, color: "#5f6f79" }}>{openSong.notes}</p>}
              </div>
              <div style={{ padding: "24px 30px" }}>
                <h3 style={{ fontWeight: 600, fontSize: 19, margin: "0 0 14px", color: "#0a2338" }}>How you&apos;ll learn it &mdash; five levels</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                  {GENERIC_LEVELS.map((lv) => (
                    <div key={lv.n} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#fbf5ec", borderRadius: 10 }}>
                      <div
                        style={{
                          flexShrink: 0,
                          width: 32,
                          height: 32,
                          borderRadius: 9,
                          background: "linear-gradient(135deg,#0e8a97,#0a2338)",
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
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#0a2338" }}>{lv.name}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href="/signup" style={{ padding: "13px 28px", borderRadius: 8, background: "#ef5130", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                    Start Lessons &rarr;
                  </Link>
                  <Link href="/program/curriculum" style={{ fontSize: 14, fontWeight: 700, color: "#0e8a97", textDecoration: "none" }}>
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
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 18px", borderRadius: 10, border: "1px solid #d8cab8", fontSize: 15.5, fontFamily: "inherit", background: "#fff", color: "#0a2338", marginBottom: 16 }}
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
              <div style={{ textAlign: "center", padding: "44px 20px", background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, fontSize: 15, color: "#7a6d78" }}>
                No songs match those filters yet.
              </div>
            )}

            <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, overflow: "hidden" }}>
              {filtered.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="dash-song"
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid #f0e6d8", cursor: "pointer" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 17, color: "#0a2338" }}>{s.title}</div>
                    <div style={{ fontSize: 13.5, color: "#8a7d86" }}>
                      {s.artist} {s.instrument ? `· ${s.instrument}` : ""}
                    </div>
                  </div>
                  {s.level && (
                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#0e6b78" }}>{s.level}</span>
                  )}
                  <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: "#ef5130" }}>View &rarr;</span>
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
    border: active ? "1px solid #ef5130" : "1px solid #d8cab8",
    background: active ? "#fdece6" : "#fff",
    fontWeight: 700,
    fontSize: 12.5,
    color: "#0a2338",
    cursor: "pointer",
  };
}
