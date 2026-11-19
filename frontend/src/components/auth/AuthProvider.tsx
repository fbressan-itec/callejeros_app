"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
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

const AuthContext = createContext<AuthContextValue | null>(null);

let cachedRawSnapshot: string | null = null;
let cachedUserSnapshot: AuthUser | null = null;

function subscribeToAuthStore(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(AUTH_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getAuthUserSnapshot(): AuthUser | null {
  const session = loadAuthSession();
  const nextUser = session?.user ?? null;
  const serialized = nextUser ? JSON.stringify(nextUser) : null;
  if (serialized !== cachedRawSnapshot) {
    cachedRawSnapshot = serialized;
    cachedUserSnapshot = nextUser;
  }
  return cachedUserSnapshot;
}

function getServerAuthUserSnapshot(): AuthUser | null {
  return null;
}

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const user = useSyncExternalStore(
    subscribeToAuthStore,
    getAuthUserSnapshot,
    getServerAuthUserSnapshot,
  );

  useEffect(() => {
    const stored = loadAuthSession();
    if (stored?.access) {
      void fetchCurrentUser();
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    return loginWithCredentials(credentials);
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
  }, []);

  const setSession = useCallback(
    (response: AuthTokenResponse, rememberMe = false) => {
      return saveAuthSession(response, rememberMe);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
      login,
      logout,
      setSession,
    }),
    [user, login, logout, setSession],
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
