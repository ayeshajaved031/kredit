// ==============================================================
// Auth Context
// --------------------------------------------------------------
// Provides the current user + startup, plus auth actions, to the
// whole app. On app load, if a JWT exists, we hit /auth/me to
// hydrate the user — this validates the token in one round-trip
// and gives the protected layouts something to render against.
//
// State shape:
//   { status: 'loading' | 'authenticated' | 'unauthenticated',
//     user, startup }
//
// Actions:
//   login(email, password)            -> { user, startup }
//   register(payload)                 -> { user, startup }
//   logout()                          -> void
//   refresh()                         -> reloads user from server
// ==============================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setToken, getToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(getToken() ? "loading" : "unauthenticated");
  const [user, setUser] = useState(null);
  const [startup, setStartup] = useState(null);

  // Hydrate on mount (or when the token changes externally)
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setStatus("unauthenticated");
      setUser(null);
      setStartup(null);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data?.data?.user || null);
      setStartup(res.data?.data?.startup || null);
      setStatus("authenticated");
    } catch {
      // 401 is handled by the axios interceptor (auto-redirect).
      // Other errors (network etc.) — fall back to unauthenticated.
      setToken(null);
      setUser(null);
      setStartup(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user: u, startup: s } = res.data?.data || {};
    if (!token) throw new Error("Login response missing token");
    setToken(token);
    setUser(u);
    setStartup(s);
    setStatus("authenticated");
    return { user: u, startup: s };
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post("/auth/register", payload);
    const { token, user: u, startup: s } = res.data?.data || {};
    if (token) {
      setToken(token);
      setUser(u);
      setStartup(s);
      setStatus("authenticated");
    }
    return { user: u, startup: s };
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* client-side anyway */ }
    setToken(null);
    setUser(null);
    setStartup(null);
    setStatus("unauthenticated");
  }, []);

  const value = {
    status,
    user,
    startup,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    isAdmin: user?.role === "admin",
    isStartup: user?.role === "startup",
    login,
    register,
    logout,
    refresh,
    setStartup, // some pages (KYC upload) need to update startup state directly
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
