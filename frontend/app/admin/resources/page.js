"use client";

import CrudManager from "@/components/admin/CrudManager";

export default function AdminResources() {
  return (
    <CrudManager
      title="Resources"
      apiPath="resources"
      listKey="resources"
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "type", label: "Type (e.g. PDF)", type: "text" },
        { key: "url", label: "URL", type: "text" },
      ]}
    />
  );
}
