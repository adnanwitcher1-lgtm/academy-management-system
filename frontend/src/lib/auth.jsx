import { createContext, useContext, useMemo, useState } from "react";
import { api, clearSession, loadSession, saveSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session?.access),
      role: session?.role ?? null,
      async login(username, password) {
        const data = await api.login(username, password);
        const next = {
          access: data.access,
          refresh: data.refresh,
          role: data.role,
          username: data.username,
          mustChangePassword: data.must_change_password,
        };
        saveSession(next);
        setSession(next);
        return next;
      },
      logout() {
        clearSession();
        setSession(null);
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
