"use client";

import CrudManager from "@/components/admin/CrudManager";

export default function AdminOnStage() {
  return (
    <CrudManager
      title="On Stage"
      apiPath="onstage"
      listKey="onstage"
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "mediaUrl", label: "Media URL", type: "text" },
        { key: "date", label: "Date", type: "text" },
        { key: "order", label: "Order", type: "number" },
        { key: "published", label: "Published", type: "checkbox" },
      ]}
    />
  );
}
