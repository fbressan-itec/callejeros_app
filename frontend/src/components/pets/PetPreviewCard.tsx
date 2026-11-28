import Image from "next/image";
import Link from "next/link";

import { PetSociabilityTag } from "@/components/pets/PetSociabilityTag";
import { formatPetSummaryLine, getPetCoverPhotoUrl } from "@/lib/pets/format";
import type { PetListItem } from "@/lib/pets/types";

export interface PetPreviewCardProps {
  pet: PetListItem;
}

/**
 * Tarjeta de vista previa de una mascota del inicio ("Adoptá un Callejero" en index.html):
 * foto con la etiqueta de sociabilidad, nombre, "edad • castración", descripción en
 * 2 líneas y "Conocer a …" hacia la ficha. La del catálogo (FR-06) es otra: lleva
 * favorito y "Adoptar", pero reusa `PetSociabilityTag` y las funciones de `lib/pets/format`.
 */
export function PetPreviewCard({ pet }: PetPreviewCardProps) {
  const coverUrl = getPetCoverPhotoUrl(pet);

  return (
    <article className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 dark:border-slate-700/80 dark:bg-slate-800 dark:shadow-soft-dark">
      <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={pet.name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-slate-400">
            <span aria-hidden="true">🐾</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5">
          <PetSociabilityTag pet={pet} />
        </div>
      </div>
      <div className="flex grow flex-col justify-between p-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {pet.name}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatPetSummaryLine(pet)}
          </p>
          <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
            {pet.description}
          </p>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link
            href={`/mascotas/${pet.id}`}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-orange-700 px-3 text-center text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-800"
          >
            Conocer a {pet.name}
          </Link>
        </div>
      </div>
    </article>
  );
}
