"use client";

import type { ReactNode, RefObject } from "react";

import {
  PET_AGE_GROUP_LABELS,
  type PetCompatibility,
  type PetDetail,
} from "@/lib/pets/types";

const DEFAULT_HEALTH = {
  general_status: "Sano y bajo control veterinario",
  vaccines: "Plan de vacunación iniciado",
  deworming: "Desparasitado",
  flea_tick_treatment: "Pipeta al día",
  other: "Sin complicaciones detectadas",
};

const DEFAULT_NOTES =
  "Animalito muy dócil que requiere cariño, seguimiento de vacunas y compromiso de tenencia responsable.";

function extractAgeDisplay(pet: PetDetail): string {
  const groupLabel = PET_AGE_GROUP_LABELS[pet.age_group];
  const ageBadge = pet.badges.find((badge) => badge.key === "age");
  if (ageBadge) {
    const colonIndex = ageBadge.text.lastIndexOf(":");
    if (colonIndex !== -1) {
      const ageValue = ageBadge.text.slice(colonIndex + 1).trim();
      if (ageValue) {
        return `${ageValue} · ${groupLabel}`;
      }
    }
  }
  return groupLabel;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0 dark:border-slate-700/60">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function CoexistRow({
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
    : "No castrado";
  const health = {
    general_status:
      pet.health?.general_status?.trim() || DEFAULT_HEALTH.general_status,
    vaccines: pet.health?.vaccines?.trim() || DEFAULT_HEALTH.vaccines,
    deworming: pet.health?.deworming?.trim() || DEFAULT_HEALTH.deworming,
    flea_tick_treatment:
      pet.health?.flea_tick_treatment?.trim() ||
      DEFAULT_HEALTH.flea_tick_treatment,
    other: pet.health?.other?.trim() || DEFAULT_HEALTH.other,
  };
  const notesText = pet.notes?.trim() || DEFAULT_NOTES;

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
          <InfoRow label="Edad" value={extractAgeDisplay(pet)} />
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
          <InfoRow label="Estado clínico" value={health.general_status} />
          <InfoRow label="Vacunas" value={health.vaccines} />
          <InfoRow label="Parásitos" value={health.deworming} />
          <InfoRow
            label="Pulgas / garrapatas"
            value={health.flea_tick_treatment}
          />
          <InfoRow label="Otros" value={health.other} />
          {pet.special_care?.trim() ? (
            <InfoRow label="Cuidado especial" value={pet.special_care.trim()} />
          ) : null}
        </AccordionItem>

        <AccordionItem title="Notas" icon="📝">
          <p className="leading-relaxed">{notesText}</p>
        </AccordionItem>
      </section>
    </>
  );
}
