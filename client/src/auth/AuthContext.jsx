// Knows who is signed in. On app start it asks the server (/auth/me) because the
// session lives in an httpOnly cookie that JavaScript cannot read.
import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/endpoints.js';
import { queryClient } from '../api/queryClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  // apiFetch fires this event when any request returns 401.
  useEffect(() => {
    const onExpired = () => {
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, []);

  async function login(email, password) {
    const data = await authApi.login(email, password);
    setUser(data.user);
  }

  async function logout() {
    await authApi.logout();
    queryClient.clear(); // forget the previous user's data
    setUser(null);
  }

  const value = {
    user,
    checking,
    login,
    logout,
    isAdmin: user?.role === 'ADMIN',
    isManagerRole: user?.role === 'PROJECT_MANAGER' || user?.role === 'ADMIN',
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
