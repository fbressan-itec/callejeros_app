import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_STORAGE_KEY,
  type AuthTokenResponse,
  clearAuthSession,
  fetchCurrentUser,
  getAccessToken,
  getAuthHeaders,
  getRefreshToken,
  getSafeRedirect,
  loadAuthSession,
  loginWithCredentials,
  logoutSession,
  saveAuthSession,
  toMenuUser,
} from "./session";

const fetchMock = vi.fn();

const MOCK_AUTH_RESPONSE: AuthTokenResponse = {
  access: "access-token-123",
  refresh: "refresh-token-456",
  user: {
    id: 1,
    email: "miembro@callejeros.ar",
    first_name: "Lucía",
    last_name: "Gómez",
    phone: "3584123456",
    is_phone_verified: true,
    photo: null,
    role: {
      code: "member",
      name: "Miembro",
    },
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("session y almacenamiento según Recordarme", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("con Recordarme tildado guarda la sesión en localStorage y limpia sessionStorage", () => {
    window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, "viejo");

    const stored = saveAuthSession(MOCK_AUTH_RESPONSE, true);

    expect(stored.rememberMe).toBe(true);
    expect(
      window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
    expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(loadAuthSession()).toEqual({
      ...MOCK_AUTH_RESPONSE,
      rememberMe: true,
    });
    expect(getAccessToken()).toBe("access-token-123");
    expect(getRefreshToken()).toBe("refresh-token-456");
    expect(getAuthHeaders()).toEqual({
      Authorization: "Bearer access-token-123",
    });
  });

  it("sin Recordarme tildado guarda la sesión solo en sessionStorage y no en localStorage", () => {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, "viejo");

    const stored = saveAuthSession(MOCK_AUTH_RESPONSE, false);

    expect(stored.rememberMe).toBe(false);
    expect(
      window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(loadAuthSession()).toEqual({
      ...MOCK_AUTH_RESPONSE,
      rememberMe: false,
    });
  });

  it("loginWithCredentials envía remember_me al back y guarda según la elección", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, MOCK_AUTH_RESPONSE));

    await loginWithCredentials({
      email: "miembro@callejeros.ar",
      password: "ClaveSegura123!",
      rememberMe: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/auth/login/");
    expect(JSON.parse(init.body)).toEqual({
      email: "miembro@callejeros.ar",
      password: "ClaveSegura123!",
      remember_me: true,
    });
    expect(
      window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
    expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, MOCK_AUTH_RESPONSE));

    await loginWithCredentials({
      email: "miembro@callejeros.ar",
      password: "ClaveSegura123!",
      rememberMe: false,
    });

    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(
      window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
  });

  it("fetchCurrentUser renueva el access token si /api/auth/me/ responde 401", async () => {
    saveAuthSession(MOCK_AUTH_RESPONSE, true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Token vencido" }))
      .mockResolvedValueOnce(jsonResponse(200, { access: "nuevo-access-999" }))
      .mockResolvedValueOnce(jsonResponse(200, MOCK_AUTH_RESPONSE.user));

    const user = await fetchCurrentUser();

    expect(user?.email).toBe("miembro@callejeros.ar");
    expect(getAccessToken()).toBe("nuevo-access-999");
  });

  it("logoutSession limpia el storage e invalida el refresh token en /api/auth/logout/", async () => {
    saveAuthSession(MOCK_AUTH_RESPONSE, true);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await logoutSession();

    expect(loadAuthSession()).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/auth/logout/");
    expect(JSON.parse(init.body)).toEqual({ refresh: "refresh-token-456" });
  });

  it("clearAuthSession borra ambos storages y toMenuUser formatea nombre y rol", () => {
    saveAuthSession(MOCK_AUTH_RESPONSE, true);
    expect(toMenuUser(MOCK_AUTH_RESPONSE.user)).toEqual({
      name: "Lucía Gómez",
      email: "miembro@callejeros.ar",
      role: "member",
    });

    clearAuthSession();
    expect(loadAuthSession()).toBeNull();
  });

  it("getSafeRedirect solo permite rutas internas que no sean de autenticación", () => {
    expect(getSafeRedirect("/adopciones")).toBe("/adopciones");
    expect(getSafeRedirect("/alertas/reportar")).toBe("/alertas/reportar");
    expect(getSafeRedirect("/adopciones#publicar")).toBe(
      "/adopciones#publicar",
    );
    expect(getSafeRedirect("https://sitio-malicioso.com")).toBe("/");
    expect(getSafeRedirect("//sitio-malicioso.com")).toBe("/");
    expect(getSafeRedirect("javascript:alert(1)")).toBe("/");
    expect(getSafeRedirect("/login")).toBe("/");
    expect(getSafeRedirect("/registro?redirect=/mi-cuenta")).toBe("/");
    expect(getSafeRedirect("/recuperar")).toBe("/");
    expect(getSafeRedirect("")).toBe("/");
    expect(getSafeRedirect(null)).toBe("/");
  });
});
