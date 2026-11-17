import { ApiError, parseApiError } from "./errors";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestOptions = {
  /** Datos a enviar; se mandan como JSON. */
  body?: unknown;
  /** Encabezados extra (por ejemplo, el token de sesión desde FR-03). */
  headers?: Record<string, string>;
  /** Para cancelar el pedido (por ejemplo, si la persona sale de la pantalla). */
  signal?: AbortSignal;
};

/** URL base de la API, sin la barra final. Sale de NEXT_PUBLIC_API_URL (.env de la raíz). */
export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_API_URL: copiá .env.example como .env en la raíz del repo.",
    );
  }
  return url.replace(/\/+$/, "");
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Respuesta que no es JSON (por ejemplo, una página de error del servidor).
    return null;
  }
}

/**
 * Llama a la API del back. Es la única forma de hacerlo: ninguna pantalla usa fetch directo.
 * Devuelve los datos de la respuesta o lanza un ApiError con formato consistente.
 */
export async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers = {}, signal } = options;
  const url = `${getApiUrl()}/${path.replace(/^\/+/, "")}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // Si se canceló a propósito, no es un error de conexión.
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw parseApiError(0, null);
  }

  const data = await readBody(response);
  if (!response.ok) {
    throw parseApiError(response.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("DELETE", path, options),
};

export { ApiError };
