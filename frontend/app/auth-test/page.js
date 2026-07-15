"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AuthTest() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refreshMe() {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setUser(data.user);
      setPassword("");
    } catch {
      setError("Could not reach the API.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Auth test (raw API debug page)</h1>

      {user === undefined && <p>Checking session…</p>}

      {user === null && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setMode("login")} disabled={mode === "login"}>
              Log in
            </button>
            <button onClick={() => setMode("signup")} disabled={mode === "signup"}>
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" disabled={submitting}>
              {mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>

          {error && <p style={{ color: "crimson" }}>{error}</p>}

          <hr style={{ margin: "24px 0" }} />

          <a href={`${API_URL}/auth/google`}>
            <button type="button" style={{ width: "100%" }}>
              Sign in with Google
            </button>
          </a>
        </>
      )}

      {user && (
        <>
          <p>Signed in as:</p>
          <pre style={{ background: "#f4f4f4", padding: 12, borderRadius: 6 }}>
            {JSON.stringify(user, null, 2)}
          </pre>
          <button onClick={handleLogout}>Log out</button>
        </>
      )}
    </div>
  );
}
