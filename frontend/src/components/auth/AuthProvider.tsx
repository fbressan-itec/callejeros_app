"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUTH_CHANGE_EVENT,
  type AuthTokenResponse,
  type AuthUser,
  fetchCurrentUser,
  type LoginCredentials,
  loadAuthSession,
  loginWithCredentials,
  logoutSession,
  saveAuthSession,
  type StoredAuthSession,
} from "@/lib/auth/session";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<StoredAuthSession>;
  logout: () => Promise<void>;
  setSession: (
    response: AuthTokenResponse,
    rememberMe?: boolean,
  ) => StoredAuthSession;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    function hydrateAndSync() {
      const stored = loadAuthSession();
      if (isCancelled) return;
      setUser(stored?.user ?? null);
      setIsLoading(false);

      if (stored?.access) {
        void fetchCurrentUser().then((freshUser) => {
          if (!isCancelled) {
            setUser(freshUser);
          }
        });
      }
    }

    function handleAuthChange() {
      const stored = loadAuthSession();
      setUser(stored?.user ?? null);
    }

    queueMicrotask(hydrateAndSync);

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      isCancelled = true;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const session = await loginWithCredentials(credentials);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
    setUser(null);
  }, []);

  const setSession = useCallback(
    (response: AuthTokenResponse, rememberMe = false) => {
      const session = saveAuthSession(response, rememberMe);
      setUser(session.user);
      return session;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      setSession,
    }),
    [user, isLoading, login, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: loginWithCredentials,
      logout: logoutSession,
      setSession: (response, rememberMe = false) =>
        saveAuthSession(response, rememberMe),
    };
  }
  return context;
}
