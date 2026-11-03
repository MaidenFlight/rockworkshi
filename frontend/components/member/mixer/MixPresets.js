"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { hint, smallBtn } from "./styles";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Named mixes saved to the student's account for this song, so they follow them to the phone.
export default function MixPresets({ songId, getSettings, onApply }) {
  const [presets, setPresets] = useState([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    request(`/songs/${songId}/mix-presets`)
      .then((data) => setPresets(data.presets))
      .catch(() => setPresets([]));
  }, [songId]);

  async function save(e) {
    e.preventDefault();
    try {
      const { preset } = await request(`/songs/${songId}/mix-presets`, {
        method: "PUT",
        body: JSON.stringify({ name, settings: getSettings() }),
      });
      setPresets((list) => [...list.filter((p) => p.id !== preset.id), preset].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(preset.id);
      setName("");
      setMessage(`Saved “${preset.name}”.`);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function remove() {
    const preset = presets.find((p) => p.id === selected);
    if (!preset) return;
    try {
      await request(`/songs/${songId}/mix-presets/${preset.id}`, { method: "DELETE" });
      setPresets((list) => list.filter((p) => p.id !== preset.id));
      setSelected("");
      setMessage(`Deleted “${preset.name}”.`);
    } catch (err) {
      setMessage(err.message);
    }
  }

  function apply(id) {
    setSelected(id);
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    onApply(preset.settings);
    setMessage(`Using “${preset.name}”.`);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="mix-preset" style={{ fontSize: 13, fontWeight: 700, color: "var(--rw-ink)" }}>
          My mixes
        </label>
        <select
          id="mix-preset"
          value={selected}
          onChange={(e) => apply(e.target.value)}
          style={{ flex: "1 1 160px", padding: "6px 8px", borderRadius: "var(--rw-radius-sm)", border: "1px solid var(--rw-line)", fontSize: 13 }}
        >
          <option value="">{presets.length ? "Choose a saved mix…" : "No saved mixes yet"}</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={remove} disabled={!selected} style={smallBtn}>
          Delete
        </button>
      </div>
      <form onSubmit={save} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Name this mix, e.g. Drums up"
          aria-label="Name for this mix"
          style={{ flex: "1 1 160px", padding: "6px 10px", borderRadius: "var(--rw-radius-sm)", border: "1px solid var(--rw-line)", fontSize: 13 }}
        />
        <button type="submit" disabled={!name.trim()} style={smallBtn}>
          Save mix
        </button>
      </form>
      {message && (
        <p style={hint} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
