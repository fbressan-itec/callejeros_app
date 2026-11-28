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

/** Cuenta que envió la solicitud (sin dirección ni teléfono privado). */
export interface AdoptionUserSummary {
  id: number;
  first_name: string;
  last_name: string;
  role: AuthRoleSummary;
}

/**
 * Solicitud con el cuestionario completo, como la recibe el panel de Staff en
 * `GET /api/adoption-requests/review-queue/`.
 */
export interface AdoptionRequestReview extends AdoptionRequestDetail {
  applicant: AdoptionUserSummary;
  // Bloque 1: Datos personales
  full_name: string;
  age: number;
  phone: string;
  email: string;
  address: string;
  city: string;
  // Bloque 2: Hogar y entorno
  housing_type: string;
  home_ownership: string;
  /** Vacío si la vivienda no es alquilada. */
  rental_allows_pets: string;
  outdoor_space: string;
  household_members: string;
  household_agreement: string;
  other_pets: string;
  // Bloque 3: Experiencia y rutina
  previous_pets: string;
  hours_alone: string;
  living_space: string;
  vacation_care: string;
  contingency_plan: string;
  adoption_reason: string;
  // Bloque 4: Compromiso
  accepts_commitment: boolean;
  /** `null` si la mascota ya estaba castrada (no se le pidió). */
  accepts_neutering: boolean | null;
  accepts_follow_up: boolean;
  accepts_return_notice: boolean;
  declares_truthful: boolean;
}
