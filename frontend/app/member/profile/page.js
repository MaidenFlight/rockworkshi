"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/auth/roles";

const ROLE_LABELS = {
  [ROLES.STUDENT]: "Student",
  [ROLES.PARENT]: "Parent",
  [ROLES.INSTRUCTOR]: "Instructor",
  [ROLES.ADMINISTRATOR]: "Administrator",
};

const FIELDS = [
  { label: "Name", key: "name" },
  { label: "Email", key: "email" },
  { label: "Instrument", key: "instrument" },
  { label: "Level", key: "level" },
  { label: "Experience", key: "experience" },
  { label: "Lesson format", key: "instructionType" },
  { label: "Phone", key: "phone" },
];

export default function MyProfile() {
  const { user, role } = useAuth();

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 30, color: "#0a2338", marginBottom: 4 }}>My Profile</h1>
      <p style={{ color: "#6a6560", marginBottom: 32 }}>Your account details on file with Rock Works.</p>

      <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid #f0e6d8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97" }}>Role</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0a2338", background: "rgba(14,138,151,0.12)", padding: "5px 12px", borderRadius: 999 }}>
            {ROLE_LABELS[role] || role}
          </span>
        </div>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "16px 26px", borderBottom: "1px solid #f0e6d8" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#8a7d6a" }}>{f.label}</span>
            <span style={{ fontSize: 14.5, color: "#33454f", textAlign: "right" }}>{user?.[f.key] || "—"}</span>
          </div>
        ))}
      </div>

      <Link href="/member/settings" style={{ fontSize: 14, fontWeight: 700, color: "#cf3f20", textDecoration: "none" }}>
        Edit in Account Settings &rarr;
      </Link>
    </div>
  );
}
