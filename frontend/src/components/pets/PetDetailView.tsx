"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BackButton } from "@/components/layout/BackButton";
import { PetPhotoCarousel } from "@/components/pets/PetPhotoCarousel";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import { fetchPetById, parsePetId } from "@/lib/pets/api";
import type { PetDetail } from "@/lib/pets/types";

const DEFAULT_DOCUMENT_TITLE = "Ficha de Mascota — Callejeros Río Cuarto";

type FetchResult =
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "success"; pet: PetDetail };

type FetchState = { status: "loading" } | FetchResult;

export interface PetDetailViewProps {
  rawId: string;
}

export function PetDetailView({ rawId }: PetDetailViewProps) {
  const petId = parsePetId(rawId);

  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: FetchResult;
  } | null>(null);

  const requestKey = petId === null ? null : `${petId}:${reloadCount}`;

  const handleRetry = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (petId === null || requestKey === null) return;

    const controller = new AbortController();

    fetchPetById(petId, { signal: controller.signal })
      .then((pet) => {
        if (controller.signal.aborted) return;
        setFetched({ key: requestKey, result: { status: "success", pet } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setFetched({ key: requestKey, result: { status: "not_found" } });
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
  }, [petId, requestKey]);

  const state: FetchState =
    petId === null
      ? { status: "not_found" }
      : fetched?.key === requestKey
        ? fetched.result
        : { status: "loading" };

  const resolvedPetName = state.status === "success" ? state.pet.name : null;

  useEffect(() => {
    if (resolvedPetName) {
      document.title = `${resolvedPetName} — Adoptá un Callejero — Callejeros Río Cuarto`;
    } else {
      document.title = DEFAULT_DOCUMENT_TITLE;
    }

    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, [resolvedPetName]);

  const headerTitle = resolvedPetName ?? "Mascota";

  return (
    <main className="mx-auto w-full max-w-3xl grow pb-12">
      {/* Barra superior fija (igual a mascota.html: < Atrás · Nombre) */}
      <div className="sticky top-16 z-30 flex items-center gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur-md sm:px-8 dark:border-slate-800 dark:bg-slate-900/95">
        <BackButton
          fallbackHref="/adopciones"
          ariaLabel="Volver al catálogo"
          iconOnly
        />
        <h1
          id="pet-name"
          className="min-w-0 flex-1 truncate font-display text-xl font-extrabold text-slate-900 dark:text-white"
        >
          {headerTitle}
        </h1>
      </div>

      {/* Contenido de la ficha */}
      <div id="pet-content" className="flex flex-col gap-5 px-4 pt-4 sm:px-8">
        {state.status === "loading" ? (
          <LoadingScreen message="Cargando ficha..." />
        ) : null}

        {state.status === "not_found" ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="block text-4xl" aria-hidden="true">
              🐾
            </span>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              No encontramos esta mascota
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Puede que ya haya sido adoptada. ¡Hay muchos más esperando!
            </p>
            <Link
              href="/adopciones"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 text-sm font-bold text-white transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
            >
              Ver el catálogo
            </Link>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-white p-6 text-center shadow-soft dark:border-red-900/60 dark:bg-slate-800"
          >
            <span className="block text-3xl" aria-hidden="true">
              ⚠️
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              No pudimos cargar esta ficha
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {state.message}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 text-sm font-bold text-white transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-800"
            >
              Intentar de nuevo
            </button>
          </div>
        ) : null}

        {state.status === "success" ? (
          <PetPhotoCarousel
            petName={state.pet.name}
            description={state.pet.description}
            photos={state.pet.photos}
          />
        ) : null}
      </div>
    </main>
  );
}
