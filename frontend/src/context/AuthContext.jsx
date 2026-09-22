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

/**
 * Apply a completed sign-in: this is the ONLY place the access token is stored,
 * and it runs only after the second factor (e-mail code or passkey) succeeded.
 */
const completeLogin = useCallback(
  (payload) => {
    setToken(payload.accessToken);
    applySession({ user: payload.user });
    setSessionExpired(false);
    // Fetch the role profile in the background so dashboards render instantly.
    api.auth.me().then((me) => applySession(me.data)).catch(() => {});
    return payload.user;
  },
  [applySession],
);

/**
 * Step 1 of sign-in: e-mail + password.
 * For admin users: returns a temporary challenge for the verification screen (2FA required).
 * For non-admin users: completes sign-in immediately and returns the user session.
 */
const login = useCallback(async (credentials) => {
  const response = await api.auth.login({ ...credentials, email: String(credentials.email || '').trim() });
  setSessionExpired(false);
  const data = response.data;

  // Non-admin users: direct login completed, apply session
  if (!data.mfaRequired) {
    completeLogin(data);
    return { ...data, mfaRequired: false };
  }

  // Admin users: 2FA required, return challenge for verification screen
  return data;
}, [completeLogin]);

/** Step 2 of sign-in: verify the e-mail code and only then open the session. */
const verifyLoginCode = useCallback(
  async ({ challengeToken, code }) => {
    const response = await api.auth.verifyLoginCode({ challengeToken, code });
    return completeLogin(response.data);
  },
  [completeLogin],
);

/** Mobile second factor: complete sign-in with a device passkey assertion. */
const verifyPasskeyLogin = useCallback(
  async ({ challengeToken, response }) => {
    const verification = await api.auth.passkeyLoginVerify({ challengeToken, response });
    return completeLogin(verification.data);
  },
  [completeLogin],
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
      verifyLoginCode,
      verifyPasskeyLogin,
      completeLogin,
      register,
      logout,
      refreshProfile,
      setProfile,
      updateUser: (updates) => setUser((current) => ({ ...current, ...updates })),
    }),
    [user, profile, loading, sessionExpired, login, verifyLoginCode, verifyPasskeyLogin, completeLogin, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

export default AuthContext;
