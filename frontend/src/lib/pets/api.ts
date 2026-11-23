import { ApiError, api, getApiUrl } from "@/lib/api/client";
import { getAuthHeaders, refreshAccessToken } from "@/lib/auth/session";
import type { PaginatedResponse } from "@/lib/api/pagination";
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

function parseIsoDateLocal(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function subtractCalendarYears(referenceDate: Date, years: number): Date {
  const targetYear = referenceDate.getFullYear() - years;
  const targetMonth = referenceDate.getMonth();
  const targetDay = referenceDate.getDate();
  const candidate = new Date(targetYear, targetMonth, targetDay);
  // Manejo del 29 de febrero en años no bisiestos (igual a backend/apps/pets/badges.py)
  if (candidate.getMonth() !== targetMonth) {
    return new Date(targetYear, targetMonth, 28);
  }
  return candidate;
}

/**
 * Formatea la edad legible en español a partir de `estimated_birth_date` (`YYYY-MM-DD`),
 * respetando exactamente las mismas reglas y mayúsculas que `backend/apps/pets/badges.py`.
 */
export function formatPetAge(
  estimatedBirthDate: string,
  referenceDate: Date = new Date(),
): string {
  const birth = parseIsoDateLocal(estimatedBirthDate);
  if (!birth) return "";

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  if (birth >= today) {
    return "Menos de 1 Mes";
  }

  const oneYearAgo = subtractCalendarYears(today, 1);
  if (birth <= oneYearAgo) {
    let years = today.getFullYear() - birth.getFullYear();
    if (birth > subtractCalendarYears(today, years)) {
      years -= 1;
    }
    return years === 1 ? "1 Año" : `${years} Años`;
  }

  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) {
    months -= 1;
  }

  if (months <= 0) return "Menos de 1 Mes";
  if (months === 1) return "1 Mes";
  return `${Math.min(months, 11)} Meses`;
}

/** Filtros del listado público `GET /api/pets/` (ver Swagger: `pets_list`). */
export type PetListParams = Record<
  string,
  string | number | boolean | undefined
>;

async function getWithOptionalAuth<T>(
  path: string,
  options: FetchPetOptions = {},
): Promise<T> {
  const authHeaders = getAuthHeaders();
  const hasAuth = Object.keys(authHeaders).length > 0;

  try {
    return await api.get<T>(path, {
      headers: authHeaders,
      signal: options.signal,
    });
  } catch (error) {
    if (hasAuth && error instanceof ApiError && error.status === 401) {
      const refreshedAccess = await refreshAccessToken();
      if (refreshedAccess) {
        return api.get<T>(path, {
          headers: { Authorization: `Bearer ${refreshedAccess}` },
          signal: options.signal,
        });
      }
      return api.get<T>(path, { signal: options.signal });
    }
    throw error;
  }
}

/**
 * Pide una página del listado público de mascotas (`GET /api/pets/`): solo publicadas
 * por defecto (o adoptadas con `adopted=true`), de a 12, con `count` = total de resultados.
 * Si hay sesión activa adjunta el token Bearer para recibir `is_favorite` y filtrar favoritos.
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
  return getWithOptionalAuth<PaginatedResponse<PetListItem>>(path, options);
}

/**
 * Obtiene la ficha completa de una mascota desde `GET /api/pets/{id}/`.
 * Si hay sesión activa adjunta el token Bearer para que el autor o Staff/Admin puedan
 * ver mascotas en revisión o rechazadas. Si el token venció (401), intenta renovarlo y,
 * si no puede, reintenta sin autorización para permitir la lectura de fichas públicas.
 */
export function fetchPetById(
  petId: number,
  options: FetchPetOptions = {},
): Promise<PetDetail> {
  return getWithOptionalAuth<PetDetail>(`pets/${petId}/`, options);
}
