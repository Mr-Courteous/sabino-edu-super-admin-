import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthLostHandler, tokenStore } from './api';
import type { Admin, Role } from './types';

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => { tokenStore.clear(); setAdmin(null); qc.clear(); }, [qc]);
  useEffect(() => { setAuthLostHandler(logout); }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<Admin>('/auth/me')
      .then((r) => setAdmin(r.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; admin: Admin }>('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(r.data.token);
    setAdmin(r.data.admin);
  };
  const refresh = async () => setAdmin((await api<Admin>('/auth/me')).data);
  const can = (...roles: Role[]) => !!admin && roles.includes(admin.role);

  return <Ctx.Provider value={{ admin, loading, login, logout, refresh, can }}>{children}</Ctx.Provider>;
}
