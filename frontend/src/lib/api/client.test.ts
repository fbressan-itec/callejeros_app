import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, getApiUrl } from "./client";
import { ERROR_MESSAGES } from "./errors";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("Se esperaba un error y la llamada salió bien");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api/");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("getApiUrl", () => {
  it("saca la barra final de la URL", () => {
    expect(getApiUrl()).toBe("http://api.test/api");
  });

  it("avisa si falta la variable", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(() => getApiUrl()).toThrow("Falta NEXT_PUBLIC_API_URL");
  });
});

describe("respuestas correctas", () => {
  it("GET devuelve los datos de la respuesta", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: 1, name: "Loki" }]));

    const pets = await api.get<{ id: number; name: string }[]>("/pets/");

    expect(pets).toEqual([{ id: 1, name: "Loki" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("POST manda el cuerpo como JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 7 }));

    await api.post("pets/", { name: "Luna" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Luna" }));
  });

  it("una respuesta sin contenido (204) devuelve null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.delete("pets/7/")).resolves.toBeNull();
  });
});

describe("errores del back", () => {
  it("convierte los errores de validación en errores por campo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        email: ["Ya existe una cuenta con este email."],
        password: ["La contraseña debe tener al menos 6 caracteres."],
      }),
    );

    const error = await catchError(api.post("auth/register/", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe(ERROR_MESSAGES.validation);
    expect(error.fieldErrors).toEqual({
      email: ["Ya existe una cuenta con este email."],
      password: ["La contraseña debe tener al menos 6 caracteres."],
    });
  });

  it("usa `detail` como mensaje general", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { detail: "Solo Staff puede aprobar publicaciones." }),
    );

    const error = await catchError(api.post("pets/7/approve/"));

    expect(error.status).toBe(403);
    expect(error.message).toBe("Solo Staff puede aprobar publicaciones.");
    expect(error.fieldErrors).toEqual({});
  });

  it("usa `non_field_errors` como mensaje general", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        non_field_errors: ["Email o contraseña incorrectos."],
      }),
    );

    const error = await catchError(api.post("auth/login/", {}));

    expect(error.message).toBe("Email o contraseña incorrectos.");
    expect(error.fieldErrors).toEqual({});
  });

  it("si el error no es JSON, muestra un mensaje genérico", async () => {
    fetchMock.mockResolvedValue(
      new Response("<h1>Server Error</h1>", { status: 500 }),
    );

    const error = await catchError(api.get("pets/"));

    expect(error.status).toBe(500);
    expect(error.message).toBe(ERROR_MESSAGES.server);
  });
});

describe("errores de conexión", () => {
  it("sin conexión devuelve status 0 y un mensaje claro", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await catchError(api.get("pets/"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe(ERROR_MESSAGES.network);
  });

  it("si el pedido se cancela, no lo trata como error de conexión", async () => {
    fetchMock.mockRejectedValue(new DOMException("Cancelado", "AbortError"));

    const error = await catchError(api.get("pets/"));

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe("AbortError");
  });
});
