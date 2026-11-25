"use client";

import Image from "next/image";
import Link from "next/link";

import { PetSociabilityTag } from "@/components/pets/PetSociabilityTag";
import { formatPetSummaryLine, getPetCoverPhotoUrl } from "@/lib/pets/format";
import type { PetDetail, PetStatus } from "@/lib/pets/types";

const STATUS_BADGE_STYLES: Record<
  PetStatus,
  { label: string; className: string }
> = {
  in_review: {
    label: "En revisión",
    className:
      "bg-amber-200 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200",
  },
  published: {
    label: "Publicada",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
  adopted: {
    label: "¡Ya encontró hogar! 🧡",
    className:
      "bg-orange-100 text-orange-900 dark:bg-orange-950/70 dark:text-orange-200",
  },
  rejected: {
    label: "Rechazada",
    className: "bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-200",
  },
};

export interface MyPetCardProps {
  pet: PetDetail;
  onRequestAdopt: (pet: PetDetail) => void;
  onRequestDeactivate: (pet: PetDetail) => void;
}

export function MyPetCard({
  pet,
  onRequestAdopt,
  onRequestDeactivate,
}: MyPetCardProps) {
  const coverUrl = getPetCoverPhotoUrl(pet);
  const summaryLine = formatPetSummaryLine(pet);
  const statusInfo = STATUS_BADGE_STYLES[pet.status];
  const sexLabel = pet.sex === "female" ? "Hembra" : "Macho";

  return (
    <article className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft transition-all dark:border-slate-700/80 dark:bg-slate-800 dark:shadow-soft-dark">
      <div>
        <div className="relative h-44 w-full overflow-hidden bg-slate-100 sm:h-48 dark:bg-slate-900">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`Foto de ${pet.name}`}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl text-slate-400 dark:text-slate-600"
              aria-hidden="true"
            >
              🐾
            </div>
          )}

          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
            <PetSociabilityTag pet={pet} />
            {pet.is_urgent ? (
              <span className="flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md">
                🚨 Caso Urgente
              </span>
            ) : null}
          </div>

          <div className="absolute top-2.5 right-2.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shadow-xs ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-display text-lg font-bold text-slate-900 dark:text-white">
              {pet.name}
            </h2>
            <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
              {sexLabel}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            {summaryLine}
          </p>

          {pet.is_urgent_requested &&
          !pet.is_urgent &&
          pet.status !== "adopted" &&
          pet.status !== "rejected" ? (
            <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
              Caso urgente solicitado (pendiente de validación de Staff).
            </p>
          ) : null}

          {pet.status === "rejected" ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <p className="font-semibold">
                Esta publicación fue rechazada y no se puede editar.
              </p>
              <p className="mt-1 text-[11px] text-red-800 dark:text-red-300">
                Para volver a intentarlo, cargá una nueva publicación.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 p-4 pt-3 dark:border-slate-700/80">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/mascotas/${pet.id}`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
          >
            Ver ficha
          </Link>

          {pet.status === "rejected" ? (
            <Link
              href="/adopciones/publicar"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-orange-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
            >
              Cargar nueva
            </Link>
          ) : null}

          {pet.status === "published" ? (
            <button
              type="button"
              onClick={() => onRequestAdopt(pet)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
            >
              Marcar adoptada
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onRequestDeactivate(pet)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40 dark:focus-visible:ring-offset-slate-900"
        >
          Dar de baja
        </button>
      </div>
    </article>
  );
}
