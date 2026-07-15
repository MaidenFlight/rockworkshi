"use client";

import CrudManager from "@/components/admin/CrudManager";

export default function AdminFaqs() {
  return (
    <CrudManager
      title="FAQs"
      apiPath="faqs"
      listKey="faqs"
      fields={[
        { key: "question", label: "Question", type: "text" },
        { key: "answer", label: "Answer", type: "textarea" },
        { key: "order", label: "Order", type: "number" },
        { key: "published", label: "Published", type: "checkbox" },
      ]}
    />
  );
}
