import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('pf_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('pf_token') || null);

  useEffect(() => {
    if (token) localStorage.setItem('pf_token', token);
    else localStorage.removeItem('pf_token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('pf_user', JSON.stringify(user));
    else localStorage.removeItem('pf_user');
  }, [user]);

  const login = async (email, password, isRegister = false) => {
    const path = isRegister ? '/auth/register' : '/auth/login';
    const data = await api(path, { method: 'POST', body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
