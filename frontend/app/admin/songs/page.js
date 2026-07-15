"use client";

import CrudManager from "@/components/admin/CrudManager";

export default function AdminSongs() {
  return (
    <CrudManager
      title="Song Library"
      apiPath="songs"
      listKey="songs"
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
  );
}
