import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, ApiError, clearToken, getToken, readCachedUser, saveCachedUser, saveToken } from "@/lib/api";

type User = { id: string; email: string; name?: string; instrument?: string; paymentComplete: boolean };

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function remember({ id, email, name, instrument, paymentComplete }: User) {
    setUser({ id, email, name, instrument, paymentComplete });
    return saveCachedUser({ id, email, name, instrument, paymentComplete });
  }

  // On launch: if a token was saved last time, check it's still good. Only the server saying
  // no ends the login: offline or during a server problem, carry on as the last known user.
  useEffect(() => {
    (async () => {
      try {
        if (await getToken()) {
          const data = await api("/auth/me");
          await remember(data.user);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await clearToken();
        else setUser(await readCachedUser<User>());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const data = await api("/auth/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await saveToken(data.token);
    await remember(data.user);
  }

  async function signOut() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
