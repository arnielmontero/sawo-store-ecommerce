"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  logout as logoutRequest,
  refreshAccessToken,
  setAccessToken,
  type SessionUser,
} from "./api";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (token: string, user: SessionUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount there's no access token in memory yet (it's never persisted),
  // so re-establish the session from the HttpOnly refresh cookie, if any.
  useEffect(() => {
    refreshAccessToken()
      .then(({ accessToken, user: refreshedUser }) => {
        setAccessToken(accessToken);
        setUser(refreshedUser);
      })
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
  }, []);

  function login(token: string, sessionUser: SessionUser) {
    setAccessToken(token);
    setUser(sessionUser);
  }

  function logout() {
    logoutRequest().catch(() => {
      // best-effort — clear local state regardless of whether the network
      // call succeeds, since the user has already decided to leave
    });
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return { user, loading };
}
