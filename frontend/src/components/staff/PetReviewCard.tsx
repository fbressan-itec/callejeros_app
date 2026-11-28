import Image from "next/image";
import type { ReactNode } from "react";

import {
  CoexistRow,
  formatAgeDisplay,
  InfoRow,
} from "@/components/pets/PetInfoAccordions";
import { RoleBadge } from "@/components/users/RoleBadge";
import { buildTelHref, formatAdoptionRequestDate } from "@/lib/adoptions/api";
import { resolvePetImageUrl } from "@/lib/pets/api";
import {
  formatPetNeutered,
  formatPetSummaryLine,
  getPetCoverPhotoUrl,
  getPetHealthRows,
} from "@/lib/pets/format";
import { getPublisherName } from "@/lib/pets/review";
import type { PetReviewItem } from "@/lib/pets/types";

const SPECIES_LABELS = { dog: "🐶 Perro", cat: "🐱 Gato" } as const;
const SEX_LABELS = { male: "Macho", female: "Hembra" } as const;
const SECTION_TITLE_CLASSES =
  "text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400";

export interface PetReviewCardProps {
  pet: PetReviewItem;
  /** Control del caso urgente (si lo pidió). */
  urgency?: ReactNode;
  /** Botones para aprobar o rechazar. */
  children?: ReactNode;
}

/** Ficha de gestión de una mascota en revisión: lo que Staff necesita para decidir. */
export function PetReviewCard({ pet, urgency, children }: PetReviewCardProps) {
  const coverUrl = getPetCoverPhotoUrl(pet);
  const photos = [...pet.photos].sort(
    (a, b) => a.position - b.position || a.id - b.id,
  );
  const healthRows = getPetHealthRows(pet);
  const phone = pet.contact_phone.trim();
  const titleId = `mascota-${pet.id}-titulo`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center gap-4">
        {coverUrl ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
            <Image
              src={coverUrl}
              alt={`Foto de ${pet.name}`}
              fill
              unoptimized
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-2xl dark:bg-orange-950/60"
          >
            🐾
          </div>
        )}
        <div className="min-w-0">
          <span className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Publicación en revisión
          </span>
          <h2
            id={titleId}
            className="truncate font-display text-lg font-bold text-slate-900 dark:text-white"
          >
            {pet.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {SPECIES_LABELS[pet.species]} • {SEX_LABELS[pet.sex]} •{" "}
            {formatPetSummaryLine(pet)}
          </p>
        </div>
      </div>

      {urgency}

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Publicada por
          </dt>
          <dd className="flex flex-wrap items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            {getPublisherName(pet)}
            <RoleBadge role={pet.published_by.role.code} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Teléfono de contacto
          </dt>
          <dd className="font-bold text-slate-800 dark:text-slate-100">
            {phone ? (
              <a
                href={buildTelHref(phone)}
                className="inline-flex min-h-[44px] items-center rounded-sm font-mono text-orange-700 underline underline-offset-2 hover:text-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-orange-400"
              >
                {phone}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Enviada el
          </dt>
          <dd className="font-bold text-slate-800 dark:text-slate-100">
            {formatAdoptionRequestDate(pet.created_at)}
          </dd>
        </div>
      </dl>

      <details className="group rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-850">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-slate-200">
          Ver ficha completa
          <svg
            className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="flex flex-col gap-5 px-4 pt-1 pb-5 text-sm text-slate-700 dark:text-slate-200">
          {photos.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className={SECTION_TITLE_CLASSES}>Fotos ({photos.length})</h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((photo, index) => {
                  const url = resolvePetImageUrl(photo.image);
                  if (!url) return null;
                  return (
                    <li
                      key={photo.id}
                      className="relative aspect-square overflow-hidden rounded-xl"
                    >
                      <Image
                        src={url}
                        alt={`Foto ${index + 1} de ${pet.name}`}
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 160px, 33vw"
                        className="object-cover"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-1">
            <h3 className={SECTION_TITLE_CLASSES}>Descripción</h3>
            <p className="pb-2 leading-relaxed whitespace-pre-line">
              {pet.description}
            </p>
            <InfoRow label="Edad" value={formatAgeDisplay(pet)} />
            <InfoRow label="Sexo" value={SEX_LABELS[pet.sex]} />
            <InfoRow label="Castración" value={formatPetNeutered(pet)} />
            <InfoRow
              label="Sociabilidad"
              value={pet.is_sociable ? "Sociable" : "Salvaje"}
            />
            <CoexistRow label="Con niños" value={pet.good_with_children} />
            <CoexistRow
              label="Con otros animales"
              value={pet.good_with_animals}
            />
          </section>

          <section className="flex flex-col gap-1">
            <h3 className={SECTION_TITLE_CLASSES}>Estado de salud</h3>
            {healthRows.length > 0 ? (
              healthRows.map((row) => (
                <InfoRow key={row.label} label={row.label} value={row.value} />
              ))
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Sin información cargada.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-1">
            <h3 className={SECTION_TITLE_CLASSES}>Notas</h3>
            <p className="leading-relaxed whitespace-pre-line">
              {pet.notes.trim() || "Sin notas."}
            </p>
          </section>
        </div>
      </details>

      {children}
    </article>
  );
}
