import type { UserRoleCode } from "@/components/layout/MobileMenu";

export type PetSpecies = "dog" | "cat";
export type PetSex = "male" | "female";
export type PetAgeGroup = "cachorro" | "adulto" | "senior";
export type PetCompatibility = "yes" | "no" | "not_evaluated";
export type PetStatus = "in_review" | "published" | "rejected" | "adopted";

export type PetBadgeKey =
  | "adopted"
  | "urgent"
  | "species"
  | "sex"
  | "age"
  | "sociability"
  | "children"
  | "animals"
  | "neutered"
  | "special_care";

export type PetBadgeTone =
  | "neutral"
  | "sky"
  | "pink"
  | "orange"
  | "green"
  | "amber"
  | "gray"
  | "blue"
  | "urgent";

export type PetBadgeIcon =
  | "adopted"
  | "urgent"
  | "dog"
  | "cat"
  | "male"
  | "female"
  | "age_cachorro"
  | "age_adulto"
  | "age_senior"
  | "sociable"
  | "wild"
  | "children"
  | "animals"
  | "neutered"
  | "not_neutered"
  | "health";

export interface PetBadge {
  key: PetBadgeKey;
  tone: PetBadgeTone;
  icon: PetBadgeIcon;
  text: string;
}

export interface PetPhoto {
  id: number;
  image: string;
  position: number;
  created_at: string;
}

export interface PetHealth {
  general_status: string;
  vaccines: string;
  deworming: string;
  flea_tick_treatment: string;
  other: string;
}

export interface PetPublisher {
  id: number;
  first_name: string;
  last_name: string;
  role: {
    code: UserRoleCode;
    name: string;
  };
}

export interface PetDetail {
  id: number;
  name: string;
  species: PetSpecies;
  sex: PetSex;
  estimated_birth_date: string;
  age_group: PetAgeGroup;
  is_sociable: boolean;
  good_with_children: PetCompatibility;
  good_with_animals: PetCompatibility;
  is_neutered: boolean;
  is_urgent: boolean;
  /** `true` si la persona con sesión la marcó como favorita (siempre `false` sin sesión). */
  is_favorite?: boolean;
  is_urgent_requested?: boolean;
  is_urgent_validated?: boolean;
  special_care: string;
  description: string;
  notes: string;
  contact_phone?: string;
  status: PetStatus;
  published_by: PetPublisher;
  health: PetHealth | null;
  badges: PetBadge[];
  photos: PetPhoto[];
  /** Cantidad de padrinos activos (se completa desde el back en BK-11). */
  sponsors_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Mascota tal como la devuelve el listado `GET /api/pets/` (mismo serializer que la ficha).
 * La usan el inicio (FR-05) y el catálogo (FR-06).
 */
export type PetListItem = PetDetail;

export const PET_AGE_GROUP_LABELS: Record<PetAgeGroup, string> = {
  cachorro: "Cachorro",
  adulto: "Adulto",
  senior: "Senior",
};
