"use client";

import { useState } from "react";
import Icon from "@/components/member/Icon";
import { practiceRequest } from "@/lib/practice";

// Star toggle. Flips at once and puts it back if the save fails (offline, say).
export default function FavoriteButton({ songId, title, favorite, onChange, onError, size = 20 }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !favorite;
    onChange(next);
    setBusy(true);
    try {
      await practiceRequest(`/songs/${songId}/favorite`, { method: "PUT", body: JSON.stringify({ favorite: next }) });
    } catch (err) {
      onChange(!next);
      onError?.(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorite}
      aria-label={`Favourite ${title}`}
      title={favorite ? "Remove from favourites" : "Add to favourites"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        minWidth: 44,
        minHeight: 44,
        border: 0,
        background: "transparent",
        padding: 0,
        lineHeight: 1,
        fontSize: size,
        cursor: busy ? "default" : "pointer",
        color: favorite ? "var(--rw-orange-deep)" : "var(--rw-meta)",
      }}
    >
      <Icon name={favorite ? "star" : "star-outline"} size={size} />
    </button>
  );
}
