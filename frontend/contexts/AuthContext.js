"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCurrentUser,
  loginRequest,
  signupRequest,
  logoutRequest,
  updateProfileRequest,
} from "@/lib/auth/authApi";
import { readCachedUser, writeCachedUser } from "@/lib/auth/localCache";
import { getUserRole, hasRole, hasAnyRole } from "@/lib/auth/roles";

// This context is the single seam between the app and whatever actually
// authenticates the user. Today that's the Rock Works Express/Passport
// backend (via lib/auth/authApi.js), with a session cookie as the source of
// truth. To move to Supabase/Firebase/Clerk/Auth0/etc later, only
// lib/auth/authApi.js needs to change — every component below keeps using
// user / isAuthenticated / isLoading / signIn / signOut exactly as they do now.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Both server and client must render the same thing on the first pass, so
  // this always starts at null — reading localStorage here (rather than in
  // the effect below) would mismatch server HTML (no `window`) against the
  // client's first paint and trigger a hydration error.
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Optimistic paint from the cache, applied post-mount (client only) so
    // the header doesn't flash "signed out" while the real check is in
    // flight. isLoading stays true until the server confirms it, so
    // protected routes never trust this value alone.
    const cached = readCachedUser();
    if (cached) setUser(cached);

    fetchCurrentUser()
      .then((serverUser) => {
        if (cancelled) return;
        setUser(serverUser);
        writeCachedUser(serverUser);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const nextUser = await loginRequest(email, password);
    setUser(nextUser);
    writeCachedUser(nextUser);
    return nextUser;
  }, []);

  const signUp = useCallback(async (payload) => {
    const nextUser = await signupRequest(payload);
    setUser(nextUser);
    writeCachedUser(nextUser);
    return nextUser;
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    writeCachedUser(null);
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const nextUser = await updateProfileRequest(fields);
    setUser(nextUser);
    writeCachedUser(nextUser);
    return nextUser;
  }, []);

  const refresh = useCallback(async () => {
    const nextUser = await fetchCurrentUser();
    setUser(nextUser);
    writeCachedUser(nextUser);
    return nextUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      role: getUserRole(user),
      hasRole: (role) => hasRole(user, role),
      hasAnyRole: (roles) => hasAnyRole(user, roles),
      signIn,
      signUp,
      signOut,
      updateProfile,
      refresh,
    }),
    [user, isLoading, signIn, signUp, signOut, updateProfile, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
