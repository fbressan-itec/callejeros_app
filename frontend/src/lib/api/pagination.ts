/** Resultados por página de la API (`StandardPageNumberPagination` del back). */
export const API_PAGE_SIZE = 12;

/** Cantidad de páginas para un total de resultados (al menos 1). */
export function getTotalPages(count: number): number {
  return Math.max(1, Math.ceil(count / API_PAGE_SIZE));
}

/**
 * Respuesta paginada de la API (formato de `StandardPageNumberPagination` del back:
 * de a 12 resultados, con `?page=N`).
 */
export interface PaginatedResponse<T> {
  /** Total de resultados en todas las páginas. */
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
