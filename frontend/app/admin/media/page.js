"use client";

import CrudManager from "@/components/admin/CrudManager";

export default function AdminMedia() {
  return (
    <CrudManager
      title="Media"
      apiPath="media"
      listKey="media"
      fields={[
        { key: "label", label: "Label", type: "text" },
        { key: "kind", label: "Kind (Video / Image)", type: "text" },
        { key: "url", label: "URL", type: "text" },
      ]}
    />
  );
}
