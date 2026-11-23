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
