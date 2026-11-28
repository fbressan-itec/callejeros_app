import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { AUTH_SESSION_STORAGE_KEY } from "@/lib/auth/session";
import {
  addPetFavorite,
  addPetPhoto,
  adoptPet,
  createPet,
  deactivatePet,
  deletePetPhoto,
  fetchMyPets,
  fetchPetById,
  fetchPets,
  parsePetId,
  removePetFavorite,
  resolvePetImageUrl,
  updatePet,
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
  age_label: "2 Años",
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

  it("envía el token Bearer en el catálogo cuando hay sesión activa", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-catalogo",
        refresh: "refresh-catalogo",
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
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        count: 1,
        next: null,
        previous: null,
        results: [SAMPLE_PET],
      }),
    );

    await fetchPets({ favorites: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/?favorites=true");
    expect(init.headers.Authorization).toBe("Bearer token-catalogo");
  });

  it("renueva el token si el catálogo responde 401 y reintenta con el nuevo acceso", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-vencido",
        refresh: "refresh-valido",
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
      .mockResolvedValueOnce(jsonResponse(200, { access: "token-renovado" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          count: 1,
          next: null,
          previous: null,
          results: [SAMPLE_PET],
        }),
      );

    const page = await fetchPets();

    expect(page.results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer token-renovado",
    );
  });
});

describe("createPet", () => {
  it("envía FormData a POST /api/pets/ con token Bearer y sin fijar Content-Type", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-publicar",
        refresh: "refresh-publicar",
        user: {
          id: 1,
          email: "miembro@callejeros.ar",
          first_name: "Tomás",
          last_name: "Gómez",
          phone: "3584123456",
          is_phone_verified: true,
          photo: null,
          role: { code: "member", name: "Miembro" },
        },
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { ...SAMPLE_PET, status: "in_review" }),
    );

    const formData = new FormData();
    formData.append("name", "Manchitas");

    const created = await createPet(formData);

    expect(created.status).toBe("in_review");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-publicar");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(formData);
  });

  it("renueva el token Bearer si POST /api/pets/ responde 401 y reintenta", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access: "token-vencido",
        refresh: "refresh-valido",
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
      .mockResolvedValueOnce(jsonResponse(200, { access: "token-nuevo" }))
      .mockResolvedValueOnce(
        jsonResponse(201, { ...SAMPLE_PET, status: "in_review" }),
      );

    const formData = new FormData();
    formData.append("name", "Manchitas");

    const created = await createPet(formData);

    expect(created.status).toBe("in_review");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer token-nuevo",
    );
  });
});

describe("fetchMyPets, adoptPet y deactivatePet", () => {
  function storeMemberSession(access = "token-mio") {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        access,
        refresh: "refresh-mio",
        user: {
          id: 1,
          email: "miembro@callejeros.ar",
          first_name: "Tomás",
          last_name: "Gómez",
          phone: "3584123456",
          is_phone_verified: true,
          photo: null,
          role: { code: "member", name: "Miembro" },
        },
      }),
    );
  }

  it("fetchMyPets pide GET /api/pets/mine/ con filtros opcionales de estado y página", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        count: 1,
        next: null,
        previous: null,
        results: [SAMPLE_PET],
      }),
    );

    const page = await fetchMyPets({ status: "published", page: 2 });

    expect(page.results).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/mine/?status=published&page=2");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
  });

  it("adoptPet envía POST /api/pets/{id}/adopt/ con la nota recortada", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ...SAMPLE_PET, status: "adopted" }),
    );

    const adopted = await adoptPet(1, "  Adoptado por familia de Alberdi  ");

    expect(adopted.status).toBe("adopted");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/adopt/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
    expect(init.body).toBe(
      JSON.stringify({ note: "Adoptado por familia de Alberdi" }),
    );
  });

  it("deactivatePet envía DELETE /api/pets/{id}/ con token Bearer", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deactivatePet(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
  });

  it("updatePet envía PATCH /api/pets/{id}/ con JSON y token Bearer", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ...SAMPLE_PET,
        name: "Loki Editado",
        status: "in_review",
      }),
    );

    const updated = await updatePet(1, { name: "Loki Editado" });

    expect(updated.name).toBe("Loki Editado");
    expect(updated.status).toBe("in_review");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
    expect(init.body).toBe(JSON.stringify({ name: "Loki Editado" }));
  });

  it("addPetPhoto envía FormData a POST /api/pets/{id}/photos/ sin fijar Content-Type", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        id: 22,
        image: "/media/pets/loki-2.jpg",
        position: 1,
        created_at: "2026-11-26T12:00:00Z",
      }),
    );

    const file = new File(["jpg"], "loki-2.jpg", { type: "image/jpeg" });
    const photo = await addPetPhoto(1, file);

    expect(photo.id).toBe(22);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/photos/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
  });

  it("deletePetPhoto envía DELETE /api/pets/{id}/photos/{photo_id}/ con token Bearer", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deletePetPhoto(1, 22);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/photos/22/");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
  });

  it("addPetFavorite envía POST /api/pets/{id}/favorite/ con token Bearer", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { pet_id: 1, is_favorite: true }),
    );

    const result = await addPetFavorite(1);

    expect(result).toEqual({ pet_id: 1, is_favorite: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/favorite/");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
  });

  it("removePetFavorite envía DELETE /api/pets/{id}/favorite/ con token Bearer", async () => {
    storeMemberSession();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await removePetFavorite(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/pets/1/favorite/");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer token-mio");
  });
});
