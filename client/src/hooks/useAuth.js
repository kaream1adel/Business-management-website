import { useState, useCallback } from 'react';

const TOKEN_KEY = 'bizdash_token';

// Reads the (signed) token's payload for display; the server enforces it.
function readToken(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return {}; }
}

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const start = useCallback(async (url, body) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      return true;
    } catch (err) {
      setLoginError(err.message);
      return false;
    } finally {
      setLoginLoading(false);
    }
  }, []);

  // No arguments: open the demo
  const login = useCallback((username, password) =>
    username === undefined ? start('/api/demo', {}) : start('/api/login', { username, password }), [start]);
  const signup = useCallback((username, password) => start('/api/signup', { username, password }), [start]);
  const clearError = useCallback(() => setLoginError(''), []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  // Attach token to every fetch call
  const authFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
    return res;
  }, [token, logout]);

  const claims = token ? readToken(token) : {};
  const isDemo = !!claims.demo;
  const username = claims.name || claims.sub || '';

  return { token, isDemo, username, login, signup, logout, clearError, loginError, loginLoading, authFetch };
}
