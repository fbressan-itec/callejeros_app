"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BackButton } from "@/components/layout/BackButton";
import {
  AdoptPetModal,
  DeactivatePetModal,
} from "@/components/pets/MyPetActionModals";
import { MyPetCard } from "@/components/pets/MyPetCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import type { PaginatedResponse } from "@/lib/api/pagination";
import { fetchMyPets } from "@/lib/pets/api";
import type { PetDetail, PetStatus } from "@/lib/pets/types";

const PAGE_SIZE = 12;

type StatusFilter = "all" | PetStatus;

const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "in_review", label: "En revisión" },
  { value: "published", label: "Publicadas" },
  { value: "adopted", label: "Adoptadas" },
  { value: "rejected", label: "Rechazadas" },
];

type MyPetsFetchResult =
  | { status: "success"; data: PaginatedResponse<PetDetail> }
  | { status: "error"; message: string };

type MyPetsState = { status: "loading" } | MyPetsFetchResult;

export function MyPetsView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: MyPetsFetchResult;
  } | null>(null);

  const [petToAdopt, setPetToAdopt] = useState<PetDetail | null>(null);
  const [petToDeactivate, setPetToDeactivate] = useState<PetDetail | null>(
    null,
  );
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const requestKey = `${statusFilter}:${page}:${reloadCount}`;

  const handleSelectStatus = useCallback((nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus);
    setPage(1);
    setFeedbackMessage(null);
  }, []);

  const handleRetry = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchMyPets(
      {
        status: statusFilter === "all" ? undefined : statusFilter,
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
  }, [statusFilter, page, requestKey]);

  const state: MyPetsState =
    fetched?.key === requestKey ? fetched.result : { status: "loading" };

  const totalPages =
    state.status === "success"
      ? Math.max(1, Math.ceil(state.data.count / PAGE_SIZE))
      : 1;

  function handleAdoptSuccess(updatedPet: PetDetail) {
    setPetToAdopt(null);
    const adoptedPhrase =
      updatedPet.sex === "female"
        ? "marcada como adoptada"
        : "marcado como adoptado";
    setFeedbackMessage(
      `¡Qué alegría! ${updatedPet.name} quedó ${adoptedPhrase}.`,
    );
    setReloadCount((prev) => prev + 1);
  }

  function handleDeactivateSuccess() {
    const name = petToDeactivate?.name;
    setPetToDeactivate(null);
    setFeedbackMessage(
      name
        ? `La publicación de ${name} fue dada de baja correctamente.`
        : "La publicación fue dada de baja correctamente.",
    );
    setReloadCount((prev) => prev + 1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl grow px-4 pt-8 pb-24 sm:px-8 sm:pt-12 lg:px-12 xl:px-16 2xl:max-w-screen-2xl 2xl:px-20">
      <div className="mb-4">
        <BackButton fallbackHref="/adopciones" />
      </div>

      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-orange-500"
              aria-hidden="true"
            />
            <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
              Gestión de adopciones
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-slate-900 sm:text-4xl dark:text-white">
            Mis publicaciones
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Seguí el estado de las mascotas que publicaste, marcalas como
            adoptadas cuando encuentren hogar o dalas de baja si ya no están
            disponibles.
          </p>
        </div>

        <Link
          href="/adopciones/publicar"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-orange-700 px-4 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
        >
          <span className="text-sm font-extrabold" aria-hidden="true">
            +
          </span>
          <span>Publicar mascota</span>
        </Link>
      </div>

      {/* Pestañas de filtro por estado */}
      <div
        role="tablist"
        aria-label="Filtrar mis publicaciones por estado"
        className="mt-6 flex flex-wrap gap-2"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectStatus(tab.value)}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${
                isActive
                  ? "bg-orange-700 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Aviso de éxito fijo abajo para que siempre sea visible en celular (375 px) */}
      {feedbackMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-950 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            aria-label="Cerrar aviso"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-emerald-900 hover:bg-emerald-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Contenido */}
      <div className="pt-8">
        {state.status === "loading" ? (
          <LoadingScreen
            variant="section"
            message="Cargando tus publicaciones..."
          />
        ) : state.status === "error" ? (
          <div
            role="alert"
            className="mx-auto max-w-md space-y-4 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-soft dark:border-red-900/60 dark:bg-slate-800 dark:shadow-soft-dark"
          >
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {state.message}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
            >
              Reintentar
            </button>
          </div>
        ) : state.data.results.length === 0 ? (
          <div className="mx-auto max-w-md space-y-3 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft dark:border-slate-800 dark:bg-slate-800/70 dark:shadow-soft-dark">
            <span className="block text-4xl" aria-hidden="true">
              🐾
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {statusFilter === "all"
                ? "Todavía no publicaste mascotas"
                : "No tenés publicaciones en este estado"}
            </h2>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">
              {statusFilter === "all"
                ? "Cuando publiques una mascota en adopción, vas a poder seguir su estado y gestionarla desde acá."
                : "Probá cambiando el filtro de estado o cargá una nueva publicación."}
            </p>
            <div className="pt-2">
              {statusFilter === "all" ? (
                <Link
                  href="/adopciones/publicar"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
                >
                  Publicar mascota
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectStatus("all")}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                >
                  Ver todas
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {state.data.results.map((pet) => (
                <MyPetCard
                  key={pet.id}
                  pet={pet}
                  onRequestAdopt={setPetToAdopt}
                  onRequestDeactivate={setPetToDeactivate}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav
                aria-label="Paginación de mis publicaciones"
                className="mt-8 flex items-center justify-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={!state.data.previous || page <= 1}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Anterior
                </button>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={!state.data.next || page >= totalPages}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Siguiente
                </button>
              </nav>
            ) : null}
          </>
        )}
      </div>

      {petToAdopt ? (
        <AdoptPetModal
          pet={petToAdopt}
          onClose={() => setPetToAdopt(null)}
          onSuccess={handleAdoptSuccess}
        />
      ) : null}

      {petToDeactivate ? (
        <DeactivatePetModal
          pet={petToDeactivate}
          onClose={() => setPetToDeactivate(null)}
          onSuccess={handleDeactivateSuccess}
        />
      ) : null}
    </main>
  );
}
