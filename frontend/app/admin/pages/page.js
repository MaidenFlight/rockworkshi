"use client";

import CrudManager from "@/components/admin/CrudManager";
import { API_URL } from "@/lib/api";

export default function AdminPages() {
  return (
    <CrudManager
      title="Pages"
      apiPath="pages"
      listKey="pages"
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "slug", label: "Slug", type: "text" },
        { key: "nav", label: "Nav section", type: "text" },
        { key: "status", label: "Status (Draft / Published)", type: "text", default: "Draft" },
        { key: "body", label: "Body", type: "textarea" },
      ]}
      renderExtra={(item, reload) => (
        <button
          onClick={async () => {
            await fetch(`${API_URL}/admin/pages/${item.id}/publish`, { method: "PATCH", credentials: "include" });
            reload();
          }}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d8cab8", background: "#fff", fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: "#0a2338" }}
        >
          {item.status === "Published" ? "Unpublish" : "Publish"}
        </button>
      )}
    />
  );
}
