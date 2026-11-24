import type { PetListItem, PetReviewItem } from "@/lib/pets/types";

/**
 * Mascota de ejemplo para tests (forma del listado `GET /api/pets/`).
 * Se pisa lo que haga falta: `buildPet({ name: "Luna", sex: "female" })`.
 */
export function buildPet(overrides: Partial<PetListItem> = {}): PetListItem {
  return {
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
    is_favorite: false,
    special_care: "",
    description:
      "Rescatado en barrio Alberdi. Es juguetón, muy cariñoso y listo para un hogar.",
    notes: "",
    status: "published",
    published_by: {
      id: 2,
      first_name: "Refugio",
      last_name: "Patitas",
      role: { code: "verified_shelter", name: "Refugio verificado" },
    },
    health: null,
    badges: [],
    photos: [
      {
        id: 10,
        image: "/media/pets/loki-1.jpg",
        position: 0,
        created_at: "2026-11-20T12:00:00Z",
      },
    ],
    created_at: "2026-11-20T12:00:00Z",
    updated_at: "2026-11-20T12:00:00Z",
    ...overrides,
  };
}

/**
 * Mascota en revisión de ejemplo para tests del panel de Staff (ficha de gestión).
 * Se pisa lo que haga falta: `buildPetReviewItem({ is_urgent_requested: true })`.
 */
export function buildPetReviewItem(
  overrides: Partial<PetReviewItem> = {},
): PetReviewItem {
  return {
    ...buildPet({ status: "in_review" }),
    contact_phone: "358 4222222",
    is_urgent_requested: false,
    is_urgent_validated: false,
    ...overrides,
  };
}
