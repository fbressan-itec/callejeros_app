import type { AdoptionRequestPayload } from "@/lib/adoptions/questionnaire";
import { api } from "@/lib/api/client";
import { requestWithAuth } from "@/lib/auth/session";
import type {
  AdoptionRequestDetail,
  AdoptionRequestStatus,
} from "@/lib/adoptions/types";
import { FINAL_ADOPTION_REQUEST_STATUSES } from "@/lib/adoptions/types";

/** Ciudad que se agrega a la búsqueda del mapa si la dirección no la trae. */
const MAP_SEARCH_CITY = "Río Cuarto";

export interface FetchAdoptionRequestOptions {
  signal?: AbortSignal;
}

/**
 * Pide una solicitud de adopción a `GET /api/adoption-requests/{id}/`. Exige sesión:
 * solo la ve quien la envió (o Staff/Admin); para cualquier otra persona el back responde
 * `404`, sin revelar si existe.
 */
export function fetchAdoptionRequestById(
  requestId: number,
  options: FetchAdoptionRequestOptions = {},
): Promise<AdoptionRequestDetail> {
  return requestWithAuth((headers) =>
    api.get<AdoptionRequestDetail>(`adoption-requests/${requestId}/`, {
      headers,
      signal: options.signal,
    }),
  );
}

/**
 * Envía el cuestionario a `POST /api/adoption-requests/`. Exige sesión. Si el back lo
 * rechaza, lanza un `ApiError` con los errores por campo (`fieldErrors`) y, en `pet`,
 * los de la mascota: solicitud duplicada, mascota no disponible o publicada por la misma
 * persona.
 */
export function createAdoptionRequest(
  payload: AdoptionRequestPayload,
): Promise<AdoptionRequestDetail> {
  return requestWithAuth((headers) =>
    api.post<AdoptionRequestDetail>("adoption-requests/", payload, {
      headers,
    }),
  );
}

export function isFinalAdoptionRequestStatus(
  status: AdoptionRequestStatus,
): boolean {
  return FINAL_ADOPTION_REQUEST_STATUSES.includes(status);
}

/** Enlace `tel:` con solo los dígitos (y el `+` inicial, si lo tiene). */
export function buildTelHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/**
 * Enlace de búsqueda de Google Maps para la dirección pública del refugio.
 * Agrega ", Río Cuarto" salvo que la dirección ya lo diga.
 */
export function buildMapSearchUrl(address: string): string {
  const trimmed = address.trim();
  const query = trimmed
    .toLocaleLowerCase("es-AR")
    .includes(MAP_SEARCH_CITY.toLocaleLowerCase("es-AR"))
    ? trimmed
    : `${trimmed}, ${MAP_SEARCH_CITY}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Fecha corta en formato argentino ("24/11/2026"). */
export function formatAdoptionRequestDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR");
}
