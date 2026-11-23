import type { MenuUser, UserRoleCode } from "@/components/layout/MobileMenu";
import { ApiError, api } from "@/lib/api/client";

export const AUTH_SESSION_STORAGE_KEY = "callejeros_auth_session";
export const AUTH_CHANGE_EVENT = "callejeros:auth-change";
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MIN_LENGTH_MESSAGE =
  "La contraseña debe tener al menos 6 caracteres";

/**
 * Código único de 4 dígitos para verificación por SMS y recupero de contraseña (maquetados).
 * Sale de `MOCK_VERIFICATION_CODE` (.env de la raíz), expuesto al cliente desde `next.config.ts`.
 */
export function getMockVerificationCode(): string {
  return process.env.NEXT_PUBLIC_MOCK_VERIFICATION_CODE ?? "";
}

export interface AuthRoleSummary {
  code: UserRoleCode;
  name: string;
}

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_phone_verified: boolean;
  photo: string | null;
  role: AuthRoleSummary;
}

export interface AuthTokenResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface StoredAuthSession {
  access: string;
  refresh: string;
  user: AuthUser;
  rememberMe: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterAccountInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  verificationCode?: string;
}

function notifyAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
  }
}

function parseStoredSession(
  raw: string | null,
  rememberMe: boolean,
): StoredAuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (
      typeof parsed.access === "string" &&
      typeof parsed.refresh === "string" &&
      parsed.user &&
      typeof parsed.user.email === "string"
    ) {
      return {
        access: parsed.access,
        refresh: parsed.refresh,
        user: parsed.user,
        rememberMe,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Guarda la sesión en el navegador según la opción "Recordarme":
 * - `rememberMe: true` → `localStorage` (persiste hasta 30 días aunque se cierre el navegador).
 * - `rememberMe: false` → `sessionStorage` (se pierde al cerrar el navegador y dura máx. 1 día).
 */
export function saveAuthSession(
  response: AuthTokenResponse,
  rememberMe: boolean,
): StoredAuthSession {
  const session: StoredAuthSession = {
    access: response.access,
    refresh: response.refresh,
    user: response.user,
    rememberMe,
  };

  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(session);
    try {
      if (rememberMe) {
        window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
      } else {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
      }
    } catch {
      // Ignora errores de cuota o modo privado restringido
    }
    notifyAuthChange();
  }

  return session;
}

/**
 * Lee la sesión activa desde `sessionStorage` o `localStorage`.
 */
export function loadAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const sessionItem = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    const fromSession = parseStoredSession(sessionItem, false);
    if (fromSession) return fromSession;

    const localItem = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    const fromLocal = parseStoredSession(localItem, true);
    if (fromLocal) return fromLocal;
  } catch {
    return null;
  }

  return null;
}

/**
 * Borra la sesión tanto de `localStorage` como de `sessionStorage`.
 */
export function clearAuthSession(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Sin storage disponible
  }
  notifyAuthChange();
}

export function getAccessToken(): string | null {
  return loadAuthSession()?.access ?? null;
}

export function getRefreshToken(): string | null {
  return loadAuthSession()?.refresh ?? null;
}

export function getAuthHeaders(): Record<string, string> {
  const access = getAccessToken();
  return access ? { Authorization: `Bearer ${access}` } : {};
}

export function updateStoredUser(user: AuthUser): StoredAuthSession | null {
  const current = loadAuthSession();
  if (!current) return null;
  return saveAuthSession(
    {
      access: current.access,
      refresh: current.refresh,
      user,
    },
    current.rememberMe,
  );
}

export function toMenuUser(user: AuthUser | null): MenuUser | null {
  if (!user) return null;
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    name: fullName || user.email.split("@")[0] || "Usuario",
    email: user.email,
    role: user.role?.code ?? "member",
  };
}

/**
 * Devuelve una ruta interna segura para redirigir después de iniciar sesión.
 * Rechaza URLs externas, protocolos (`http:`, `javascript:`), `//` o rutas de auth (`/login`, `/registro`, `/recuperar`).
 */
