"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { Container, PageHero, SectionHead } from "@/components/ui";
import T from "@/components/T";

export default function Teachers() {
  const [teachers, setTeachers] = useState(undefined);

  useEffect(() => {
    fetch(`${API_URL}/teachers`)
      .then((res) => res.json())
      .then((data) => setTeachers(data.teachers || []))
      .catch(() => setTeachers([]));
  }, []);

  return (
    <div>
      <PageHero title={<T k="teachers.hero.title">Teachers</T>} />

      <Container style={{ paddingTop: 36, paddingBottom: 100 }}>
        {teachers === undefined && <p style={{ color: "var(--rw-meta)" }}>Loading…</p>}
        {teachers && teachers.length === 0 && <p style={{ color: "var(--rw-meta)" }}><T k="teachers.empty">Teacher profiles coming soon.</T></p>}
        {teachers?.length === 1 && <Profile teacher={teachers[0]} />}
        {teachers?.length > 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="rw-cols-3">
            {teachers.map((t) => (
              <div key={t.id} className="rw-card" style={{ border: "1px solid var(--rw-border)", borderRadius: "var(--rw-radius-md)", padding: 22, background: "var(--rw-surface)" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,var(--rw-teal),var(--rw-ink))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--rw-chrome-hi)",
                    fontWeight: 700,
                    fontSize: 20,
                    marginBottom: 14,
                  }}
                >
                  {t.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "var(--rw-ink)" }}>{t.name}</div>
                {t.instruments && (
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--rw-teal)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 10px" }}>
                    {t.instruments}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 14, color: "var(--rw-body)", lineHeight: 1.55 }}>{t.bio}</p>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}

// One teacher gets the page to themselves rather than a lone card in a three-column grid.
function Profile({ teacher }) {
  return (
    <article style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "24px 40px" }}>
      {teacher.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={teacher.photoUrl}
          alt={teacher.name}
          style={{ display: "block", width: 280, maxWidth: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: "var(--rw-radius-md)", background: "var(--rw-ink)" }}
        />
      )}
      <div style={{ flex: "1 1 320px", maxWidth: "65ch" }}>
        <SectionHead title={teacher.name} flush />
        {teacher.instruments && (
          <p style={{ margin: "0 0 12px", fontSize: "var(--rw-text-xs)", fontWeight: 700, color: "var(--rw-teal)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {teacher.instruments}
          </p>
        )}
        {teacher.bio && <p style={{ margin: 0, fontSize: "var(--rw-text-md)", lineHeight: 1.6, color: "var(--rw-body)" }}>{teacher.bio}</p>}
      </div>
    </article>
  );
}
