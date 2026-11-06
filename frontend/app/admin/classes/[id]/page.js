"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, kindLabel, repeatText, send, when } from "@/lib/studio";

export default function AdminClassPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [found, setFound] = useState([]);
  const [message, setMessage] = useState("");

  const load = useCallback(
    () =>
      api(`/admin/classes/${id}`)
        .then((d) => (setData(d), setError("")))
        .catch((err) => setError(err.message)),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim().length < 2) return setFound([]);
      api(`/admin/people?search=${encodeURIComponent(search.trim())}`)
        .then((d) => setFound(d.people.filter((p) => p.roles.includes("student"))))
        .catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  if (error && !data) return <p className="rw-st-error">{error}</p>;
  if (!data) return <p className="rw-st-muted">Loading…</p>;
  const c = data.class;
  const enrolled = data.roster.filter((r) => r.status === "enrolled");
  const waiting = data.roster.filter((r) => r.status === "waitlisted");
  const onRoster = new Set(data.roster.map((r) => r.id));

  async function enrol(person) {
    try {
      const r = await send(`/admin/classes/${id}/enrolments`, "POST", { userId: person.id });
      setMessage(r.status === "waitlisted" ? `${person.name || person.email} is on the waitlist: the class is full.` : `${person.name || person.email} is enrolled.`);
      setSearch("");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function remove(person) {
    try {
      const r = await send(`/admin/classes/${id}/enrolments/${person.id}`, "DELETE");
      const moved = data.roster.filter((p) => r.promoted.includes(p.id)).map((p) => p.name || p.email);
      setMessage(`${person.name || person.email} removed.${moved.length ? ` ${moved.join(", ")} moved in from the waitlist.` : ""}`);
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  const Row = ({ p }) => (
    <tr data-roster={p.email}>
      <td>
        <strong>{p.name || "—"}</strong>
        <div className="rw-st-muted">{p.email}</div>
      </td>
      <td>{p.instrument || "—"}</td>
      <td>{when(p.since, undefined, { dateOnly: true })}</td>
      <td>
        <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => remove(p)}>
          Remove
        </button>
      </td>
    </tr>
  );

  return (
    <div className="rw-st">
      <div>
        <Link href="/admin/classes" className="rw-st-muted">
          ← Classes
        </Link>
        <h1 className="rw-st-title" style={{ marginTop: 6 }}>
          {c.title}
        </h1>
        <p className="rw-st-lead">
          {kindLabel(c.kind)} with {c.teacher?.name || "no teacher"} · {repeatText(c)} · {c.capacity ? `${enrolled.length} of ${c.capacity} places taken` : `${enrolled.length} enrolled, no limit`}
        </p>
      </div>

      <div className="rw-st-two">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="rw-st-card">
            <h2>Enrolled</h2>
            {enrolled.length === 0 ? (
              <p className="rw-st-muted">Nobody yet.</p>
            ) : (
              <div className="rw-st-table-wrap">
                <table className="rw-st-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Instrument</th>
                      <th>Since</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {enrolled.map((p) => (
                      <Row key={p.id} p={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="rw-st-card">
            <h2>Waitlist</h2>
            {waiting.length === 0 ? (
              <p className="rw-st-muted">No one waiting.</p>
            ) : (
              <>
                <div className="rw-st-table-wrap">
                  <table className="rw-st-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Instrument</th>
                        <th>Waiting since</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {waiting.map((p) => (
                        <Row key={p.id} p={p} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="rw-st-muted" style={{ marginTop: 8 }}>
                  When a place frees up, the person who has waited longest moves in automatically.
                </p>
              </>
            )}
          </section>
        </div>

        <section className="rw-st-card" aria-labelledby="enrol">
          <h2 id="enrol">Enrol a student</h2>
          {c.status !== "active" ? (
            <p className="rw-st-muted">This class was cancelled.</p>
          ) : (
            <>
              <input className="rw-st-input" style={{ width: "100%" }} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name or email" aria-label="Find a student" />
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
                {found.map((p) => (
                  <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                    <span>
                      <strong>{p.name || p.email}</strong>
                      <span className="rw-st-muted"> {p.email}</span>
                    </span>
                    {onRoster.has(p.id) ? (
                      <span className="rw-st-chip">Already in</span>
                    ) : (
                      <button type="button" className="rw-st-btn" data-size="small" onClick={() => enrol(p)}>
                        Enrol
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {message && (
            <p className="rw-st-ok" role="status" style={{ marginTop: 10 }}>
              {message}
            </p>
          )}
          {data.upcoming.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, margin: "18px 0 6px" }}>Next sessions</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                {data.upcoming.map((o) => (
                  <li key={o.id}>
                    {when(o.startsAt, c.timeZone)}
                    {o.status === "cancelled" ? " (cancelled)" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
