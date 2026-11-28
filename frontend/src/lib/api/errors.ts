/** Errores por campo: { email: ["Ya existe una cuenta con este email."] } */
export type FieldErrors = Record<string, string[]>;

/** Mensajes que ve la persona cuando el back no manda uno propio. */
export const ERROR_MESSAGES = {
  network:
    "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.",
  validation: "Revisá los datos marcados.",
  unauthorized: "Tu sesión venció. Ingresá de nuevo.",
  forbidden: "No tenés permiso para hacer esto.",
  notFound: "No encontramos lo que buscás.",
  server: "Algo salió mal de nuestro lado. Intentá de nuevo en unos minutos.",
  unknown: "Algo salió mal. Intentá de nuevo.",
} as const;

/**
 * Error único de la API, con el mismo formato para todas las pantallas:
 * - `status`: código HTTP (0 si no hubo respuesta, por ejemplo sin conexión).
 * - `message`: mensaje general para mostrar como aviso.
 * - `fieldErrors`: errores para mostrar junto a cada campo del formulario.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function defaultMessage(status: number): string {
  if (status === 0) return ERROR_MESSAGES.network;
  if (status === 400) return ERROR_MESSAGES.validation;
  if (status === 401) return ERROR_MESSAGES.unauthorized;
  if (status === 403) return ERROR_MESSAGES.forbidden;
  if (status === 404) return ERROR_MESSAGES.notFound;
  if (status >= 500) return ERROR_MESSAGES.server;
  return ERROR_MESSAGES.unknown;
}

function toMessages(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

/**
 * Convierte la respuesta de error del back en un ApiError.
 * Entiende el formato por defecto de Django REST Framework:
 * - `{ "detail": "..." }` → mensaje general;
 * - `{ "campo": ["..."] }` → errores por campo;
 * - `{ "non_field_errors": ["..."] }` → mensaje general.
 * Si el back define después un formato propio, se adapta solo esta función.
 */
export function parseApiError(status: number, body: unknown): ApiError {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return new ApiError(status, defaultMessage(status));
  }

  const {
    detail,
    non_field_errors: nonFieldErrors,
    ...fields
  } = body as Record<string, unknown>;
  const general = [...toMessages(detail), ...toMessages(nonFieldErrors)];

  const fieldErrors: FieldErrors = {};
  for (const [field, value] of Object.entries(fields)) {
    const messages = toMessages(value);
    if (messages.length > 0) fieldErrors[field] = messages;
  }

  return new ApiError(
    status,
    general[0] ?? defaultMessage(status),
    fieldErrors,
  );
}

/**
 * Mensaje para mostrar cuando falla una acción: el primero que explica el back por campo
 * (por ejemplo, "Esta mascota ya no está disponible para adopción.") o el general.
 * `inlineFields` son los campos cuyo error ya se muestra junto al campo del formulario.
 */
export function getActionErrorMessage(
  error: unknown,
  inlineFields: readonly string[] = [],
): string {
  if (!(error instanceof ApiError)) return ERROR_MESSAGES.unknown;
  const [first] = Object.entries(error.fieldErrors)
    .filter(([field]) => !inlineFields.includes(field))
    .flatMap(([, messages]) => messages);
  return first ?? error.message;
}
