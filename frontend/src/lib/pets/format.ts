/**
 * Textos cortos de una mascota para las tarjetas de listado (inicio y catálogo).
 * Reutilizables: el catálogo (FR-06, #24) usa las mismas funciones en su tarjeta.
 */
import { formatPetAge, resolvePetImageUrl } from "@/lib/pets/api";
import type { PetListItem } from "@/lib/pets/types";

export type PetSociabilityTone = "sociable" | "wild";

export interface PetSociabilityTag {
  label: "Sociable" | "Salvaje";
  tone: PetSociabilityTone;
}

/** Etiqueta de sociabilidad de la foto de la tarjeta ("Sociable" o "Salvaje", como el maquetado). */
export function getPetSociabilityTag(
  pet: Pick<PetListItem, "is_sociable">,
): PetSociabilityTag {
  return pet.is_sociable
    ? { label: "Sociable", tone: "sociable" }
    : { label: "Salvaje", tone: "wild" };
}

/** "Castrado", "Castrada" o "Sin castrar" (mismo criterio que la insignia del servidor). */
export function formatPetNeutered(
  pet: Pick<PetListItem, "is_neutered" | "sex">,
): string {
  if (!pet.is_neutered) return "Sin castrar";
  return pet.sex === "female" ? "Castrada" : "Castrado";
}

/**
 * Línea de resumen de la tarjeta: "2 Años • Castrado".
 * Si la fecha de nacimiento no es válida, muestra solo la castración.
 */
export function formatPetSummaryLine(
  pet: Pick<PetListItem, "estimated_birth_date" | "is_neutered" | "sex">,
  referenceDate: Date = new Date(),
): string {
  const age = formatPetAge(pet.estimated_birth_date, referenceDate);
  const neutered = formatPetNeutered(pet);
  return age ? `${age} • ${neutered}` : neutered;
}

/**
 * URL de la foto de portada: la de menor `position` (la primera del carrusel de la ficha),
 * ya resuelta contra el origen de la API. Devuelve `null` si no tiene fotos.
 */
export function getPetCoverPhotoUrl(
  pet: Pick<PetListItem, "photos">,
): string | null {
  const [cover] = [...pet.photos].sort(
    (a, b) => a.position - b.position || a.id - b.id,
  );
  if (!cover) return null;
  return resolvePetImageUrl(cover.image) || null;
}
