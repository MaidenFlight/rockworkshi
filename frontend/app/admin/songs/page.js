"use client";

import { useState } from "react";
import CrudManager from "@/components/admin/CrudManager";
import LessonVideoEditor from "@/components/admin/LessonVideoEditor";

export default function AdminSongs() {
  // The song's video tutorials, shown to each student above the practice player.
  const [videosFor, setVideosFor] = useState(null);

  return (
    <>
    <CrudManager
      title="Song Library"
      apiPath="songs"
      listKey="songs"
      renderExtra={(item) => (
        <button onClick={() => setVideosFor(item)} style={videosBtn}>
          Videos
        </button>
      )}
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "artist", label: "Artist", type: "text" },
        { key: "level", label: "Level", type: "text" },
        { key: "instrument", label: "Instrument", type: "text" },
        { key: "notes", label: "Notes", type: "textarea" },
        { key: "order", label: "Order", type: "number" },
        { key: "published", label: "Published", type: "checkbox" },
      ]}
    />
    {videosFor && (
      <LessonVideoEditor lesson={videosFor} path={`/admin/songs/${videosFor.id}/videos`} onClose={() => setVideosFor(null)} />
    )}
    </>
  );
}

const videosBtn = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
