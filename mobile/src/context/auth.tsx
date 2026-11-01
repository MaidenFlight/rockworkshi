import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, saveToken } from "@/lib/api";

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

  // On launch: if a token was saved last time, check it's still good.
  useEffect(() => {
    (async () => {
      try {
        if (await getToken()) {
          const data = await api("/auth/me");
          setUser(data.user);
        }
      } catch {
        await clearToken();
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
    setUser(data.user);
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
