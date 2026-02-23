import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import client from '../api/client';
import { login as apiLogin, getMe } from '../api/auth';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isProjectLeader: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Beim Start: gespeichertes Token validieren
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setIsLoading(false); return; }

    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    getMe()
      .then(setUser)
      .catch(() => { localStorage.removeItem('token'); delete client.defaults.headers.common['Authorization']; })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    localStorage.setItem('token', result.token);
    client.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
    setUser(result.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete client.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      isProjectLeader: user?.role === 'admin' || user?.role === 'projectLeader',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb AuthProvider verwendet werden');
  return ctx;
};
