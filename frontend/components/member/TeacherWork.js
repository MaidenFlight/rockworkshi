"use client";

import Link from "next/link";
import Pagination from "@/components/Pagination";
import { usePagedList, usePageParam } from "@/lib/paging";
import { assignmentTitle, studentStatus } from "@/lib/teaching";
import { pill } from "@/lib/terms";

// Practice work set by the student's teacher. Draws nothing until there is some,
// since most students without a linked teacher will never have any.
export default function TeacherWork() {
  const [page, setPage] = usePageParam("work");
  const { items, pagination } = usePagedList("/assignments", "assignments", { page, pageSize: 10 });
  if (!items?.length) return null;

  return (
    <section aria-labelledby="teacher-work" style={{ marginBottom: 36 }}>
      <h2 id="teacher-work" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 24, color: "var(--rw-ink)", marginBottom: 12 }}>
        From your teacher
      </h2>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((a) => {
          const status = studentStatus(a);
          return (
            <Link key={a.id} href={`/member/assignment/${a.id}`} style={row} className="rw-card">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--rw-ink)" }}>{assignmentTitle(a)}</div>
                <div style={{ fontSize: 13, color: "var(--rw-meta)" }}>
                  {[a.instrument, `Level ${a.level}`, a.section].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span style={pill(status.tone)}>{status.label}</span>
            </Link>
          );
        })}
      </div>
      <Pagination pagination={pagination} onChange={setPage} label="Teacher work pages" />
    </section>
  );
}

const row = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderRadius: "var(--rw-radius-md)",
  textDecoration: "none",
};
