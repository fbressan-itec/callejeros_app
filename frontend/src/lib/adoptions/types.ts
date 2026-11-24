import type { AuthRoleSummary } from "@/lib/auth/session";
import type { PetSex, PetSpecies, PetStatus } from "@/lib/pets/types";

export type AdoptionRequestStatus = "pending" | "approved" | "rejected";

/** Estados en los que la solicitud ya no cambia: se deja de volver a consultar. */
export const FINAL_ADOPTION_REQUEST_STATUSES: readonly AdoptionRequestStatus[] =
  ["approved", "rejected"];

export interface AdoptionPetSummary {
  id: number;
  name: string;
  species: PetSpecies;
  sex: PetSex;
  status: PetStatus;
  main_photo: string | null;
}

/**
 * Contacto de quien publicó la mascota. Solo llega con la solicitud `approved`;
 * `shelter_public_address` tiene valor solo si es un refugio verificado que la cargó.
 */
export interface FosterContact {
  name: string;
  role: AuthRoleSummary;
  contact_phone: string;
  shelter_public_address: string | null;
}

/**
 * Respuesta de `GET /api/adoption-requests/{id}/` con lo que usa la página de la solicitud
 * (el cuestionario completo también llega, pero la página no lo muestra).
 */
export interface AdoptionRequestDetail {
  id: number;
  pet: AdoptionPetSummary;
  status: AdoptionRequestStatus;
  rejection_reason: string;
  foster_contact: FosterContact | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
