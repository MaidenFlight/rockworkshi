"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

function blankFrom(fields) {
  const b = {};
  for (const f of fields) {
    if (f.type === "checkbox") b[f.key] = f.default ?? true;
    else if (f.type === "number") b[f.key] = f.default ?? 0;
    else if (f.type === "json") b[f.key] = f.default ?? "[]";
    else b[f.key] = f.default ?? "";
  }
  return b;
}

export default function CrudManager({ title, apiPath, listKey, fields, renderExtra }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/${apiPath}`, { credentials: "include" });
      const data = await res.json();
      setItems(data[listKey] || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  function openNew() {
    setDraft(blankFrom(fields));
    setError("");
  }

  function openEdit(item) {
    const d = { id: item.id };
    for (const f of fields) {
      d[f.key] = f.type === "json" ? JSON.stringify(item[f.key] ?? [], null, 2) : item[f.key];
    }
    setDraft(d);
    setError("");
  }

  async function save() {
    setError("");
    const body = {};
    for (const f of fields) {
      if (f.type === "json") {
        try {
          body[f.key] = JSON.parse(draft[f.key] || "[]");
        } catch {
          setError(`"${f.label}" must be valid JSON.`);
          return;
        }
      } else {
        body[f.key] = draft[f.key];
      }
    }
    const isNew = !draft.id;
    const url = isNew ? `${API_URL}/admin/${apiPath}` : `${API_URL}/admin/${apiPath}/${draft.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError("Save failed.");
      return;
    }
    setDraft(null);
    load();
  }

  async function remove(id) {
    await fetch(`${API_URL}/admin/${apiPath}/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontWeight: 600, fontSize: 24, color: "#0a2338", margin: 0 }}>{title}</h1>
        <button onClick={openNew} style={ctaBtn}>
          + New
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#8a7d6a" }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 && <p style={{ color: "#8a7d6a" }}>Nothing here yet.</p>}
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                border: "1px solid #ece0d5",
                borderRadius: 10,
                background: "#fffdf9",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#0a2338" }}>
                  {item[fields[0].key]}
                  {"published" in item && (
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: item.published ? "#e3f3ea" : "#f3e6da",
                        color: item.published ? "#1f7a4d" : "#a06a2a",
                      }}
                    >
                      {item.published ? "Published" : "Hidden"}
                    </span>
                  )}
                </div>
                {fields[1] && (
                  <div style={{ fontSize: 13, color: "#8a7d6a" }}>
                    {String(item[fields[1].key] ?? "").slice(0, 90)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {renderExtra && renderExtra(item, load)}
                <button onClick={() => openEdit(item)} style={smallBtn}>
                  Edit
                </button>
                <button onClick={() => remove(item.id)} style={{ ...smallBtn, color: "#cf3f20" }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,35,56,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 26, maxWidth: 520, width: "100%", maxHeight: "84vh", overflowY: "auto" }}>
            <h3 style={{ marginTop: 0, color: "#0a2338" }}>{draft.id ? "Edit" : "New"} {title.replace(/s$/, "")}</h3>
            {fields.map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#33454f", marginBottom: 4 }}>
                  {f.label}
                </label>
                {f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={!!draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })}
                  />
                ) : f.type === "textarea" || f.type === "json" ? (
                  <textarea
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    rows={f.type === "json" ? 8 : 4}
                    style={{ ...inputStyle, fontFamily: f.type === "json" ? "monospace" : "inherit", width: "100%" }}
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                )}
              </div>
            ))}
            {error && <p style={{ color: "#cf3f20", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={save} style={ctaBtn}>
                Save
              </button>
              <button onClick={() => setDraft(null)} style={smallBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
