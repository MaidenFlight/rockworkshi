"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, send } from "@/lib/studio";

export default function AcceptPage() {
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <Accept />
    </Suspense>
  );
}

// A parent or guardian accepting the school's invitation: with their existing account, or by
// setting a password here (the emailed link proves the address is theirs).
function Accept() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    api(`/family/invite?token=${encodeURIComponent(token)}`).then(setInvite).catch((err) => setError(err.message));
  }, [token]);

  async function accept(e) {
    e?.preventDefault();
    setError("");
    try {
      await send("/family/accept", "POST", user ? { token } : { token, name, password });
      await refresh();
      router.push("/family");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rw-st" style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 100px" }}>
      <h1 className="rw-st-title">Follow your student</h1>
      {error && <p className="rw-st-error" role="alert">{error}</p>}
      {!invite ? (
        !error && <p className="rw-st-muted">Checking your invitation…</p>
      ) : user ? (
        <div className="rw-st-card rw-st-form">
          <p style={{ margin: 0 }}>
            Accept to follow {invite.student}&apos;s classes and practice work as {user.email}.
          </p>
          <button type="button" className="rw-st-btn" data-tone="primary" onClick={accept}>
            Accept the invitation
          </button>
        </div>
      ) : invite.accountExists ? (
        <div className="rw-st-card rw-st-form">
          <p style={{ margin: 0 }}>You already have an account for {invite.email}. Sign in, then come back to this link.</p>
          <Link className="rw-st-btn" data-tone="primary" href={`/signin?next=${encodeURIComponent(`/family/accept?token=${token}`)}`}>
            Sign in
          </Link>
        </div>
      ) : (
        <form className="rw-st-card rw-st-form" onSubmit={accept}>
          <p style={{ margin: 0 }}>
            Create your parent account for {invite.email} to follow {invite.student}&apos;s classes, practice work and teacher feedback.
          </p>
          <label className="rw-st-field">
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="rw-st-field">
            Password <small>At least 8 characters</small>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
          </label>
          <button type="submit" className="rw-st-btn" data-tone="primary">
            Create account and accept
          </button>
        </form>
      )}
    </div>
  );
}
