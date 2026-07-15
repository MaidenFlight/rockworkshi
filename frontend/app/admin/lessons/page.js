"use client";

import CrudManager from "@/components/admin/CrudManager";

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
  return (
    <CrudManager
      title="Lessons"
      apiPath="lessons"
      listKey="lessons"
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "artist", label: "Artist", type: "text" },
        { key: "key", label: "Key", type: "text" },
        { key: "difficulty", label: "Difficulty", type: "text" },
        { key: "estTime", label: "Est. time", type: "text" },
        { key: "videoUrl", label: "Lesson video URL", type: "text" },
        { key: "playthroughVideoUrl", label: "Playthrough video URL", type: "text" },
        { key: "levels", label: "Levels (JSON)", type: "json", default: DEFAULT_LEVELS },
        { key: "order", label: "Order", type: "number" },
        { key: "published", label: "Published", type: "checkbox" },
      ]}
    />
  );
}
