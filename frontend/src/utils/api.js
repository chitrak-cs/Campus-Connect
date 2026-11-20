import axios from 'axios';
import { getToken, clearAuth } from './authStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthCall = /^\/auth\/(login|register|verify-otp|forgot|reset|resend)/.test(url);
    if (err.response?.status === 401 && !isAuthCall) {
      clearAuth();
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(err);
  }
);

export default api;
