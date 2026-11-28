/**
 * Valida que un parámetro de ruta (`/mascotas/[id]`, `/solicitudes/[id]`…) sea un ID
 * numérico positivo. Devuelve `null` para cadenas vacías, decimales, cero o textos no numéricos.
 */
export function parsePositiveId(rawId: string): number | null {
  const trimmed = rawId.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
