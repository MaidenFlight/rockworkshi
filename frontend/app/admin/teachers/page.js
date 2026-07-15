"use client";

import CrudManager from "@/components/admin/CrudManager";

export default function AdminTeachers() {
  return (
    <CrudManager
      title="Teachers"
      apiPath="teachers"
      listKey="teachers"
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "bio", label: "Bio", type: "textarea" },
        { key: "instruments", label: "Instruments", type: "text" },
        { key: "photoUrl", label: "Photo URL", type: "text" },
        { key: "order", label: "Order", type: "number" },
        { key: "published", label: "Published", type: "checkbox" },
      ]}
    />
  );
}
