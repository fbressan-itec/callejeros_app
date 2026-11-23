"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import { fetchPets } from "@/lib/pets/api";
import type { PetListItem } from "@/lib/pets/types";

export type LatestPetsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; pets: PetListItem[]; publishedCount: number };

/**
 * Pide las `limit` mascotas publicadas más nuevas y el total de publicadas (`count`)
 * en un solo pedido a `GET /api/pets/` (la API ya las ordena de la más nueva a la más vieja).
 */
export function useLatestPets(limit: number): LatestPetsState {
  const [state, setState] = useState<LatestPetsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetchPets({}, { signal: controller.signal })
      .then((page) => {
        setState({
          status: "success",
          pets: page.results.slice(0, limit),
          publishedCount: page.count,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof ApiError ? error.message : ERROR_MESSAGES.unknown,
        });
      });

    return () => controller.abort();
  }, [limit]);

  return state;
}
