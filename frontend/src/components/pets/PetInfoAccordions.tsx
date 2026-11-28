"use client";

import type { ReactNode, RefObject } from "react";

import { getPetHealthRows } from "@/lib/pets/format";

import {
  PET_AGE_GROUP_LABELS,
  type PetCompatibility,
  type PetDetail,
} from "@/lib/pets/types";

const EMPTY_INFO_MESSAGE =
  "Sin información cargada. Consultá con el rescatista.";

/** "2 Años · Adulto" (o solo la etapa si el back no calcula la edad). */
export function formatAgeDisplay(pet: PetDetail): string {
  const groupLabel = PET_AGE_GROUP_LABELS[pet.age_group];
  const ageLabel = pet.age_label?.trim();
  return ageLabel ? `${ageLabel} · ${groupLabel}` : groupLabel;
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0 dark:border-slate-700/60">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

export function CoexistRow({
  label,
  value,
}: {
  label: string;
  value: PetCompatibility;
}) {
  const pill =
    value === "yes" ? (
      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        ✓ Sí
      </span>
    ) : value === "no" ? (
      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        ✗ No
      </span>
    ) : (
      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        ? Sin evaluar
      </span>
    );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 last:border-0 dark:border-slate-700/60">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      {pill}
    </div>
  );
}

function AccordionItem({
  title,
  icon,
  detailsRef,
  children,
}: {
  title: string;
  icon: string;
  detailsRef?: RefObject<HTMLDetailsElement | null>;
  children: ReactNode;
}) {
  return (
    <details
      ref={detailsRef}
      className="group scroll-mt-36 rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800"
    >
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-display text-base font-bold text-slate-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-white">
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{icon}</span>
          {title}
        </span>
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
      <div className="flex flex-col gap-1 px-4 pb-4 text-sm text-slate-700 dark:text-slate-200">
        {children}
      </div>
    </details>
  );
}

export interface PetInfoAccordionsProps {
  pet: PetDetail;
  descriptionRef?: RefObject<HTMLDetailsElement | null>;
}

export function PetInfoAccordions({
  pet,
  descriptionRef,
}: PetInfoAccordionsProps) {
  const sponsorsCount = pet.sponsors_count ?? 0;
  const isFemale = pet.sex === "female";
  const sexLabel = isFemale ? "Hembra" : "Macho";
  const neuteredLabel = pet.is_neutered
    ? isFemale
      ? "Castrada"
      : "Castrado"
    : isFemale
      ? "No castrada"
      : "No castrado";

  const healthRows = getPetHealthRows(pet);

  const notesText = pet.notes?.trim() ?? "";

  return (
    <>
      {/* Menciones a padrinos (fiel a mascota.html) */}
      <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3.5 dark:border-orange-900/60 dark:bg-orange-950/20">
        <span className="text-2xl" aria-hidden="true">
          💛
        </span>
        <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">
          {sponsorsCount > 0
            ? `${pet.name} tiene ${sponsorsCount} padrino${sponsorsCount === 1 ? "" : "s"} que cubren su alimento y cuidados.`
            : `${pet.name} todavía no tiene padrinos. ¡Podés ser el primero!`}
        </p>
      </div>

      {/* Info desplegable: cerrados por defecto */}
      <section
        className="flex flex-col gap-3"
        aria-label={`Información de ${pet.name}`}
      >
        <AccordionItem
          title="Descripción"
          icon="📖"
          detailsRef={descriptionRef}
        >
          <p className="pb-2 leading-relaxed">{pet.description}</p>
          <InfoRow label="Edad" value={formatAgeDisplay(pet)} />
          <InfoRow label="Sexo" value={sexLabel} />
          <InfoRow label="Castración" value={neuteredLabel} />
          <InfoRow
            label="Sociabilidad"
            value={pet.is_sociable ? "Sociable" : "Salvaje"}
          />
          <CoexistRow label="Con niños" value={pet.good_with_children} />
          <CoexistRow
            label="Con otros animales"
            value={pet.good_with_animals}
          />
        </AccordionItem>

        <AccordionItem title="Estado de salud" icon="🩺">
          {healthRows.length > 0 ? (
            healthRows.map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value} />
            ))
          ) : (
            <p className="leading-relaxed text-slate-500 dark:text-slate-400">
              {EMPTY_INFO_MESSAGE}
            </p>
          )}
        </AccordionItem>

        <AccordionItem title="Notas" icon="📝">
          {notesText ? (
            <p className="leading-relaxed">{notesText}</p>
          ) : (
            <p className="leading-relaxed text-slate-500 dark:text-slate-400">
              {EMPTY_INFO_MESSAGE}
            </p>
          )}
        </AccordionItem>
      </section>
    </>
  );
}
