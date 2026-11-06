"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import Icon from "../Icon";

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
  const [message, setMessage] = useState(null); // { text, ok }

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
      setMessage({ text: `Saved “${preset.name}”.`, ok: true, at: Date.now() });
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    }
  }

  async function remove() {
    const preset = presets.find((p) => p.id === selected);
    if (!preset) return;
    try {
      await request(`/songs/${songId}/mix-presets/${preset.id}`, { method: "DELETE" });
      setPresets((list) => list.filter((p) => p.id !== preset.id));
      setSelected("");
      setMessage({ text: `Deleted “${preset.name}”.`, ok: true, at: Date.now() });
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    }
  }

  function apply(id) {
    setSelected(id);
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    onApply(preset.settings);
    setMessage({ text: `Using “${preset.name}”.`, ok: true, at: Date.now() });
  }

  return (
    <div className="rw-presets">
      <div className="rw-presets-row">
        <label htmlFor="mix-preset" className="rw-studio-label">
          Saved mixes
        </label>
        <select id="mix-preset" value={selected} onChange={(e) => apply(e.target.value)} className="rw-field">
          <option value="">{presets.length ? "Choose a saved mix…" : "No saved mixes yet"}</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={remove} disabled={!selected} className="rw-btn rw-btn-small">
          Delete
        </button>
      </div>
      <form onSubmit={save} className="rw-presets-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Name this mix, e.g. Drums up"
          aria-label="Name for this mix"
          className="rw-field"
        />
        <button type="submit" disabled={!name.trim()} className="rw-btn rw-btn-small">
          Save mix
        </button>
      </form>
      {message && (
        // Keyed by time so the confirmation plays again for every save.
        <p key={message.at} className={message.ok ? "rw-confirm" : "rw-studio-error"} role="status">
          {message.ok && <Icon name="check" size={14} />}
          {message.text}
        </p>
      )}
    </div>
  );
}
