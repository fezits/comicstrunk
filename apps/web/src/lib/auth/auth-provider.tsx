"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import type { AuthUser, AuthResponse, SignupInput } from "@comicstrunk/contracts";
import { AuthContext, type AuthContextType } from "./auth-context";
import { apiClient, setAccessToken } from "@/lib/api/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const locale = useLocale();

  /**
   * Attempt silent refresh on mount to restore session.
   * If a valid httpOnly refresh cookie exists, the server returns
   * a new access token and user data.
   */
  useEffect(() => {
    let cancelled = false;

    async function attemptRefresh() {
      try {
        const res = await apiClient.post<{ success: true; data: AuthResponse }>(
          "/auth/refresh"
        );
        if (!cancelled) {
          const { accessToken, user: userData } = res.data.data;
          setAccessToken(accessToken);
          setUser(userData);
        }
      } catch {
        // Refresh failed — user is not logged in. This is normal.
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    attemptRefresh();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient.post<{ success: true; data: AuthResponse }>(
        "/auth/login",
        { email, password }
      );
      const { accessToken, user: userData } = res.data.data;
      setAccessToken(accessToken);
      setUser(userData);
      router.push(`/${locale}`);
    },
    [router, locale]
  );

  const signup = useCallback(
    async (input: Omit<SignupInput, "acceptedTerms"> & { acceptedTerms: true }) => {
      const res = await apiClient.post<{ success: true; data: AuthResponse }>(
        "/auth/signup",
        input
      );
      const { accessToken, user: userData } = res.data.data;
      setAccessToken(accessToken);
      setUser(userData);
      router.push(`/${locale}`);
    },
    [router, locale]
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Even if logout API fails, clear local state
    }
    setAccessToken(null);
    setUser(null);
    router.push(`/${locale}/login`);
  }, [router, locale]);

  const refreshSession = useCallback(async () => {
    const res = await apiClient.post<{ success: true; data: AuthResponse }>(
      "/auth/refresh"
    );
    const { accessToken, user: userData } = res.data.data;
    setAccessToken(accessToken);
    setUser(userData);
  }, []);

  const value: AuthContextType = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      refreshSession,
    }),
    [user, isLoading, login, signup, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
