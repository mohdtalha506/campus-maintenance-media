import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserSummaryDTO } from '@campus/shared';
import { webApi } from '../api/client';

interface AuthContextValue {
  user: UserSummaryDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    webApi
      .me()
      .then((res) => {
        if (!mounted) return;
        if (res.user.role === 'supervisor') {
          setUser(res.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await webApi.login(email, password);
    if (res.user.role !== 'supervisor') {
      await webApi.logout().catch(() => undefined);
      throw new Error('Supervisor role is required to access the operations dashboard.');
    }
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await webApi.logout().catch(() => undefined);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
