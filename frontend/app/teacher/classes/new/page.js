"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ClassForm, { saveClass } from "@/components/studio/ClassForm";

export default function NewClassPage() {
  const router = useRouter();
  return (
    <div className="rw-st" style={{ maxWidth: 820 }}>
      <div>
        <Link href="/teacher/classes" className="rw-st-muted">
          ← Classes
        </Link>
        <h1 className="rw-st-title" style={{ marginTop: 6 }}>
          New class
        </h1>
        <p className="rw-st-lead">Times are in the time zone you choose, so a weekly 4pm class stays at 4pm when the clocks change.</p>
      </div>
      <div className="rw-st-card">
        <ClassForm
          saveLabel="Create class"
          onSave={async (body) => {
            const { class: created } = await saveClass("/teacher/classes", "POST", body);
            router.push(`/teacher/classes/${created.id}`);
          }}
        />
      </div>
    </div>
  );
}
