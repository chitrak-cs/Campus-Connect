import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { getToken, getStoredUser, saveAuth, saveUser, clearAuth, removeLegacyKeys } from '../utils/authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => { removeLegacyKeys(); return getStoredUser(); });
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          saveUser(res.data.user);
          connectSocket(token);
        })
        .catch(() => { clearAuth(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    // If the server requires OTP, it will respond with { otpRequired: true, loginId }
    if (res.data && res.data.otpRequired) {
      return res.data;
    }
    const { token, user } = res.data;
    saveAuth(token, user);
    setSessionExpired(false);
    setSessionExpired(false);
    setUser(user);
    connectSocket(token);
    return user;
  }, []);

  const verifyOtp = useCallback(async (loginId, code) => {
    // send generic id and code; caller may pass purpose via third arg in future
    const res = await api.post('/auth/verify-otp', { id: loginId, code });
    const { token, user } = res.data;
    saveAuth(token, user);
    setSessionExpired(false);
    setUser(user);
    connectSocket(token);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    // If the server requires OTP verification for registration it will return { otpRequired: true, registerId }
    if (res.data && res.data.otpRequired) return res.data;
    const { token, user } = res.data;
    saveAuth(token, user);
    setSessionExpired(false);
    setUser(user);
    connectSocket(token);
    return user;
  }, []);

  // Keep tabs in sync: logging out in one tab logs out the others
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'cc_token' && !e.newValue) { setUser(null); disconnectSocket(); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onForcedLogout = () => {
      setSessionExpired(true);
      setUser(null);
      disconnectSocket();
    };
    window.addEventListener('auth:logout', onForcedLogout);
    return () => window.removeEventListener('auth:logout', onForcedLogout);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    disconnectSocket();
  }, []);

  const updateUser = useCallback((updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    saveUser(updated);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, login, verifyOtp, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
