"use client";

import { useState } from "react";
import CrudManager from "@/components/admin/CrudManager";
import LessonVideoEditor from "@/components/admin/LessonVideoEditor";

const DEFAULT_LEVELS = JSON.stringify(
  [
    { n: 1, name: "Sing-a-long", blurb: "" },
    { n: 2, name: "Chords", blurb: "" },
    { n: 3, name: "Scales & fills", blurb: "" },
    { n: 4, name: "Melody", blurb: "" },
    { n: 5, name: "Improv", blurb: "" },
  ],
  null,
  2
);

export default function AdminLessons() {
  // Videos live in their own grid rather than as fields on the lesson form:
  // there are twelve of them per lesson (six instruments, two kinds) before
  // levels 2-5 exist at all, which is a table, not a row of text boxes.
  const [videosFor, setVideosFor] = useState(null);

  return (
    <>
    <CrudManager
      title="Lessons"
      apiPath="lessons"
      listKey="lessons"
      renderExtra={(item) => (
        <button onClick={() => setVideosFor(item)} style={videosBtn}>
          Videos
        </button>
      )}
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "artist", label: "Artist", type: "text" },
        { key: "key", label: "Key", type: "text" },
        { key: "difficulty", label: "Difficulty", type: "text" },
        { key: "estTime", label: "Est. time", type: "text" },
        { key: "levels", label: "Levels (JSON)", type: "json", default: DEFAULT_LEVELS },
        { key: "order", label: "Order", type: "number" },
        { key: "published", label: "Published", type: "checkbox" },
      ]}
    />
    {videosFor && <LessonVideoEditor lesson={videosFor} onClose={() => setVideosFor(null)} />}
    </>
  );
}

const videosBtn = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #d8cab8",
  background: "#fff",
  color: "#0a2338",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
