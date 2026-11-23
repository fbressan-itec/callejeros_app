"use client";

import { useCallback, useEffect, useState } from "react";

import { BackButton } from "@/components/layout/BackButton";
import { PetCard } from "@/components/pets/PetCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import type { PaginatedResponse } from "@/lib/api/pagination";
import { fetchPets } from "@/lib/pets/api";
import type { PetListItem, PetSpecies } from "@/lib/pets/types";

const PAGE_SIZE = 12;

type SpeciesFilter = "all" | PetSpecies;

const SPECIES_TABS: readonly { value: SpeciesFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "dog", label: "🐶 Perros" },
  { value: "cat", label: "🐱 Gatos" },
];

type CatalogFetchResult =
  | { status: "success"; data: PaginatedResponse<PetListItem> }
  | { status: "error"; message: string };

type CatalogState = { status: "loading" } | CatalogFetchResult;

export function AdoptionCatalog() {
  const [species, setSpecies] = useState<SpeciesFilter>("all");
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: CatalogFetchResult;
  } | null>(null);

  const requestKey = `${species}:${page}:${reloadCount}`;

  const handleSelectSpecies = useCallback((nextSpecies: SpeciesFilter) => {
    setSpecies(nextSpecies);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSpecies("all");
    setPage(1);
  }, []);

  const handleRetry = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchPets(
      {
        species: species === "all" ? undefined : species,
        page,
      },
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setFetched({ key: requestKey, result: { status: "success", data } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const message =
          error instanceof ApiError ? error.message : ERROR_MESSAGES.unknown;
        setFetched({
          key: requestKey,
          result: { status: "error", message },
        });
      });

    return () => {
      controller.abort();
    };
  }, [species, page, requestKey]);

  const state: CatalogState =
    fetched?.key === requestKey ? fetched.result : { status: "loading" };

  const totalPages =
    state.status === "success"
      ? Math.max(1, Math.ceil(state.data.count / PAGE_SIZE))
      : 1;

  return (
    <main className="mx-auto w-full max-w-7xl grow px-4 pt-8 pb-24 sm:px-8 sm:pt-12 lg:px-12 xl:px-16 2xl:max-w-screen-2xl 2xl:px-20">
      {/* Botón Volver */}
      <div className="mb-4">
        <BackButton fallbackHref="/" />
      </div>

      {/* Encabezado de Sección y Filtros Rápidos */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-orange-500"
              aria-hidden="true"
            />
            <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
              Adopciones en Río Cuarto
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-slate-900 sm:text-4xl dark:text-white">
            Adoptá un Callejero
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Conocé a los rescatados que buscan un hogar para siempre. Todos se
            entregan vacunados, desparasitados y con compromiso de castración.
          </p>
        </div>

        {/* Barra de Filtros Rápidos por Especie + Filtros + Publicar */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            ¿Qué preferís adoptar?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filtrar por especie"
              className="flex items-center gap-1 rounded-xl bg-slate-200/80 p-1 text-xs font-semibold dark:bg-slate-800"
            >
              {SPECIES_TABS.map((tab) => {
                const isActive = species === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleSelectSpecies(tab.value)}
                    className={`min-h-[44px] rounded-lg px-3 py-1.5 transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${
                      isActive
                        ? "bg-orange-700 text-white shadow-md hover:bg-orange-800"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Grupo Filtros + Publicar: en 375px bajan juntos a la segunda fila */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Botón Filtros (se conecta al modal en FR-06b, #130) */}
              <button
                type="button"
                id="btn-open-filters"
                aria-label="Abrir filtros avanzados"
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:focus-visible:ring-offset-slate-900"
              >
                <svg
                  className="h-4 w-4 text-orange-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span>Filtros</span>
              </button>

              {/* Botón Publicar Mascota (sin destino hasta FR-08, #26) */}
              <button
                type="button"
                id="btn-open-publish-pet"
                aria-label="Publicar mascota para adopción"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-orange-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
              >
                <span className="text-sm font-extrabold" aria-hidden="true">
                  +
                </span>
                <span className="hidden sm:inline">Publicar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal: Cargando / Error / Vacío / Grilla + Paginación */}
      {state.status === "loading" ? (
        <div className="pt-8">
          <LoadingScreen message="Cargando mascotas..." variant="section" />
        </div>
      ) : state.status === "error" ? (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center dark:border-red-900/60 dark:bg-red-950/20"
        >
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
            No pudimos cargar el catálogo de adopción
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {state.message}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
          >
            Reintentar
          </button>
        </div>
      ) : state.data.results.length === 0 ? (
        <div className="py-16 text-center text-slate-600 dark:text-slate-400">
          <span className="mb-2 block text-4xl" aria-hidden="true">
            🔍
          </span>
          <p className="text-base font-bold text-slate-800 sm:text-lg dark:text-slate-200">
            No encontramos animalitos con esos filtros.
          </p>
          <p className="mt-1 text-xs sm:text-sm">
            Probá limpiando los filtros para ver todos los rescatados
            disponibles.
          </p>
          {species !== "all" ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60 dark:focus-visible:ring-offset-slate-900"
            >
              Limpiar Filtros
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            id="pets-grid"
            className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-8"
          >
            {state.data.results.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              aria-label="Paginación del catálogo"
              className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:focus-visible:ring-offset-slate-900"
              >
                Anterior
              </button>
              <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={!state.data.next || page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:focus-visible:ring-offset-slate-900"
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
