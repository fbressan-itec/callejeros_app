"use client";

import type { ReactNode } from "react";

import type { ReviewQueue } from "@/components/staff/useReviewQueue";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { getTotalPages } from "@/lib/api/pagination";

const PAGINATION_BUTTON_CLASSES =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:focus-visible:ring-offset-slate-900";

export interface ReviewQueueViewProps<T> {
  queue: ReviewQueue<T>;
  loadingMessage: string;
  errorTitle: string;
  emptyTitle: string;
  emptyText: string;
  /** "3 solicitudes pendientes · de la más vieja a la más nueva" */
  summary: (count: number) => string;
  paginationLabel: string;
  getKey: (item: T) => number;
  renderItem: (item: T) => ReactNode;
}

/**
 * Vista de una cola del panel de Staff: aviso después de responder, `LoadingScreen`, error con
 * "Reintentar", estado vacío, la lista y la paginación.
 */
export function ReviewQueueView<T>({
  queue,
  loadingMessage,
  errorTitle,
  emptyTitle,
  emptyText,
  summary,
  paginationLabel,
  getKey,
  renderItem,
}: ReviewQueueViewProps<T>) {
  const { state, page, setPage, reload, notice, noticeRef } = queue;

  function renderContent() {
    if (state.status === "loading") {
      return <LoadingScreen message={loadingMessage} variant="section" />;
    }

    if (state.status === "error") {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center dark:border-red-900/60 dark:bg-red-950/20"
        >
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
            {errorTitle}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {state.message}
          </p>
          <button
            type="button"
            onClick={reload}
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
            {emptyTitle}
          </p>
          <p className="mt-1 text-xs sm:text-sm">{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {summary(data.count)}
        </p>

        <ul className="flex flex-col gap-4">
          {data.results.map((item) => (
            <li key={getKey(item)}>{renderItem(item)}</li>
          ))}
        </ul>

        {totalPages > 1 ? (
          <nav
            aria-label={paginationLabel}
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

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <p
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 focus:outline-hidden dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {notice}
        </p>
      ) : null}

      {renderContent()}
    </div>
  );
}

/** Botones de respuesta al pie de cada tarjeta (rechazar a la izquierda, aprobar a la derecha). */
export function ReviewActions({
  rejectLabel,
  approveLabel,
  onReject,
  onApprove,
}: {
  rejectLabel: string;
  approveLabel: string;
  onReject: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onReject}
        className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition-all hover:bg-red-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40 dark:focus-visible:ring-offset-slate-800"
      >
        {rejectLabel}
      </button>
      <button
        type="button"
        onClick={onApprove}
        className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-xs transition-all hover:bg-emerald-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-800"
      >
        {approveLabel}
      </button>
    </div>
  );
}
