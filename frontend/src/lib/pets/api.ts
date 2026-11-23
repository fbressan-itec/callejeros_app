import { api, getApiUrl } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/pagination";
import { requestWithAuth } from "@/lib/auth/session";
import type { PetDetail, PetListItem } from "@/lib/pets/types";

export interface FetchPetOptions {
  signal?: AbortSignal;
}

/**
 * Valida que el parámetro de ruta sea un ID numérico positivo de mascota.
 * Devuelve `null` para cadenas vacías, decimales, cero o textos no numéricos.
 */
export function parsePetId(rawId: string): number | null {
  const trimmed = rawId.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
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
 * Pide una página del listado público de mascotas (`GET /api/pets/`): solo publicadas,
 * de la más nueva a la más vieja, de a 12, con `count` = total de resultados.
 * Los parámetros vacíos (`undefined` o `""`) no se mandan.
 * Lo usa el inicio (FR-05) y lo puede reusar el catálogo (FR-06) pasando sus filtros.
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
  return api.get<PaginatedResponse<PetListItem>>(
    search ? `pets/?${search}` : "pets/",
    { signal: options.signal },
  );
}

/**
 * Obtiene la ficha completa de una mascota desde `GET /api/pets/{id}/`.
 * Reutiliza `requestWithAuth` para adjuntar el token Bearer si hay sesión activa
 * (permitiendo ver mascotas en revisión al autor/Staff/Admin) con fallback público
 * si la renovación del token falla.
 */
export async function fetchPetById(
  petId: number,
  options: FetchPetOptions = {},
): Promise<PetDetail> {
  const path = `pets/${petId}/`;
  return requestWithAuth(
    (headers) => api.get<PetDetail>(path, { headers, signal: options.signal }),
    { allowPublicFallback: true },
  );
}
