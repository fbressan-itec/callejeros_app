import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMapSearchUrl,
  buildTelHref,
  fetchAdoptionRequestById,
  formatAdoptionRequestDate,
  isFinalAdoptionRequestStatus,
} from "@/lib/adoptions/api";
import { parsePositiveId } from "@/lib/api/ids";
import { AUTH_SESSION_STORAGE_KEY } from "@/lib/auth/session";

const fetchMock = vi.fn();

describe("lib/adoptions/api", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("pide la solicitud con el token de la sesión", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-acceso",
        refresh: "token-refresh",
        user: { email: "miembro@callejeros.ar" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 7, status: "pending" }), {
        status: 200,
      }),
    );

    const result = await fetchAdoptionRequestById(7);

    expect(result).toEqual({ id: 7, status: "pending" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/adoption-requests/7/");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-acceso",
    );
  });

  it("solo considera finales las solicitudes aprobadas o desaprobadas", () => {
    expect(isFinalAdoptionRequestStatus("pending")).toBe(false);
    expect(isFinalAdoptionRequestStatus("approved")).toBe(true);
    expect(isFinalAdoptionRequestStatus("rejected")).toBe(true);
  });

  it("arma el enlace tel: con los dígitos y el + inicial", () => {
    expect(buildTelHref("+54 9 358 4222222")).toBe("tel:+5493584222222");
    expect(buildTelHref("358 412-0000")).toBe("tel:3584120000");
  });

  it("agrega Río Cuarto a la búsqueda del mapa solo si la dirección no lo dice", () => {
    expect(buildMapSearchUrl("Sobremonte 1250")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sobremonte%201250%2C%20R%C3%ADo%20Cuarto",
    );
    expect(buildMapSearchUrl(" Sobremonte 1250, Río Cuarto ")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sobremonte%201250%2C%20R%C3%ADo%20Cuarto",
    );
  });

  it("formatea la fecha de envío en formato argentino", () => {
    expect(formatAdoptionRequestDate("2026-11-20T15:00:00Z")).toBe(
      "20/11/2026",
    );
    expect(formatAdoptionRequestDate("no-es-fecha")).toBe("");
  });

  it("valida IDs de ruta positivos", () => {
    expect(parsePositiveId("12")).toBe(12);
    expect(parsePositiveId(" 3 ")).toBe(3);
    expect(parsePositiveId("0")).toBeNull();
    expect(parsePositiveId("1.5")).toBeNull();
    expect(parsePositiveId("abc")).toBeNull();
    expect(parsePositiveId("")).toBeNull();
  });
});
