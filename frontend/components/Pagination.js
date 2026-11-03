"use client";

import { useRef } from "react";
import { Button } from "@/components/ui";

// Previous / next under a list. Place it straight after the list: if the top of the list has
// scrolled out of view, changing page brings it back. Draws nothing for a single page.
// Ends use aria-disabled rather than disabled so keyboard focus isn't lost at the last page.
export default function Pagination({ pagination, onChange, label = "Pages" }) {
  const nav = useRef(null);
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, pageSize, total, totalPages } = pagination;

  function go(next) {
    if (next < 1 || next > totalPages) return;
    onChange(next);
    const top = nav.current?.previousElementSibling?.getBoundingClientRect().top;
    if (top < 96) window.scrollBy(0, top - 96);
  }

  return (
    <nav ref={nav} aria-label={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
      <span style={{ fontSize: 13, color: "var(--rw-meta)" }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="button" size="sm" variant="secondary" onClick={() => go(page - 1)} aria-disabled={page === 1} style={page === 1 ? ended : undefined}>
          Previous
        </Button>
        <span aria-current="page" style={{ fontSize: 13, fontWeight: 700, color: "var(--rw-ink)", whiteSpace: "nowrap" }}>
          Page {page} of {totalPages}
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={() => go(page + 1)} aria-disabled={page === totalPages} style={page === totalPages ? ended : undefined}>
          Next
        </Button>
      </span>
    </nav>
  );
}

const ended = { opacity: 0.45, cursor: "default" };
