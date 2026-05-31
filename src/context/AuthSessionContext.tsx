import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authLogin } from '../api/client';
import { onSessionExpired } from '../auth/session';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from '../auth/tokens';
import type { AuthTokens } from '../auth/types';

export type AuthSessionContextValue = {
  isAuthenticated: boolean;
  loading: boolean;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signInWithTokens: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getStoredTokens();
      if (!cancelled) {
        setIsAuthenticated(Boolean(stored?.accessToken && stored?.refreshToken));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      setIsAuthenticated(false);
      router.replace('/login');
    });
  }, []);

  const signInWithTokens = useCallback(async (tokens: AuthTokens) => {
    await setStoredTokens(tokens);
    setIsAuthenticated(true);
    router.replace('/');
  }, []);

  const signInWithCredentials = useCallback(
    async (email: string, password: string) => {
      const tokens = await authLogin({ email, password });
      await signInWithTokens(tokens);
    },
    [signInWithTokens]
  );

  const signOut = useCallback(async () => {
    await clearStoredTokens();
    setIsAuthenticated(false);
    router.replace('/login');
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, loading, signInWithCredentials, signInWithTokens, signOut }),
    [isAuthenticated, loading, signInWithCredentials, signInWithTokens, signOut]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return ctx;
}
