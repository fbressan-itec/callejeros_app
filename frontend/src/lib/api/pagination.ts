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
