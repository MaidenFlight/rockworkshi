"use client";

// Filling the video library is the bulk of the work ahead: twelve songs times
// six instruments times two kinds, and eventually five levels. So this is a
// grid of slots rather than a list of records — the useful question is "which
// squares are still empty for this song", which a list of the rows that happen
// to exist cannot answer.
//
// There is no upload control yet. Videos are uploaded to Bunny by hand and the
// id pasted in here; when an upload button arrives it drops into the same cell
// and writes to the same endpoint.

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { instruments } from "@/lib/content";

const KINDS = [
  { key: "lesson", label: "Lesson" },
  { key: "playthrough", label: "Playthrough" },
];

const LEVELS = [1, 2, 3, 4, 5];

// A pasted http(s) address is a plain URL and nothing can sign it; anything
// else is taken to be a Bunny guid. Inferring beats asking, because the two
// cases look nothing alike and a wrong provider fails quietly — "direct" on a
// guid yields a broken <video> src, "bunny" on a URL yields no player at all.
function providerFor(videoId) {
  return /^https?:\/\//i.test(videoId.trim()) ? "direct" : "bunny";
}

function slotKey(instrument, kind) {
  return `${instrument}|${kind}`;
}

export default function LessonVideoEditor({ lesson, onClose }) {
  const [videos, setVideos] = useState([]);
  const [level, setLevel] = useState(1);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/lessons/${lesson.id}/videos`, {
        credentials: "include",
      });
      const data = await res.json();
      setVideos(data.videos || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // The saved state for the level on screen, which is also what unsaved edits
  // are compared against so only changed slots get written.
  const saved = {};
  for (const v of videos) {
    if (v.level === level) saved[slotKey(v.instrument, v.kind)] = v;
  }

  function valueOf(instrument, kind) {
    const key = slotKey(instrument, kind);
    if (key in draft) return draft[key];
    return saved[key] ? saved[key].videoId : "";
  }

  function setValue(instrument, kind, value) {
    setDraft({ ...draft, [slotKey(instrument, kind)]: value });
  }

  const changed = Object.entries(draft).filter(([key, value]) => {
    const current = saved[key] ? saved[key].videoId : "";
    return value.trim() !== current;
  });

  async function save() {
    setError("");
    setSaving(true);
    try {
      for (const [key, value] of changed) {
        const [instrument, kind] = key.split("|");
        const videoId = value.trim();
        const res = await fetch(`${API_URL}/admin/lessons/${lesson.id}/videos`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instrument,
            level,
            kind,
            provider: providerFor(videoId),
            videoId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Could not save the ${instrument} ${kind} video.`);
          return;
        }
      }
      setDraft({});
      await load();
    } finally {
      setSaving(false);
    }
  }

  // Switching levels with edits pending would silently write them against the
  // wrong level, so the level buttons are disabled until they are saved.
  const pending = changed.length;

  // Even with nothing pending, draft can still hold keys whose value was typed
  // and then put back — they match saved, so they don't count as changes, but
  // they would shadow the next level's saved id and show an empty box for a
  // video that exists. Dropping the draft on the way out is safe precisely
  // because there is nothing unsaved left in it.
  function goToLevel(n) {
    setDraft({});
    setLevel(n);
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <h3 style={{ marginTop: 0, color: "#0a2338" }}>
          Videos — {lesson.title}
          {lesson.artist ? <span style={{ color: "#8a7d6a", fontWeight: 400 }}> · {lesson.artist}</span> : null}
        </h3>

        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {LEVELS.map((n) => (
            <button
              key={n}
              onClick={() => goToLevel(n)}
              disabled={pending > 0 && n !== level}
              style={{
                ...smallBtn,
                background: n === level ? "#0a2338" : "#fff",
                color: n === level ? "#fff" : "#0a2338",
                opacity: pending > 0 && n !== level ? 0.4 : 1,
                cursor: pending > 0 && n !== level ? "not-allowed" : "pointer",
              }}
            >
              Level {n}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#8a7d6a", marginTop: 0, marginBottom: 16 }}>
          Paste the Bunny video id, or a full https:// URL to play a file directly. Clear a
          box to remove that video. {pending > 0 && <strong>Save before changing level.</strong>}
        </p>

        {loading ? (
          <p style={{ color: "#8a7d6a" }}>Loading…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 110 }}>Instrument</th>
                {KINDS.map((k) => (
                  <th key={k.key} style={th}>
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instruments.map((inst) => (
                <tr key={inst.name}>
                  <td style={{ ...td, fontWeight: 700, color: "#0a2338" }}>
                    <span style={{ marginRight: 6 }}>{inst.emoji}</span>
                    {inst.name}
                  </td>
                  {KINDS.map((k) => {
                    const value = valueOf(inst.name, k.key);
                    return (
                      <td key={k.key} style={td}>
                        <input
                          value={value}
                          onChange={(e) => setValue(inst.name, k.key, e.target.value)}
                          placeholder="—"
                          style={{ ...inputStyle, width: "100%" }}
                        />
                        {value.trim() && (
                          <div style={{ fontSize: 11, color: "#8a7d6a", marginTop: 3 }}>
                            {providerFor(value) === "bunny" ? "Bunny id" : "Direct URL"}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {error && <p style={{ color: "#cf3f20", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center" }}>
          <button onClick={save} disabled={saving || pending === 0} style={{ ...ctaBtn, opacity: saving || pending === 0 ? 0.5 : 1 }}>
            {saving ? "Saving…" : pending > 0 ? `Save ${pending} change${pending === 1 ? "" : "s"}` : "Saved"}
          </button>
          <button onClick={onClose} style={smallBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(10,35,56,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const panel = {
  background: "#fff",
  borderRadius: 14,
  padding: 26,
  maxWidth: 720,
  width: "100%",
  maxHeight: "86vh",
  overflowY: "auto",
};

const th = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#33454f",
  padding: "6px 8px 8px 0",
  borderBottom: "1px solid #ece0d5",
};

const td = {
  padding: "8px 8px 8px 0",
  verticalAlign: "top",
  fontSize: 13.5,
};

const ctaBtn = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#ef5130",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};

const smallBtn = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #d8cab8",
  background: "#fff",
  color: "#0a2338",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};

const inputStyle = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #d8cab8",
  fontSize: 13.5,
};
