"use client";

import { useCallback, useEffect, useState } from "react";
import { api, send } from "@/lib/studio";

const ROLE_LABELS = { student: "Student", teacher: "Teacher", admin: "Admin", guardian: "Parent or guardian" };

// Everyone with an account: grant roles, and invite a parent or guardian for a student.
export default function AdminPeoplePage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null); // the person whose guardians are shown, kept as is across reloads

  const load = useCallback(() => {
    const q = new URLSearchParams({ ...(search ? { search } : {}), ...(role ? { role } : {}) });
    return api(`/admin/people?${q}`)
      .then((d) => (setPeople(d.people), setError("")))
      .catch((err) => (setError(err.message), setPeople([])));
  }, [search, role]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function toggle(person, r) {
    const granted = person.roles.filter((x) => x !== "student");
    const next = granted.includes(r) ? granted.filter((x) => x !== r) : [...granted, r];
    if (r === "admin" && !next.includes("admin") && !window.confirm(`Take admin access away from ${person.name || person.email}?`)) return;
    try {
      await send(`/admin/users/${person.id}/roles`, "PUT", { roles: next });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rw-st">
      <div>
        <h1 className="rw-st-title">People and roles</h1>
        <p className="rw-st-lead">Grant teacher, admin and guardian roles, and invite a student&apos;s parent or guardian. Every change is recorded.</p>
      </div>
      <div className="rw-st-search" role="search">
        <input className="rw-st-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search people" />
        <select className="rw-st-input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="">Everyone</option>
          {Object.entries(ROLE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="rw-st-error" role="alert">{error}</p>}

      {people === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : people.length === 0 ? (
        <div className="rw-st-empty">
          <strong>No one matches</strong>Try another name, email or role.
        </div>
      ) : (
        <div className="rw-st-table-wrap">
          <table className="rw-st-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Roles</th>
                <th>Grant</th>
                <th>Guardians</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} data-person={p.email}>
                  <td>
                    <strong>{p.name || "—"}</strong>
                    <div className="rw-st-muted">{p.email}</div>
                    {p.isMinor && <span className="rw-st-chip" data-tone="warn">Under 18</span>}
                  </td>
                  <td>
                    <div className="rw-st-checks">
                      {p.roles.map((r) => (
                        <span key={r} className="rw-st-chip">
                          {ROLE_LABELS[r] || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="rw-st-checks">
                      {["teacher", "admin"].map((r) => (
                        <label key={r} className="rw-st-check">
                          <input type="checkbox" checked={p.roles.includes(r)} onChange={() => toggle(p, r)} aria-label={`${ROLE_LABELS[r]}: ${p.name || p.email}`} />
                          {ROLE_LABELS[r]}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    {!p.roles.includes("student") ? (
                      <span className="rw-st-muted">Is a guardian</span>
                    ) : (
                      <button type="button" className="rw-st-btn" data-size="small" onClick={() => setOpen(open?.id === p.id ? null : p)} aria-expanded={open?.id === p.id}>
                        {open?.id === p.id ? "Close" : "Guardians"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <Guardians key={open.id} person={open} />}
    </div>
  );
}

function Guardians({ person }) {
  const [links, setLinks] = useState(null);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const [message, setMessage] = useState("");

  const load = useCallback(() => api(`/admin/students/${person.id}/guardians`).then((d) => setLinks(d.guardians)), [person.id]);
  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, [load]);

  return (
    <section className="rw-st-card" aria-labelledby="guardians">
      <h2 id="guardians">Parents and guardians of {person.name || person.email}</h2>
      {links === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : links.length === 0 ? (
        <p className="rw-st-muted">None yet.</p>
      ) : (
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, display: "grid", gap: 6 }}>
          {links.map((l) => (
            <li key={l.id}>
              {l.guardian?.name ? `${l.guardian.name} (${l.email})` : l.email} · {l.relationship}{" "}
              {l.accepted ? <span className="rw-st-chip" data-tone="good">Linked</span> : l.expired ? <span className="rw-st-chip" data-tone="off">Invite expired</span> : <span className="rw-st-chip" data-tone="warn">Invited</span>}{" "}
              <button
                type="button"
                className="rw-st-btn"
                data-tone="quiet"
                data-size="small"
                onClick={async () => {
                  await send(`/admin/guardian-links/${l.id}`, "DELETE");
                  await load();
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="rw-st-actions"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage("");
          try {
            const sent = await send(`/admin/students/${person.id}/guardian-invite`, "POST", { email: email || undefined, relationship });
            setMessage(`Invitation sent to ${sent.email}.`);
            setEmail("");
            await load();
          } catch (err) {
            setMessage(err.message);
          }
        }}
      >
        <label className="rw-st-field" style={{ flex: "1 1 240px" }}>
          Email <small>Leave empty to use the parent email from signup</small>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" />
        </label>
        <label className="rw-st-field">
          Relationship
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            <option value="parent">Parent</option>
            <option value="guardian">Guardian</option>
          </select>
        </label>
        <button type="submit" className="rw-st-btn" data-tone="primary" style={{ alignSelf: "end" }}>
          Send invitation
        </button>
      </form>
      {message && (
        <p className="rw-st-muted" role="status" style={{ marginTop: 8 }}>
          {message}
        </p>
      )}
    </section>
  );
}
