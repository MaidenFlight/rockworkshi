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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cached = readCachedUser();
    if (cached) setUser(cached);

    fetchCurrentUser()
      .then((serverUser) => {
        if (cancelled) return;
        setUser(serverUser);
        writeCachedUser(serverUser);
      })
      .catch(() => {
        // network error, not a sign-out: keep the cached user
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
