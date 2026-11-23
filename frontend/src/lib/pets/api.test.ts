import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { AUTH_SESSION_STORAGE_KEY } from "@/lib/auth/session";
import {
  fetchPetById,
  fetchPets,
  formatPetAge,
  parsePetId,
  resolvePetImageUrl,
} from "@/lib/pets/api";
import type { PetDetail } from "@/lib/pets/types";

const fetchMock = vi.fn();

const SAMPLE_PET: PetDetail = {
  id: 1,
  name: "Loki",
  species: "dog",
  sex: "male",
  estimated_birth_date: "2024-05-10",
  age_group: "adulto",
  is_sociable: true,
  good_with_children: "yes",
  good_with_animals: "yes",
  is_neutered: true,
  is_urgent: false,
  special_care: "",
  description:
    "Loki es un perrito muy cariñoso que disfruta pasear por el parque.",
  notes: "Requiere patio cerrado.",
  status: "published",
  published_by: {
    id: 2,
    first_name: "Refugio",
    last_name: "Patitas",
    role: { code: "verified_shelter", name: "Refugio verificado" },
  },
  health: {
    general_status: "Sano y bajo control veterinario",
    vaccines: "Al día",
    deworming: "Desparasitado",
    flea_tick_treatment: "Pipeta al día",
    other: "Sin complicaciones",
  },
  badges: [
    { key: "species", tone: "neutral", icon: "dog", text: "Perro" },
    { key: "sex", tone: "sky", icon: "male", text: "Macho" },
  ],
  photos: [
    {
      id: 10,
      image: "http://api.test/media/pets/loki-1.jpg",
      position: 0,
      created_at: "2026-11-20T12:00:00Z",
    },
  ],
  created_at: "2026-11-20T12:00:00Z",
  updated_at: "2026-11-20T12:00:00Z",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("parsePetId", () => {
  it("acepta enteros positivos válidos", () => {
    expect(parsePetId("1")).toBe(1);
    expect(parsePetId(" 42 ")).toBe(42);
  });

  it("rechaza cero, negativos, decimales o texto", () => {
    expect(parsePetId("0")).toBeNull();
    expect(parsePetId("-5")).toBeNull();
    expect(parsePetId("1.5")).toBeNull();
    expect(parsePetId("loki")).toBeNull();
    expect(parsePetId("12abc")).toBeNull();
    expect(parsePetId("")).toBeNull();
  });
});

describe("resolvePetImageUrl", () => {
  it("mantiene URLs absolutas, data y blob sin modificar", () => {
    expect(resolvePetImageUrl("https://cdn.test/loki.jpg")).toBe(
      "https://cdn.test/loki.jpg",
    );
    expect(resolvePetImageUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("resuelve rutas relativas contra el origen de la API", () => {
    expect(resolvePetImageUrl("/media/pets/loki.jpg")).toBe(
      "http://api.test/media/pets/loki.jpg",
    );
    expect(resolvePetImageUrl("media/pets/loki.jpg")).toBe(
      "http://api.test/media/pets/loki.jpg",
    );
  });
});

describe("formatPetAge", () => {
  it("formatea menos de un mes, meses y años respetando las mayúsculas del maquetado", () => {
    const today = new Date(2026, 10, 23); // 2026-11-23
    expect(formatPetAge("2026-11-23", today)).toBe("Menos de 1 Mes");
    expect(formatPetAge("2026-11-05", today)).toBe("Menos de 1 Mes");
    expect(formatPetAge("2026-10-20", today)).toBe("1 Mes");
    expect(formatPetAge("2026-03-10", today)).toBe("8 Meses");
    expect(formatPetAge("2025-11-23", today)).toBe("1 Año");
    expect(formatPetAge("2024-05-10", today)).toBe("2 Años");
  });

  it("maneja correctamente el 29 de febrero y fechas inválidas", () => {
    expect(formatPetAge("2023-02-28", new Date(2024, 1, 29))).toBe("1 Año");
    expect(formatPetAge("2024-02-29", new Date(2025, 2, 1))).toBe("1 Año");
    expect(formatPetAge("fecha-invalida")).toBe("");
  });
});

describe("fetchPetById", () => {
  it("consulta GET /api/pets/{id}/ sin token cuando no hay sesión", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    const pet = await fetchPetById(1);

    expect(pet).toEqual(SAMPLE_PET);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("envía el token Bearer cuando hay sesión activa", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-vigente",
        refresh: "refresh-vigente",
        user: {
          id: 1,
          email: "staff@callejeros.ar",
          first_name: "Valentina",
          last_name: "López",
          phone: "",
          is_phone_verified: true,
          photo: null,
          role: { code: "staff", name: "Staff Callejeros" },
        },
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    await fetchPetById(1);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer token-vigente");
  });

  it("renueva el token si recibe 401 y reintenta la lectura", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-vencido",
        refresh: "refresh-valido",
        user: {
          id: 1,
          email: "staff@callejeros.ar",
          first_name: "Valentina",
          last_name: "López",
          phone: "",
          is_phone_verified: true,
          photo: null,
          role: { code: "staff", name: "Staff Callejeros" },
        },
      }),
    );

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Token vencido" }))
      .mockResolvedValueOnce(jsonResponse(200, { access: "token-nuevo" }))
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    const pet = await fetchPetById(1);

    expect(pet.name).toBe("Loki");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer token-nuevo",
    );
  });

  it("reintenta sin token si el refresh también falla para no bloquear fichas públicas", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-vencido",
        refresh: "refresh-vencido",
        user: {
          id: 1,
          email: "miembro@callejeros.ar",
          first_name: "Tomás",
          last_name: "Gómez",
          phone: "",
          is_phone_verified: true,
          photo: null,
          role: { code: "member", name: "Miembro" },
        },
      }),
    );

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Token vencido" }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Refresh vencido" }))
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    const pet = await fetchPetById(1);

    expect(pet.id).toBe(1);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBeUndefined();
  });

  it("propaga ApiError 404 cuando la mascota no existe", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { detail: "No encontrado." }),
    );

    try {
      await fetchPetById(999);
      throw new Error("Se esperaba un ApiError 404");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    }
  });
});

describe("fetchPets", () => {
  it("pide GET /api/pets/ sin parámetros y devuelve la página", async () => {
    const page = {
      count: 1,
      next: null,
      previous: null,
      results: [SAMPLE_PET],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, page));

    await expect(fetchPets()).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/pets/",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("manda solo los filtros con valor", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { count: 0, next: null, previous: null, results: [] }),
    );

    await fetchPets({
      species: "cat",
      urgent: true,
      page: 2,
      search: "",
      sex: undefined,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/pets/?species=cat&urgent=true&page=2",
      expect.anything(),
    );
  });

  it("lanza ApiError si la API falla", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, null));

    await expect(fetchPets()).rejects.toBeInstanceOf(ApiError);
  });
});
