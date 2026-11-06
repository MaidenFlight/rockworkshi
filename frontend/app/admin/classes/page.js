"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, kindLabel, repeatText } from "@/lib/studio";

export default function AdminClassesPage() {
  const [search, setSearch] = useState("");
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      api(`/admin/classes${search ? `?search=${encodeURIComponent(search)}` : ""}`)
        .then((d) => (setClasses(d.classes), setError("")))
        .catch((err) => (setError(err.message), setClasses([])));
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  return (
    <div className="rw-st">
      <div>
        <h1 className="rw-st-title">Classes</h1>
        <p className="rw-st-lead">Every class teachers have scheduled. Open one to enrol students; over capacity, they join the waitlist.</p>
      </div>
      <div className="rw-st-search" role="search">
        <input className="rw-st-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes" aria-label="Search classes" />
      </div>
      {error && <p className="rw-st-error">{error}</p>}
      {classes === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="rw-st-empty">
          <strong>No classes</strong>Teachers create classes in their Teacher Studio.
        </div>
      ) : (
        <div className="rw-st-table-wrap">
          <table className="rw-st-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Teacher</th>
                <th>When</th>
                <th>Places</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/classes/${c.id}`}>{c.title}</Link>
                    <div className="rw-st-muted">{kindLabel(c.kind)}</div>
                    {c.status !== "active" && <span className="rw-st-chip" data-tone="red">Cancelled</span>}
                  </td>
                  <td>{c.teacher?.name || "—"}</td>
                  <td>{repeatText(c)}</td>
                  <td>
                    {c.enrolled}
                    {c.capacity ? ` of ${c.capacity}` : " (no limit)"}
                    {c.capacity && c.enrolled >= c.capacity ? (
                      <span className="rw-st-chip" data-tone="warn" style={{ marginLeft: 6 }}>
                        Full
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
