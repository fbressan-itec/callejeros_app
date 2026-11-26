"use client";

import { useEffect, useRef, useState } from "react";

import type { PetAgeGroup, PetSex } from "@/lib/pets/types";

export type SociabilityFilter = "all" | "sociable" | "wild";
export type NeuteredFilter = "all" | "neutered" | "not_neutered";
export type SexFilter = "all" | PetSex;

export interface CatalogFilters {
  search: string;
  ageGroup: PetAgeGroup | null;
  sociability: SociabilityFilter;
  goodWithChildren: boolean;
  goodWithAnimals: boolean;
  neutered: NeuteredFilter;
  onlyUrgent: boolean;
  sex: SexFilter;
  onlyFavorites: boolean;
  adopted: boolean;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  search: "",
  ageGroup: null,
  sociability: "all",
  goodWithChildren: false,
  goodWithAnimals: false,
  neutered: "all",
  onlyUrgent: false,
  sex: "all",
  onlyFavorites: false,
  adopted: false,
};

/** Cuenta cuántos filtros avanzados del modal están activos. */
export function countActiveCatalogFilters(filters: CatalogFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.ageGroup !== null) count += 1;
  if (filters.sociability !== "all") count += 1;
  if (filters.goodWithChildren) count += 1;
  if (filters.goodWithAnimals) count += 1;
  if (filters.neutered !== "all") count += 1;
  if (filters.onlyUrgent) count += 1;
  if (filters.sex !== "all") count += 1;
  if (filters.onlyFavorites) count += 1;
  if (filters.adopted) count += 1;
  return count;
}

const AGE_OPTIONS: readonly {
  value: PetAgeGroup;
  label: string;
  hint: string;
}[] = [
  { value: "cachorro", label: "Cachorro", hint: "(menos de 1 año)" },
  { value: "adulto", label: "Adulto", hint: "(de 1 a 7 años)" },
  { value: "senior", label: "Senior", hint: "(más de 7 años)" },
];

const SOCIABILITY_OPTIONS: readonly {
  value: SociabilityFilter;
  label: string;
  hoverBorder: string;
  checkedText: string;
}[] = [
  {
    value: "all",
    label: "Todos",
    hoverBorder: "hover:border-orange-500",
    checkedText:
      "peer-checked:text-orange-700 dark:peer-checked:text-orange-400",
  },
  {
    value: "sociable",
    label: "Sociable",
    hoverBorder: "hover:border-emerald-500",
    checkedText:
      "peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400",
  },
  {
    value: "wild",
    label: "Salvaje",
    hoverBorder: "hover:border-red-500",
    checkedText: "peer-checked:text-red-700 dark:peer-checked:text-red-400",
  },
];

const NEUTERED_OPTIONS: readonly {
  value: NeuteredFilter;
  label: string;
  hoverBorder: string;
  checkedText: string;
}[] = [
  {
    value: "all",
    label: "Todos",
    hoverBorder: "hover:border-orange-500",
    checkedText:
      "peer-checked:text-orange-700 dark:peer-checked:text-orange-400",
  },
  {
    value: "neutered",
    label: "Castrados",
    hoverBorder: "hover:border-emerald-500",
    checkedText:
      "peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400",
  },
  {
    value: "not_neutered",
    label: "No Castrados",
    hoverBorder: "hover:border-amber-500",
    checkedText: "peer-checked:text-amber-800 dark:peer-checked:text-amber-400",
  },
];

const SEX_OPTIONS: readonly {
  value: SexFilter;
  label: string;
  hoverBorder: string;
  checkedText: string;
}[] = [
  {
    value: "all",
    label: "Todos",
    hoverBorder: "hover:border-orange-500",
    checkedText:
      "peer-checked:text-orange-700 dark:peer-checked:text-orange-400",
  },
  {
    value: "male",
    label: "Macho",
    hoverBorder: "hover:border-blue-500",
    checkedText: "peer-checked:text-blue-700 dark:peer-checked:text-blue-400",
  },
  {
    value: "female",
    label: "Hembra",
    hoverBorder: "hover:border-pink-500",
    checkedText: "peer-checked:text-pink-700 dark:peer-checked:text-pink-400",
  },
];

const SWITCH_TRACK_CLASS =
  "block h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-slate-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 dark:bg-slate-700 dark:peer-checked:bg-orange-600 dark:peer-focus-visible:ring-offset-slate-900";

