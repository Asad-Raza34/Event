import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { ROLES, ROLE_HOME } from '../lib/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const applySession = useCallback((payload) => {
    setUser(payload?.user || null);
    setProfile(payload?.profile || null);
  }, []);

  const loadSession = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return null;
    }
    try {
      const response = await api.auth.me();
      applySession(response.data);
      return response.data;
    } catch {
      setToken(null);
      setUser(null);
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
      setProfile(null);
      setSessionExpired(true);
      disconnectSocket();
    };
    window.addEventListener('eventsphere:session-expired', handleExpired);
    return () => window.removeEventListener('eventsphere:session-expired', handleExpired);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const response = await api.auth.login(credentials);
      setToken(response.data.accessToken);
      applySession({ user: response.data.user });
      setSessionExpired(false);
      // Fetch the role profile in the background so dashboards render instantly.
      api.auth.me().then((me) => applySession(me.data)).catch(() => {});
      return response.data.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload) => {
      const response = await api.auth.register(payload);
      setToken(response.data.accessToken);
      applySession({ user: response.data.user });
      setSessionExpired(false);
      api.auth.me().then((me) => applySession(me.data)).catch(() => {});
      return response.data.user;
    },
    [applySession],
  );

  const logout = useCallback(
    async ({ everywhere = false } = {}) => {
      try {
        await (everywhere ? api.auth.logoutAll() : api.auth.logout());
      } catch {
        /* the local session is cleared regardless */
      }
      setToken(null);
      disconnectSocket();
      setUser(null);
      setProfile(null);
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const response = await api.auth.me();
    applySession(response.data);
    return response.data;
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      sessionExpired,
      isAuthenticated: Boolean(user),
      role: user?.role || null,
      isAdmin: user?.role === ROLES.ADMIN,
      isExhibitor: user?.role === ROLES.EXHIBITOR,
      isAttendee: user?.role === ROLES.ATTENDEE,
      homeRoute: ROLE_HOME[user?.role] || '/',
      login,
      register,
      logout,
      refreshProfile,
      setProfile,
      updateUser: (updates) => setUser((current) => ({ ...current, ...updates })),
    }),
    [user, profile, loading, sessionExpired, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

export default AuthContext;
