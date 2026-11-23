import Image from "next/image";
import Link from "next/link";

import { PetSociabilityTag } from "@/components/pets/PetSociabilityTag";
import { formatPetAge } from "@/lib/pets/api";
import { formatPetSummaryLine, getPetCoverPhotoUrl } from "@/lib/pets/format";
import type { PetListItem, PetSex } from "@/lib/pets/types";

const SEX_LABELS: Record<PetSex, string> = {
  male: "Macho",
  female: "Hembra",
};

export interface PetCardProps {
  pet: PetListItem;
  onToggleFavorite?: (pet: PetListItem) => void;
  isFavoriteBusy?: boolean;
}

/**
 * Tarjeta de mascota del catálogo de adopción (`adopciones.html`).
 * Reutiliza `PetSociabilityTag` y los formateadores de `lib/pets/format`
 * con contraste WCAG AA y los 5 estados interactivos.
 */
export function PetCard({
  pet,
  onToggleFavorite,
  isFavoriteBusy = false,
}: PetCardProps) {
  const coverUrl = getPetCoverPhotoUrl(pet);
  const ageText = formatPetAge(pet.estimated_birth_date);
  const imageAlt = ageText
    ? `Foto de ${pet.name}, ${ageText}`
    : `Foto de ${pet.name}`;
  const isFavorite = Boolean(pet.is_favorite);
  const isAdopted = pet.status === "adopted";
  const detailHref = `/mascotas/${pet.id}`;

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/80 dark:bg-slate-800 dark:shadow-soft-dark">
      {/* Foto y badges superiores */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-100 sm:h-52 dark:bg-slate-900">
        <Link
          href={detailHref}
          aria-label={`Ver ficha de ${pet.name}`}
          className="block h-full w-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset"
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={imageAlt}
              fill
              unoptimized
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-slate-400">
              <span aria-hidden="true">🐾</span>
            </div>
          )}
        </Link>

        {/* Badges superiores izquierdos (Sociabilidad + Adoptada o Caso Urgente) */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          <PetSociabilityTag pet={pet} />
          {isAdopted ? (
            <span className="flex items-center gap-1 rounded-md bg-orange-700 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md">
              ¡Ya encontró hogar! 🧡
            </span>
          ) : pet.is_urgent ? (
            <span className="flex animate-pulse items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md motion-reduce:animate-none">
              🚨 Caso Urgente
            </span>
          ) : null}
        </div>

        {/* Botón Favorito (44x44px, latido en estado activo) */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            disabled={isFavoriteBusy}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? `Quitar a ${pet.name} de favoritos`
                : `Guardar a ${pet.name} en favoritos`
            }
            onClick={() => onToggleFavorite?.(pet)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition-transform hover:bg-white hover:text-red-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-125 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/90 dark:text-white dark:hover:bg-slate-900 dark:hover:text-red-400 dark:focus-visible:ring-offset-slate-900"
          >
            <svg
              className={`h-4 w-4 transition-colors ${
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "fill-none text-slate-900 dark:text-white"
              }`}
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Metadatos y acción principal */}
      <div className="flex grow flex-col justify-between bg-white p-3.5 sm:p-4 dark:bg-slate-850">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-white">
              <Link
                href={detailHref}
                className="rounded-sm hover:text-orange-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:text-orange-400"
              >
                {pet.name}
              </Link>
            </h3>
            <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
              {SEX_LABELS[pet.sex]}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {formatPetSummaryLine(pet)}
          </p>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          <Link
            href={detailHref}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-orange-700 px-3 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-850"
          >
            <span>{isAdopted ? "Ver historia" : "Adoptar"}</span>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
