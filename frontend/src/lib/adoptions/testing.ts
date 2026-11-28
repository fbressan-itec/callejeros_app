import type { AdoptionRequestReview } from "@/lib/adoptions/types";

/**
 * Solicitud pendiente de ejemplo para tests (forma de la cola del panel de Staff).
 * Se pisa lo que haga falta: `buildAdoptionRequestReview({ home_ownership: "rented" })`.
 */
export function buildAdoptionRequestReview(
  overrides: Partial<AdoptionRequestReview> = {},
): AdoptionRequestReview {
  return {
    id: 7,
    pet: {
      id: 3,
      name: "Loki",
      species: "dog",
      sex: "male",
      status: "published",
      main_photo: null,
    },
    applicant: {
      id: 5,
      first_name: "Sofía",
      last_name: "Gómez",
      role: { code: "member", name: "Miembro" },
    },
    full_name: "Sofía Gómez",
    age: 29,
    phone: "358 4111111",
    email: "sofia@example.com",
    address: "Belgrano 123",
    city: "Río Cuarto",
    housing_type: "Casa con patio",
    home_ownership: "owned",
    rental_allows_pets: "",
    outdoor_space: "Patio con cerco de 1,80 m.",
    household_members: "Mi pareja y yo.",
    household_agreement: "yes",
    other_pets: "Una gata castrada.",
    previous_pets: "Tuve un perro durante 12 años.",
    hours_alone: "4_to_8",
    living_space: "Adentro de la casa.",
    vacation_care: "Mi hermana.",
    contingency_plan: "Me lo llevo conmigo.",
    adoption_reason: "",
    accepts_commitment: true,
    accepts_neutering: null,
    accepts_follow_up: true,
    accepts_return_notice: true,
    declares_truthful: true,
    status: "pending",
    rejection_reason: "",
    foster_contact: null,
    reviewed_at: null,
    created_at: "2026-11-20T15:00:00Z",
    updated_at: "2026-11-20T15:00:00Z",
    ...overrides,
  };
}
