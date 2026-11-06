"use client";

import Link from "next/link";
import MusicProfile from "@/components/member/MusicProfile";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_LABELS = { student: "Student", guardian: "Parent or guardian", teacher: "Teacher", admin: "Administrator" };

const FIELDS = [
  { label: "Name", key: "name" },
  { label: "Email", key: "email" },
  { label: "Instrument", key: "instrument" },
  { label: "Level", key: "level" },
  { label: "Lesson format", key: "instructionType" },
  { label: "Phone", key: "phone" },
];

export default function MyProfile() {
  const { user } = useAuth();
  const isStudent = user?.roles?.includes("student") ?? true;

  return (
    <div className="rw-st" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 100px" }}>
      <div>
        <h1 className="rw-st-title">My profile</h1>
        <p className="rw-st-lead">Your account details, and what you tell the school about your music.</p>
      </div>

      <section className="rw-st-card" aria-labelledby="account">
        <h2 id="account">Account</h2>
        <dl className="rw-st-dl">
          <dt>Roles</dt>
          <dd>{(user?.roles || ["student"]).map((r) => ROLE_LABELS[r] || r).join(", ")}</dd>
          {FIELDS.map((f) => (
            <div key={f.key} style={{ display: "contents" }}>
              <dt>{f.label}</dt>
              <dd>{user?.[f.key] || "—"}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: "12px 0 0" }}>
          <Link href="/member/settings" style={{ fontWeight: 700, color: "var(--rw-orange-deep)" }}>
            Edit in account settings →
          </Link>
        </p>
      </section>

      {isStudent && <MusicProfile />}
    </div>
  );
}
