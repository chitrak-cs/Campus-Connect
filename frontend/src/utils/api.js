import axios from 'axios';
import { getTabId, tokenKey } from './tabSession';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  try {
    const tabId = getTabId()
    const token = localStorage.getItem(tokenKey(tabId))
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch (e) {
    console.error('Failed to get token', e);
  }
  return config
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthCall = /^\/auth\/(login|register|verify-otp|forgot|reset|resend)/.test(url);
    if (err.response?.status === 401 && !isAuthCall) {
      try {
        const tabId = getTabId()
        localStorage.removeItem(tokenKey(tabId))
        localStorage.removeItem(`au_user_${tabId}`)
      } catch (e) {
        console.error('Failed to remove token', e);
      }
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(err);
  }
);

export default api;
