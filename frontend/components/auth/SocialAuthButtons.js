"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { fetchProviders } from "@/lib/auth/authApi";

// Only renders providers this server is configured for. Without the check a
// deployment missing its Google credentials shows a button that dead-ends on a
// 503, which is worse than not offering it at all.
export default function SocialAuthButtons({ action = "Sign in" }) {
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchProviders().then((p) => {
      if (!cancelled) setProviders(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing until we know — avoids a button appearing then vanishing.
  if (!providers?.google) return null;

  return (
    <a href={`${API_URL}/auth/google`} style={{ display: "block", textDecoration: "none" }}>
      <span style={buttonStyle}>
        <GoogleMark />
        {action} with Google
      </span>
    </a>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86a5.28 5.28 0 0 1-4.96-3.66H1.06v2.34A8.99 8.99 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M4.04 10.76a5.41 5.41 0 0 1 0-3.52V4.9H1.06a8.99 8.99 0 0 0 0 8.2l2.98-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 1.06 4.9l2.98 2.34A5.28 5.28 0 0 1 9 3.58Z" />
    </svg>
  );
}

const buttonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  width: "100%",
  padding: "13px 22px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14.5,
  color: "#33454f",
  background: "#fff",
  border: "1px solid #d8cab8",
  cursor: "pointer",
};
