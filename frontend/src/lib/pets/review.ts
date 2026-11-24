import { z } from "zod";

import { api } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/pagination";
import { requestWithAuth } from "@/lib/auth/session";
import type { PetDetail, PetReviewItem } from "@/lib/pets/types";

/**
 * Revisión de publicaciones de mascotas en el panel de Staff (`producto/03-reglas-de-negocio.md`,
 * "Publicar una mascota en adopción"). Los textos por defecto y el largo de la nota son los
 * del back (`backend/apps/pets/services.py` y `serializers.py`).
 */

export const MAX_PET_REVIEW_NOTE_LENGTH = 255;

/** Motivo que guarda el back si se rechaza sin escribir uno. */
export const DEFAULT_PET_REJECTION_NOTE =
  "Tu publicación no fue aprobada porque no cumple con las pautas de Callejeros Río Cuarto.";

export const petReviewNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .max(
      MAX_PET_REVIEW_NOTE_LENGTH,
      `La nota no puede superar los ${MAX_PET_REVIEW_NOTE_LENGTH} caracteres.`,
    ),
});

export type PetReviewNoteValues = z.infer<typeof petReviewNoteSchema>;

export interface FetchPetReviewQueueOptions {
  page?: number;
  signal?: AbortSignal;
}

/**
 * Pide la cola del panel de Staff a `GET /api/pets/review-queue/`: mascotas en revisión de
 * a 12, primero las que pidieron caso urgente y, dentro de cada grupo, de la más vieja a la
 * más nueva. Solo Staff y Admin (`403` si no).
 */
export function fetchPetReviewQueue(
  options: FetchPetReviewQueueOptions = {},
): Promise<PaginatedResponse<PetReviewItem>> {
  const { page = 1, signal } = options;
  const query = page > 1 ? `?page=${page}` : "";
  return requestWithAuth((headers) =>
    api.get<PaginatedResponse<PetReviewItem>>(`pets/review-queue/${query}`, {
      headers,
      signal,
    }),
  );
}

/** Aprueba una mascota en revisión: pasa al catálogo. La nota es opcional. */
export function approvePet(petId: number, note = ""): Promise<PetReviewItem> {
  return requestWithAuth((headers) =>
    api.post<PetReviewItem>(`pets/${petId}/approve/`, { note }, { headers }),
  );
}

/** Rechaza una mascota en revisión (es final). Sin nota, el back guarda el motivo genérico. */
export function rejectPet(petId: number, note = ""): Promise<PetReviewItem> {
  return requestWithAuth((headers) =>
    api.post<PetReviewItem>(`pets/${petId}/reject/`, { note }, { headers }),
  );
}

/** Valida (`true`) o quita la validación (`false`) del caso urgente que pidió quien publicó. */
export function setPetUrgency(
  petId: number,
  validated: boolean,
): Promise<PetReviewItem> {
  return requestWithAuth((headers) =>
    api.post<PetReviewItem>(
      `pets/${petId}/urgency/`,
      { validated },
      { headers },
    ),
  );
}

/** Nombre de quien publicó ("Refugio Patitas"); si no tiene, "quien la publicó". */
export function getPublisherName(pet: Pick<PetDetail, "published_by">): string {
  const { first_name, last_name } = pet.published_by;
  return [first_name, last_name].join(" ").trim() || "quien la publicó";
}
