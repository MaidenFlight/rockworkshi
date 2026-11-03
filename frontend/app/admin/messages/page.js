"use client";

import { Suspense } from "react";
import Pagination from "@/components/Pagination";
import { usePagedList, usePageParam } from "@/lib/paging";

export default function AdminMessagesPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p style={{ color: "var(--rw-meta)" }}>Loading…</p>}>
      <AdminMessages />
    </Suspense>
  );
}

function AdminMessages() {
  const [page, setPage] = usePageParam();
  const { items, pagination, loading, error } = usePagedList("/admin/messages", "messages", { page });
  const messages = items ?? [];

  return (
    <div>
      <h1 style={{ fontWeight: 600, fontSize: 24, color: "var(--rw-ink)", marginBottom: 20 }}>Messages</h1>
      {error && (
        <p role="alert" style={{ color: "var(--rw-orange-deep)", fontSize: 13.5 }}>
          {error}
        </p>
      )}
      {loading ? (
        <p style={{ color: "var(--rw-meta)" }}>Loading…</p>
      ) : messages.length === 0 ? (
        !error && <p style={{ color: "var(--rw-meta)" }}>No messages yet.</p>
      ) : (
        <>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ padding: "14px 16px", border: "1px solid var(--rw-border)", borderRadius: 10, background: "var(--rw-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--rw-ink)" }}>{m.name}</span>
                <span style={{ fontSize: 12, color: "var(--rw-meta)" }}>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--rw-meta)", marginBottom: 8 }}>
                {m.email} {m.reason ? `· ${m.reason}` : ""}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--rw-prose)", lineHeight: 1.5 }}>{m.message}</p>
            </div>
          ))}
        </div>
        <Pagination pagination={pagination} onChange={setPage} label="Message pages" />
        </>
      )}
    </div>
  );
}
