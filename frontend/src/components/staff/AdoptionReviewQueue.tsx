"use client";

import { useCallback, useEffect, useState } from "react";

import { AdoptionReviewCard } from "@/components/staff/AdoptionReviewCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { fetchAdoptionReviewQueue } from "@/lib/adoptions/api";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import { getTotalPages, type PaginatedResponse } from "@/lib/api/pagination";

const PAGINATION_BUTTON_CLASSES =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:focus-visible:ring-offset-slate-900";

type QueueFetchResult =
  | { status: "success"; data: PaginatedResponse<AdoptionRequestReview> }
  | { status: "error"; message: string };

type QueueState = { status: "loading" } | QueueFetchResult;

/** Cola de solicitudes de adopción pendientes, de la más vieja a la más nueva. */
export function AdoptionReviewQueue() {
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: QueueFetchResult;
  } | null>(null);

  const requestKey = `${page}:${reloadCount}`;

  const handleRetry = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchAdoptionReviewQueue({ page, signal: controller.signal })
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
        setFetched({ key: requestKey, result: { status: "error", message } });
      });

    return () => {
      controller.abort();
    };
  }, [page, requestKey]);

  const state: QueueState =
    fetched?.key === requestKey ? fetched.result : { status: "loading" };

  if (state.status === "loading") {
    return (
      <LoadingScreen message="Cargando solicitudes..." variant="section" />
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center dark:border-red-900/60 dark:bg-red-950/20"
      >
        <p className="font-display text-base font-bold text-slate-900 dark:text-white">
          No pudimos cargar las solicitudes
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
    );
  }

  const { data } = state;
  const totalPages = getTotalPages(data.count);

  if (data.results.length === 0) {
    return (
      <div className="py-16 text-center text-slate-600 dark:text-slate-400">
        <span className="mb-2 block text-4xl" aria-hidden="true">
          🎉
        </span>
        <p className="text-base font-bold text-slate-800 sm:text-lg dark:text-slate-200">
          No hay solicitudes pendientes.
        </p>
        <p className="mt-1 text-xs sm:text-sm">
          Cuando alguien se postule para adoptar, la solicitud aparece acá.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
        {data.count === 1
          ? "1 solicitud pendiente"
          : `${data.count} solicitudes pendientes`}{" "}
        · de la más vieja a la más nueva
      </p>

      <ul className="flex flex-col gap-4">
        {data.results.map((request) => (
          <li key={request.id}>
            <AdoptionReviewCard request={request} />
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav
          aria-label="Paginación de solicitudes"
          className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className={PAGINATION_BUTTON_CLASSES}
          >
            Anterior
          </button>
          <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            disabled={!data.next || page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className={PAGINATION_BUTTON_CLASSES}
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </div>
  );
}
