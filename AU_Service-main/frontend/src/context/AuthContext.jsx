import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAuthToken, setUnauthorizedHandler } from "../lib/api";

const AuthContext = createContext(null);

const STORAGE_KEY = "au_service_auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAuthToken(parsed.token);
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { token: newToken, user: newUser } = await api.login(email, password);
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
    return newUser;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