export function getSafeRedirect(rawRedirect?: string | null): string {
  if (!rawRedirect) return "/";
  const trimmed = rawRedirect.trim();

  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
  ) {
    return "/";
  }

  const pathOnly = trimmed.split(/[?#]/)[0] || "/";
  if (/^\/(login|registro|recuperar)(\/|$)/i.test(pathOnly)) {
    return "/";
  }

  return trimmed;
}

/**
 * Separa un nombre completo en `first_name` y `last_name` para `/api/auth/register/`.
 */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Registra una cuenta nueva en `/api/auth/register/` e inicia sesión automáticamente.
 */
export async function registerAccount({
  fullName,
  email,
  password,
  phone = "",
  verificationCode = "",
}: RegisterAccountInput): Promise<StoredAuthSession> {
  const { firstName, lastName } = splitFullName(fullName);
  const response = await api.post<AuthTokenResponse>("auth/register/", {
    email: email.trim(),
    password,
    first_name: firstName,
    last_name: lastName,
    phone: phone.trim(),
    verification_code: verificationCode.trim(),
  });

  return saveAuthSession(response, false);
}

/**
 * Inicia sesión en `/api/auth/login/` y persiste la sesión según `rememberMe`.
 */
export async function loginWithCredentials({
  email,
  password,
  rememberMe = false,
}: LoginCredentials): Promise<StoredAuthSession> {
  const response = await api.post<AuthTokenResponse>("auth/login/", {
    email: email.trim(),
    password,
    remember_me: rememberMe,
  });

  return saveAuthSession(response, rememberMe);
}

/**
 * Renueva el token de acceso usando el refresh token actual en `/api/auth/refresh/`.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const current = loadAuthSession();
  if (!current?.refresh) return null;

  try {
    const response = await api.post<{ access: string }>("auth/refresh/", {
      refresh: current.refresh,
    });
    saveAuthSession(
      {
        access: response.access,
        refresh: current.refresh,
        user: current.user,
      },
      current.rememberMe,
    );
    return response.access;
  } catch {
    clearAuthSession();
    return null;
  }
}

export interface RequestWithAuthOptions {
  /**
   * Si es `true` y la renovación falla tras un `401`, reintenta sin cabecera
   * `Authorization` (para endpoints públicos que devuelven datos extra con sesión).
   */
  allowPublicFallback?: boolean;
}

/**
 * Ejecuta un pedido a la API adjuntando el token Bearer actual si hay sesión.
 * Ante un `401`, intenta renovar el `access` token una única vez con `refreshAccessToken()`
 * y reintenta el pedido; si la renovación falla y `allowPublicFallback` es `true`,
 * reintenta sin autorización.
 */
export async function requestWithAuth<T>(
  execute: (headers: Record<string, string>) => Promise<T>,
  options: RequestWithAuthOptions = {},
): Promise<T> {
  const { allowPublicFallback = false } = options;
  const authHeaders = getAuthHeaders();
  const hasAuth = Object.keys(authHeaders).length > 0;

  try {
    return await execute(authHeaders);
  } catch (error) {
    if (hasAuth && error instanceof ApiError && error.status === 401) {
      const refreshedAccess = await refreshAccessToken();
      if (refreshedAccess) {
        return execute({ Authorization: `Bearer ${refreshedAccess}` });
      }
      if (allowPublicFallback) {
        return execute({});
      }
    }
    throw error;
  }
}

/**
 * Consulta `/api/auth/me/` con el token Bearer actual (renovándolo una vez si expiró).
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const current = loadAuthSession();
  if (!current?.access) return null;

  try {
    const user = await requestWithAuth((headers) =>
      api.get<AuthUser>("auth/me/", { headers }),
    );
    updateStoredUser(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthSession();
      return null;
    }
    return current.user;
  }
}

/**
 * Cierra sesión invalidando el refresh token en `/api/auth/logout/` y limpiando el storage.
 */
export async function logoutSession(): Promise<void> {
  const current = loadAuthSession();
  clearAuthSession();

  if (!current?.refresh) return;

  try {
    await api.post("auth/logout/", { refresh: current.refresh });
  } catch {
    // Incluso si el token ya había vencido en el servidor, la sesión local ya quedó limpia.
  }
}
