import { getPetSociabilityTag } from "@/lib/pets/format";
import type { PetListItem } from "@/lib/pets/types";

/*
 * Etiqueta "Sociable" / "Salvaje" que va arriba a la izquierda de la foto en las tarjetas
 * de listado. Reutilizable: la usan el inicio (FR-05) y el catálogo (FR-06, #24).
 * Colores de 02-diseno.md: verde `emerald-700` con texto blanco para "sí / sociable" y
 * ámbar con texto oscuro para "no / salvaje" (el maquetado usaba emerald-600 y red-500,
 * que no llegan al contraste AA con texto de 11px).
 */
const TONE_CLASSES = {
  sociable: "bg-emerald-700 text-white",
  wild: "bg-amber-500 text-amber-950",
} as const;

export interface PetSociabilityTagProps {
  pet: Pick<PetListItem, "is_sociable">;
}

export function PetSociabilityTag({ pet }: PetSociabilityTagProps) {
  const tag = getPetSociabilityTag(pet);
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold shadow-md ${TONE_CLASSES[tag.tone]}`}
    >
      {tag.label}
    </span>
  );
}
