"use client";

import { useEffect, useState } from "react";
import { WEEKDAYS, api, send, toMinutes, toTime, viewerZone } from "@/lib/studio";

const FORMATS = { online: "Online", "in-person": "In person", either: "Either" };
const AGES = { "under-13": "Under 13", "13-17": "13 to 17", "18+": "18 or over" };
const CONSENTS = {
  "share-practice": "Share my practice activity with my teachers (used from a later update)",
  "band-matching": "Let teachers consider me for bands (used from a later update)",
};

// The student's own music profile: all optional, private to their teachers or to themselves, and
// for a student under 18 only once a parent or guardian has agreed.
export default function MusicProfile() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    api("/me/profile")
      .then((d) => {
        setData(d);
        const p = d.profile || {};
        setForm({
          profile: {
            ageBracket: p.ageBracket ?? "",
            area: p.area ?? "",
            goals: p.goals ?? "",
            rehearsalFormat: p.rehearsalFormat ?? "",
            genres: p.genres ?? [],
            favouriteArtists: p.favouriteArtists ?? "",
            learningPreferences: p.learningPreferences ?? "",
            bandInterest: Boolean(p.bandInterest),
            performInterest: Boolean(p.performInterest),
            productionInterest: Boolean(p.productionInterest),
            visibility: p.visibility ?? "teachers",
          },
          instruments: d.instruments.map((i) => ({ instrument: i.instrument, primary: i.primary, selfLevel: i.selfLevel ?? "" })),
          availability: d.availability.map((a) => ({ weekday: a.weekday, start: toTime(a.startMinute), end: toTime(a.endMinute) })),
        });
      })
      .catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  if (error && !data) return <p className="rw-st-error">{error}</p>;
  if (!data || !form) return <p className="rw-st-muted">Loading…</p>;
  const o = data.options;
  const setP = (patch) => setForm({ ...form, profile: { ...form.profile, ...patch } });
  const has = (i) => form.instruments.find((x) => x.instrument === i);

  async function save(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const p = form.profile;
      await send("/me/profile", "PUT", {
        profile: { ...p, ageBracket: p.ageBracket || null, rehearsalFormat: p.rehearsalFormat || null },
        instruments: form.instruments.map((i) => ({ ...i, selfLevel: i.selfLevel || null })),
        availability: form.availability.map((a) => ({ weekday: Number(a.weekday), startMinute: toMinutes(a.start), endMinute: toMinutes(a.end) })),
        timeZone: viewerZone(),
      });
      setMessage("Profile saved.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data.canEdit) {
    return (
      <section className="rw-st-card" aria-labelledby="music">
        <h2 id="music">My music profile</h2>
        <p className="rw-st-muted">Because you&apos;re under 18, a parent or guardian needs to agree before the school keeps a profile for you. Ask them to accept the school&apos;s invitation and switch it on.</p>
      </section>
    );
  }

  return (
    <section className="rw-st-card" aria-labelledby="music">
      <h2 id="music">My music profile</h2>
      <p className="rw-st-muted" style={{ marginBottom: 14 }}>
        Everything here is optional. It helps your teachers plan lessons and groups. You choose who sees it, and you can clear it any time.
      </p>
      <form className="rw-st-form" onSubmit={save}>
        <fieldset className="rw-st-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>Instruments I play</legend>
          <div style={{ display: "grid", gap: 6 }}>
            {o.instruments.map((i) => {
              const row = has(i);
              return (
                <div key={i} className="rw-st-actions">
                  <label className="rw-st-check" style={{ minWidth: 120 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(row)}
                      onChange={() =>
                        setForm({ ...form, instruments: row ? form.instruments.filter((x) => x.instrument !== i) : [...form.instruments, { instrument: i, primary: form.instruments.length === 0, selfLevel: "" }] })
                      }
                    />
                    {i}
                  </label>
                  {row && (
                    <>
                      <select className="rw-st-input" value={row.selfLevel} onChange={(e) => setForm({ ...form, instruments: form.instruments.map((x) => (x.instrument === i ? { ...x, selfLevel: e.target.value } : x)) })} aria-label={`My level on ${i}`}>
                        <option value="">My level…</option>
                        {["Just starting", "Beginner", "Developing", "Intermediate", "Advanced"].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                      <label className="rw-st-check">
                        <input type="radio" name="primary" checked={row.primary} onChange={() => setForm({ ...form, instruments: form.instruments.map((x) => ({ ...x, primary: x.instrument === i })) })} />
                        Main
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="rw-st-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>Music I love</legend>
          <div className="rw-st-checks">
            {o.genres.map((g) => (
              <label key={g} className="rw-st-check">
                <input type="checkbox" checked={form.profile.genres.includes(g)} onChange={() => setP({ genres: form.profile.genres.includes(g) ? form.profile.genres.filter((x) => x !== g) : [...form.profile.genres, g] })} />
                {g}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="rw-st-field">
          Favourite artists and songs
          <input value={form.profile.favouriteArtists} onChange={(e) => setP({ favouriteArtists: e.target.value })} maxLength={500} />
        </label>
        <label className="rw-st-field">
          My goals <small>e.g. play a whole song with a band by summer</small>
          <textarea value={form.profile.goals} onChange={(e) => setP({ goals: e.target.value })} maxLength={1000} />
        </label>
        <label className="rw-st-field">
          How I like to learn <small>In your own words</small>
          <input value={form.profile.learningPreferences} onChange={(e) => setP({ learningPreferences: e.target.value })} maxLength={500} />
        </label>

        <fieldset className="rw-st-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>I&apos;m interested in</legend>
          <div className="rw-st-checks">
            {[
              ["bandInterest", "Joining a band"],
              ["performInterest", "Performing live"],
              ["productionInterest", "Recording and production"],
            ].map(([k, label]) => (
              <label key={k} className="rw-st-check">
                <input type="checkbox" checked={form.profile[k]} onChange={(e) => setP({ [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rw-st-row">
          <label className="rw-st-field">
            Rehearsals
            <select value={form.profile.rehearsalFormat} onChange={(e) => setP({ rehearsalFormat: e.target.value })}>
              <option value="">No preference given</option>
              {o.formats.map((f) => (
                <option key={f} value={f}>
                  {FORMATS[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="rw-st-field">
            General area <small>e.g. Windward O&apos;ahu. Never your address.</small>
            <input value={form.profile.area} onChange={(e) => setP({ area: e.target.value })} maxLength={80} />
          </label>
          <label className="rw-st-field">
            Age bracket <small>For age-appropriate classes</small>
            <select value={form.profile.ageBracket} onChange={(e) => setP({ ageBracket: e.target.value })}>
              <option value="">Rather not say</option>
              {o.ageBrackets.map((a) => (
                <option key={a} value={a}>
                  {AGES[a]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="rw-st-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>
            When I&apos;m usually free <small>(times in {viewerZone().replace(/_/g, " ")})</small>
          </legend>
          <div style={{ display: "grid", gap: 6 }}>
            {form.availability.map((a, n) => (
              <div key={n} className="rw-st-actions">
                <select className="rw-st-input" value={a.weekday} onChange={(e) => setForm({ ...form, availability: form.availability.map((x, i) => (i === n ? { ...x, weekday: Number(e.target.value) } : x)) })} aria-label="Day">
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input className="rw-st-input" type="time" value={a.start} onChange={(e) => setForm({ ...form, availability: form.availability.map((x, i) => (i === n ? { ...x, start: e.target.value } : x)) })} aria-label="From" />
                <span>to</span>
                <input className="rw-st-input" type="time" value={a.end} onChange={(e) => setForm({ ...form, availability: form.availability.map((x, i) => (i === n ? { ...x, end: e.target.value } : x)) })} aria-label="Until" />
                <button type="button" className="rw-st-btn" data-tone="quiet" data-size="small" onClick={() => setForm({ ...form, availability: form.availability.filter((_, i) => i !== n) })}>
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="rw-st-btn" data-size="small" onClick={() => setForm({ ...form, availability: [...form.availability, { weekday: 6, start: "10:00", end: "12:00" }] })}>
                Add a time
              </button>
            </div>
          </div>
        </fieldset>

        <label className="rw-st-field">
          Who can see this
          <select value={form.profile.visibility} onChange={(e) => setP({ visibility: e.target.value })}>
            <option value="teachers">My teachers and the school office</option>
            <option value="private">Only me</option>
          </select>
        </label>

        {error && <p className="rw-st-error" role="alert">{error}</p>}
        <div className="rw-st-actions">
          <button type="submit" className="rw-st-btn" data-tone="primary">
            Save profile
          </button>
          {data.profile && (
            <button
              type="button"
              className="rw-st-btn"
              data-tone="quiet"
              onClick={async () => {
                if (!window.confirm("Clear your music profile?")) return;
                await send("/me/profile", "DELETE");
                setMessage("Profile cleared.");
                await load();
              }}
            >
              Clear my profile
            </button>
          )}
          {message && <span className="rw-st-ok" role="status">{message}</span>}
        </div>
      </form>

      {!data.minor && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>What I allow</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {Object.entries(CONSENTS).map(([purpose, label]) => (
              <label key={purpose} className="rw-st-check" style={{ fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={data.consents[purpose] === true}
                  onChange={async (e) => {
                    await send("/me/consents", "POST", { purpose, granted: e.target.checked });
                    await load();
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