export interface CatalogFiltersModalProps {
  isOpen: boolean;
  initialFilters: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Modal de filtros avanzados del catálogo (`#modal-filtros` en `adopciones.html`).
 * Todos los grupos están siempre visibles (sin desplegables) y las acciones
 * "VER RESULTADOS" y "Limpiar Filtros" quedan fijas abajo.
 */
export function CatalogFiltersModal({
  isOpen,
  initialFilters,
  onApply,
  onReset,
  onClose,
}: CatalogFiltersModalProps) {
  if (!isOpen) return null;

  return (
    <CatalogFiltersModalContent
      initialFilters={initialFilters}
      onApply={onApply}
      onReset={onReset}
      onClose={onClose}
    />
  );
}

interface CatalogFiltersModalContentProps {
  initialFilters: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

function CatalogFiltersModalContent({
  initialFilters,
  onApply,
  onReset,
  onClose,
}: CatalogFiltersModalContentProps) {
  const [draft, setDraft] = useState<CatalogFilters>(initialFilters);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({ ...draft, search: draft.search.trim() });
  }

  return (
    <div
      id="modal-filtros"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-filtros-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-5">
          {/* Cabecera */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2
              id="modal-filtros-title"
              className="font-display text-xl font-extrabold text-slate-900 dark:text-white"
            >
              Filtros de búsqueda
            </h2>
            <button
              ref={closeBtnRef}
              type="button"
              id="btn-close-filters"
              onClick={onClose}
              aria-label="Cerrar filtros de búsqueda"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Buscador por nombre */}
          <div>
            <label htmlFor="filter-search-input" className="sr-only">
              Buscar mascota por nombre
            </label>
            <div className="relative">
              <span
                className="pointer-events-none absolute top-3 left-3.5 text-slate-400"
                aria-hidden="true"
              >
                🔍
              </span>
              <input
                type="text"
                id="filter-search-input"
                value={draft.search}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, search: event.target.value }))
                }
                placeholder="Buscar ..."
                className="min-h-[44px] w-full rounded-full border border-slate-300 bg-slate-100 py-2.5 pr-4 pl-10 text-base text-slate-900 placeholder:text-slate-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Edad (selección única sobre los 3 switches, alineado a ?age_group= del back) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
            <div className="flex items-center justify-between bg-slate-200/70 px-4 py-2.5 dark:bg-slate-800">
              <span className="font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                Edad
              </span>
            </div>
            <div className="divide-y divide-slate-100 p-2 dark:divide-slate-800">
              {AGE_OPTIONS.map((option) => {
                const checked = draft.ageGroup === option.value;
                return (
                  <label
                    key={option.value}
                    className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {option.label}{" "}
                      <span className="font-normal text-slate-600 dark:text-slate-400">
                        {option.hint}
                      </span>
                    </span>
                    <span className="relative inline-flex shrink-0 items-center">
                      <input
                        type="checkbox"
                        name="filter-age-num"
                        value={option.value}
                        checked={checked}
                        onChange={() =>
                          setDraft((prev) => ({
                            ...prev,
                            ageGroup:
                              prev.ageGroup === option.value
                                ? null
                                : option.value,
                          }))
                        }
                        className="peer sr-only"
                      />
                      <span className={SWITCH_TRACK_CLASS} />
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Sociabilidad */}
          <fieldset className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
            <legend className="sr-only">Sociabilidad</legend>
            <div
              aria-hidden="true"
              className="bg-slate-200/70 px-4 py-2.5 font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:bg-slate-800 dark:text-slate-200"
            >
              Sociabilidad
            </div>
            <div className="grid grid-cols-3 gap-2 p-2.5">
              {SOCIABILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${option.hoverBorder}`}
                >
                  <input
                    type="radio"
                    name="filter-sociable"
                    value={option.value}
                    checked={draft.sociability === option.value}
                    onChange={() =>
                      setDraft((prev) => ({
                        ...prev,
                        sociability: option.value,
                      }))
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={`peer-checked:font-bold ${option.checkedText}`}
                  >
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Convivencia */}
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-850">
            <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                Sociable con niños
              </span>
              <span className="relative inline-flex shrink-0 items-center">
                <input
                  type="checkbox"
                  id="filter-with-kids"
                  checked={draft.goodWithChildren}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      goodWithChildren: event.target.checked,
                    }))
                  }
                  className="peer sr-only"
                />
                <span className={SWITCH_TRACK_CLASS} />
              </span>
            </label>
            <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                Sociable con otros animales
              </span>
              <span className="relative inline-flex shrink-0 items-center">
                <input
                  type="checkbox"
                  id="filter-with-animals"
                  checked={draft.goodWithAnimals}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      goodWithAnimals: event.target.checked,
                    }))
                  }
                  className="peer sr-only"
                />
                <span className={SWITCH_TRACK_CLASS} />
              </span>
            </label>
          </div>

          {/* Castración */}
          <fieldset className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
            <legend className="sr-only">Castración</legend>
            <div
              aria-hidden="true"
              className="bg-slate-200/70 px-4 py-2.5 font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:bg-slate-800 dark:text-slate-200"
            >
              Castración
            </div>
            <div className="grid grid-cols-3 gap-2 p-2.5">
              {NEUTERED_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-medium text-slate-700 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${option.hoverBorder}`}
                >
                  <input
                    type="radio"
                    name="filter-castrado"
                    value={option.value}
                    checked={draft.neutered === option.value}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, neutered: option.value }))
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={`peer-checked:font-bold ${option.checkedText}`}
                  >
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Solo Casos Urgentes */}
          <label className="flex min-h-[52px] cursor-pointer items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/20">
            <span className="flex items-center gap-2">
              <span className="text-base text-rose-600" aria-hidden="true">
                🚨
              </span>
              <span className="font-display text-xs font-bold tracking-wider text-rose-700 uppercase dark:text-rose-300">
                Solo Casos Urgentes
              </span>
            </span>
            <span className="relative inline-flex shrink-0 items-center">
              <input
                type="checkbox"
                id="filter-only-urgent"
                checked={draft.onlyUrgent}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    onlyUrgent: event.target.checked,
                  }))
                }
                className="peer sr-only"
              />
              <span className="block h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-rose-600 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700 dark:peer-focus-visible:ring-offset-slate-900" />
            </span>
          </label>

          {/* Sexo */}
          <fieldset className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
            <legend className="sr-only">Sexo</legend>
            <div
              aria-hidden="true"
              className="bg-slate-200/70 px-4 py-2.5 font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:bg-slate-800 dark:text-slate-200"
            >
              Sexo
            </div>
            <div className="grid grid-cols-3 gap-2 p-2.5">
              {SEX_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${option.hoverBorder}`}
                >
                  <input
                    type="radio"
                    name="filter-sex"
                    value={option.value}
                    checked={draft.sex === option.value}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, sex: option.value }))
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={`peer-checked:font-bold ${option.checkedText}`}
                  >
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Favoritos */}
          <label className="flex min-h-[52px] cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 p-3.5 dark:border-slate-700 dark:bg-slate-800">
            <span className="font-display text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
              Favoritos
            </span>
            <span className="relative inline-flex shrink-0 items-center">
              <input
                type="checkbox"
                id="filter-only-favs"
                checked={draft.onlyFavorites}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    onlyFavorites: event.target.checked,
                  }))
                }
                className="peer sr-only"
              />
              <span className={SWITCH_TRACK_CLASS} />
            </span>
          </label>

          {/* Adoptados (alcance B9: solo aparecen al marcarlo) */}
          <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 dark:border-orange-900/60 dark:bg-orange-950/20">
            <span className="flex flex-col">
              <span className="font-display text-xs font-bold tracking-wider text-orange-800 uppercase dark:text-orange-300">
                Adoptados
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                Muestra solo mascotas que ya encontraron hogar
              </span>
            </span>
            <span className="relative inline-flex shrink-0 items-center">
              <input
                type="checkbox"
                id="filter-adopted"
                checked={draft.adopted}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    adopted: event.target.checked,
                  }))
                }
                className="peer sr-only"
              />
              <span className="block h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-orange-700 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700 dark:peer-focus-visible:ring-offset-slate-900" />
            </span>
          </label>
        </div>

        {/* Botones de Acción fijos abajo */}
        <div className="sticky -bottom-6 -mx-6 mt-5 -mb-6 flex flex-col items-center gap-1 border-t border-slate-100 bg-white px-6 pt-3 pb-4 text-center dark:border-slate-800 dark:bg-slate-900">
          <button
            type="submit"
            id="btn-apply-filters"
            className="min-h-[44px] w-full rounded-full bg-slate-950 py-3.5 font-display text-sm font-bold tracking-wider text-white uppercase shadow-lg transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-900"
          >
            VER RESULTADOS
          </button>
          <button
            type="button"
            id="btn-reset-filters"
            onClick={onReset}
            className="min-h-[44px] px-2 text-xs font-semibold text-slate-600 underline underline-offset-4 transition-colors hover:text-slate-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-slate-400 dark:hover:text-white"
          >
            Limpiar Filtros
          </button>
        </div>
      </form>
    </div>
  );
}
