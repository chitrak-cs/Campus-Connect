// Single-key auth storage (shared across tabs). Bearer token, not cookies:
// Vercel (frontend) and Render (API) are cross-site, so cookies are unreliable.
export const TOKEN_KEY = 'cc_token';
export const USER_KEY = 'cc_user';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};
export const saveAuth = (token, user) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable */ }
};
export const saveUser = (user) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* ignore */ }
};
export const clearAuth = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
};

// Remove keys left behind by the old per-tab scheme
export const removeLegacyKeys = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('au_token_') || k.startsWith('au_user_'))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('au_tab');
  } catch { /* ignore */ }
};
