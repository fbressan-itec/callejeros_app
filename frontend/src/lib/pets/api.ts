import { api, getApiUrl } from "@/lib/api/client";
import { parsePositiveId } from "@/lib/api/ids";
import type { PaginatedResponse } from "@/lib/api/pagination";
import { requestWithAuth } from "@/lib/auth/session";
import type {
  PetCompatibility,
  PetDetail,
  PetListItem,
  PetPhoto,
  PetSex,
  PetSpecies,
  PetStatus,
} from "@/lib/pets/types";

export interface FetchPetOptions {
  signal?: AbortSignal;
}

/**
 * Valida que el parámetro de ruta sea un ID numérico positivo de mascota.
 * Devuelve `null` para cadenas vacías, decimales, cero o textos no numéricos.
 */
export function parsePetId(rawId: string): number | null {
  return parsePositiveId(rawId);
}

/**
 * Normaliza la URL de una foto de mascota: si el servidor devuelve una ruta relativa
 * (por ejemplo `/media/pets/foto.jpg`), la resuelve contra el origen de `NEXT_PUBLIC_API_URL`.
 */
export function resolvePetImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const apiOrigin = new URL(getApiUrl()).origin;
    const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${apiOrigin}${normalizedPath}`;
  } catch {
    return trimmed;
  }
}

/** Filtros del listado público `GET /api/pets/` (ver Swagger: `pets_list`). */
export type PetListParams = Record<
  string,
  string | number | boolean | undefined
>;

/**
 * Pide una página del listado público de mascotas (`GET /api/pets/`): solo publicadas
 * por defecto (o adoptadas con `adopted=true`), de a 12, con `count` = total de resultados.
 * Reutiliza `requestWithAuth` para adjuntar el token Bearer si hay sesión activa
 * (recibiendo `is_favorite` y permitiendo `?favorites=true`) con fallback público.
 * Los parámetros vacíos (`undefined` o `""`) no se mandan.
 */
export function fetchPets(
  params: PetListParams = {},
  options: FetchPetOptions = {},
): Promise<PaginatedResponse<PetListItem>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }
  const search = query.toString();
  const path = search ? `pets/?${search}` : "pets/";
  return requestWithAuth(
    (headers) =>
      api.get<PaginatedResponse<PetListItem>>(path, {
        headers,
        signal: options.signal,
      }),
    { allowPublicFallback: true },
  );
}

/**
 * Obtiene la ficha completa de una mascota desde `GET /api/pets/{id}/`.
 * Reutiliza `requestWithAuth` para adjuntar el token Bearer si hay sesión activa
 * (permitiendo ver mascotas en revisión al autor/Staff/Admin) con fallback público
 * si la renovación del token falla.
 */
export function fetchPetById(
  petId: number,
  options: FetchPetOptions = {},
): Promise<PetDetail> {
  const path = `pets/${petId}/`;
  return requestWithAuth(
    (headers) => api.get<PetDetail>(path, { headers, signal: options.signal }),
    { allowPublicFallback: true },
  );
}

/**
 * Publica una mascota en adopción enviando datos y fotos (`POST /api/pets/`).
 * Requiere sesión activa (renueva el token Bearer una vez ante `401`).
 */
export function createPet(
  formData: FormData,
  options: FetchPetOptions = {},
): Promise<PetDetail> {
  return requestWithAuth((headers) =>
    api.post<PetDetail>("pets/", formData, {
      headers,
      signal: options.signal,
    }),
  );
}

export interface MyPetsParams {
  status?: PetStatus;
  page?: number;
}

/**
 * Pide una página de las publicaciones propias del usuario autenticado (`GET /api/pets/mine/`),
 * con filtro opcional por estado (`in_review`, `published`, `rejected` o `adopted`).
 */
export function fetchMyPets(
  params: MyPetsParams = {},
  options: FetchPetOptions = {},
): Promise<PaginatedResponse<PetDetail>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const search = query.toString();
  const path = search ? `pets/mine/?${search}` : "pets/mine/";
  return requestWithAuth((headers) =>
    api.get<PaginatedResponse<PetDetail>>(path, {
      headers,
      signal: options.signal,
    }),
  );
}

/**
 * Marca una mascota publicada como adoptada (`POST /api/pets/{id}/adopt/`).
 */
export function adoptPet(
  petId: number,
  note = "",
  options: FetchPetOptions = {},
): Promise<PetDetail> {
  return requestWithAuth((headers) =>
    api.post<PetDetail>(
      `pets/${petId}/adopt/`,
      { note: note.trim() },
      { headers, signal: options.signal },
    ),
  );
}

/**
 * Da de baja lógica una publicación de mascota (`DELETE /api/pets/{id}/`).
 */
export function deactivatePet(
  petId: number,
  options: FetchPetOptions = {},
): Promise<void> {
  return requestWithAuth((headers) =>
    api.delete<void>(`pets/${petId}/`, {
      headers,
      signal: options.signal,
    }),
  );
}

export interface PetUpdatePayload {
  name?: string;
  species?: PetSpecies;
  sex?: PetSex;
  estimated_birth_date?: string;
  is_sociable?: boolean;
  good_with_children?: PetCompatibility;
  good_with_animals?: PetCompatibility;
  is_neutered?: boolean;
  is_urgent_requested?: boolean;
  special_care?: string;
  description?: string;
  contact_phone?: string;
}

/**
 * Actualiza los datos editables de una publicación (`PATCH /api/pets/{id}/`).
 * Si el autor (no Staff/Admin) edita una mascota `published`, el back la pasa a `in_review`.
 */
export function updatePet(
  petId: number,
  payload: PetUpdatePayload,
  options: FetchPetOptions = {},
): Promise<PetDetail> {
  return requestWithAuth((headers) =>
    api.patch<PetDetail>(`pets/${petId}/`, payload, {
      headers,
      signal: options.signal,
    }),
  );
}

/**
 * Sube una nueva foto al carrusel de la mascota (`POST /api/pets/{id}/photos/`).
 */
export function addPetPhoto(
  petId: number,
  image: File,
  options: FetchPetOptions = {},
): Promise<PetPhoto> {
  const formData = new FormData();
  formData.append("image", image);
  return requestWithAuth((headers) =>
    api.post<PetPhoto>(`pets/${petId}/photos/`, formData, {
      headers,
      signal: options.signal,
    }),
  );
}

/**
 * Da de baja lógica una foto del carrusel (`DELETE /api/pets/{id}/photos/{photo_id}/`).
 */
export function deletePetPhoto(
  petId: number,
  photoId: number,
  options: FetchPetOptions = {},
): Promise<void> {
  return requestWithAuth((headers) =>
    api.delete<void>(`pets/${petId}/photos/${photoId}/`, {
      headers,
      signal: options.signal,
    }),
  );
}
