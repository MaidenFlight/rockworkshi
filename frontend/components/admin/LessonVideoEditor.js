"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { instruments } from "@/lib/content";
import InstrumentIcon from "@/components/InstrumentIcon";

const KINDS = [
  { key: "lesson", label: "Lesson" },
  { key: "playthrough", label: "Playthrough" },
];

const LEVELS = [1, 2, 3, 4, 5];

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

  const pending = changed.length;

  function goToLevel(n) {
    setDraft({});
    setLevel(n);
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <h3 style={{ marginTop: 0, color: "var(--rw-ink)" }}>
          Videos — {lesson.title}
          {lesson.artist ? <span style={{ color: "var(--rw-meta)", fontWeight: 400 }}> · {lesson.artist}</span> : null}
        </h3>

        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {LEVELS.map((n) => (
            <button
              key={n}
              onClick={() => goToLevel(n)}
              disabled={pending > 0 && n !== level}
              style={{
                ...smallBtn,
                background: n === level ? "var(--rw-ink)" : "#fff",
                color: n === level ? "#fff" : "var(--rw-ink)",
                opacity: pending > 0 && n !== level ? 0.4 : 1,
                cursor: pending > 0 && n !== level ? "not-allowed" : "pointer",
              }}
            >
              Level {n}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--rw-meta)", marginTop: 0, marginBottom: 16 }}>
          Paste the Bunny video id, or a full https:// URL to play a file directly. Clear a
          box to remove that video. {pending > 0 && <strong>Save before changing level.</strong>}
        </p>

        {loading ? (
          <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
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
                  <td style={{ ...td, fontWeight: 700, color: "var(--rw-ink)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <InstrumentIcon name={inst.name} size={22} />
                      {inst.name}
                    </span>
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
                          <div style={{ fontSize: 11, color: "var(--rw-meta)", marginTop: 3 }}>
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

        {error && <p style={{ color: "var(--rw-orange-deep)", fontSize: 13 }}>{error}</p>}

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
  color: "var(--rw-prose)",
  padding: "6px 8px 8px 0",
  borderBottom: "1px solid var(--rw-border)",
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
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};

const smallBtn = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};

const inputStyle = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  fontSize: 13.5,
};
