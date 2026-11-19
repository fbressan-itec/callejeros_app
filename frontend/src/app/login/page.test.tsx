import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth/AuthProvider";
import {
  AUTH_SESSION_STORAGE_KEY,
  type AuthTokenResponse,
} from "@/lib/auth/session";

import LoginPage from "./page";

const pushMock = vi.fn();
const backMock = vi.fn();
const fetchMock = vi.fn();
let currentRedirectParam: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: pushMock,
    back: backMock,
  }),
  usePathname: () => "/login",
  useSearchParams: () => ({
    get: (key: string) => (key === "redirect" ? currentRedirectParam : null),
  }),
}));

const MOCK_LOGIN_RESPONSE: AuthTokenResponse = {
  access: "access-jwt-token",
  refresh: "refresh-jwt-token",
  user: {
    id: 10,
    email: "miembro@callejeros.ar",
    first_name: "Tomás",
    last_name: "Pérez",
    phone: "3584001122",
    is_phone_verified: true,
    photo: null,
    role: {
      code: "member",
      name: "Miembro",
    },
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    pushMock.mockReset();
    backMock.mockReset();
    fetchMock.mockReset();
    currentRedirectParam = null;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("renderiza el formulario fiel al maquetado con ojito de contraseña y botones maquetados de Google y Facebook", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Iniciar Sesión" }),
    ).toBeInTheDocument();

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", {
      name: "Mostrar u ocultar contraseña",
    });
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");

    expect(screen.getByRole("button", { name: /Google/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Facebook/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "¿Olvidaste tu clave?" }),
    ).toHaveAttribute("href", "/recuperar");
  });

  it("valida con zod que la contraseña tenga al menos 6 caracteres con el mensaje exacto", async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText("Correo Electrónico"), {
      target: { value: "miembro@callejeros.ar" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByText("La contraseña debe tener al menos 6 caracteres"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra debajo del campo de contraseña los errores que devuelve el back", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        password: [
          "La contraseña tiene un valor demasiado común.",
          "La contraseña está formada completamente por dígitos.",
        ],
      }),
    );

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText("Correo Electrónico"), {
      target: { value: "miembro@callejeros.ar" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByText("La contraseña tiene un valor demasiado común."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "La contraseña está formada completamente por dígitos.",
      ),
    ).toBeInTheDocument();
  });

  it("sin Recordarme guarda la sesión en sessionStorage y con Recordarme en localStorage, y vuelve a la página de origen", async () => {
    currentRedirectParam = "/alertas/reportar";

    // 1. Sin Recordarme -> sessionStorage
    fetchMock.mockResolvedValueOnce(jsonResponse(200, MOCK_LOGIN_RESPONSE));

    const { unmount } = render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Registrate acá" }),
    ).toHaveAttribute("href", "/registro?redirect=%2Falertas%2Freportar");

    fireEvent.change(screen.getByLabelText("Correo Electrónico"), {
      target: { value: "miembro@callejeros.ar" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "cambiame-clave-seed-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/alertas/reportar");
    });

    expect(
      window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();

    unmount();
    window.sessionStorage.clear();
    pushMock.mockReset();

    // 2. Con Recordarme tildado -> localStorage
    fetchMock.mockResolvedValueOnce(jsonResponse(200, MOCK_LOGIN_RESPONSE));

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText("Correo Electrónico"), {
      target: { value: "miembro@callejeros.ar" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "cambiame-clave-seed-123" },
    });
    fireEvent.click(screen.getByLabelText("Recordarme"));
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/alertas/reportar");
    });

    expect(
      window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
    expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });
});
