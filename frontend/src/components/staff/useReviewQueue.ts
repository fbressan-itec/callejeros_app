"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import type { PaginatedResponse } from "@/lib/api/pagination";

export type ReviewQueueFetcher<T> = (options: {
  page: number;
  signal: AbortSignal;
}) => Promise<PaginatedResponse<T>>;

type QueueFetchResult<T> =
  | { status: "success"; data: PaginatedResponse<T> }
  | { status: "error"; message: string };

export type ReviewQueueState<T> = { status: "loading" } | QueueFetchResult<T>;

/**
 * Estado de una cola del panel de Staff: pide la página actual, guarda el aviso que se
 * muestra después de responder y vuelve a pedir la cola cuando hace falta. La usan las
 * solicitudes de adopción y las publicaciones en revisión.
 *
 * `fetchPage` tiene que ser estable (una función del módulo, no una creada en cada render).
 */
export function useReviewQueue<T>(fetchPage: ReviewQueueFetcher<T>) {
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: QueueFetchResult<T>;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement | null>(null);
  // Si una acción falló, la cola puede haber cambiado (otra persona la respondió)
  const isStaleRef = useRef(false);

  const requestKey = `${page}:${reloadCount}`;

  useEffect(() => {
    const controller = new AbortController();

    fetchPage({ page, signal: controller.signal })
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
  }, [fetchPage, page, requestKey]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const state: ReviewQueueState<T> =
    fetched?.key === requestKey ? fetched.result : { status: "loading" };

  const reload = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  /** Una acción falló: la cola se vuelve a pedir al cerrar el modal. */
  const markStale = useCallback(() => {
    isStaleRef.current = true;
  }, []);

  const reloadIfStale = useCallback(() => {
    if (!isStaleRef.current) return;
    isStaleRef.current = false;
    setReloadCount((prev) => prev + 1);
  }, []);

  /**
   * Un elemento salió de la cola (aprobado, rechazado…): muestra el aviso y vuelve a pedir
   * la página; si era el último de la página, vuelve a la anterior.
   */
  function completeReview(message: string) {
    isStaleRef.current = false;
    setNotice(message);
    const isLastOnPage =
      state.status === "success" && state.data.results.length === 1;
    if (isLastOnPage && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      setReloadCount((prev) => prev + 1);
    }
  }

  /** Cambia un elemento sin sacarlo de la cola (por ejemplo, la urgencia validada). */
  function replaceItem(isSame: (item: T) => boolean, next: T) {
    setFetched((prev) => {
      if (prev?.result.status !== "success") return prev;
      const { data } = prev.result;
      return {
        ...prev,
        result: {
          status: "success",
          data: {
            ...data,
            results: data.results.map((item) => (isSame(item) ? next : item)),
          },
        },
      };
    });
  }

  return {
    state,
    page,
    setPage,
    reload,
    notice,
    setNotice,
    noticeRef,
    markStale,
    reloadIfStale,
    completeReview,
    replaceItem,
  };
}

export type ReviewQueue<T> = ReturnType<typeof useReviewQueue<T>>;
