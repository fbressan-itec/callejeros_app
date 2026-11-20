import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth/AuthProvider";
import {
  AUTH_SESSION_STORAGE_KEY,
  type AuthTokenResponse,
} from "@/lib/auth/session";

import RegisterPage from "./page";

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
  usePathname: () => "/registro",
  useSearchParams: () => ({
    get: (key: string) => (key === "redirect" ? currentRedirectParam : null),
  }),
}));

const MOCK_REGISTER_RESPONSE: AuthTokenResponse = {
  access: "new-access-token",
  refresh: "new-refresh-token",
  user: {
    id: 25,
    email: "vecino@callejeros.ar",
    first_name: "Lucía",
    last_name: "Gómez",
    phone: "3584123456",
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

function fillStep1Form({
  name = "Lucía Gómez",
  email = "vecino@callejeros.ar",
  password = "ClaveSegura123!",
  acceptTerms = true,
} = {}) {
  fireEvent.change(screen.getByLabelText("Nombre Completo"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText("Correo Electrónico"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: password },
  });
  if (acceptTerms) {
    fireEvent.click(
      screen.getByLabelText(
        /Acepto los términos de tenencia responsable y política de privacidad/i,
      ),
    );
  }
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubEnv("NEXT_PUBLIC_MOCK_VERIFICATION_CODE", "8596");
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

  it("renderiza el Paso 1 con ojito de contraseña y botones maquetados de Google y Facebook", () => {
    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Registrate" }),
    ).toBeInTheDocument();

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar u ocultar contraseña" }),
    );
    expect(passwordInput).toHaveAttribute("type", "text");

    expect(screen.getByRole("button", { name: /Google/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Facebook/i }),
    ).toBeInTheDocument();
  });

  it("valida con zod que la contraseña tenga al menos 6 caracteres con el mensaje exacto", async () => {
    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    fillStep1Form({ password: "12345" });
    fireEvent.click(screen.getByRole("button", { name: "Registrarme" }));

    expect(
      await screen.findByText("La contraseña debe tener al menos 6 caracteres"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Ingresá tu número de teléfono" }),
    ).toBeNull();
  });

  it("muestra debajo del campo de contraseña los errores que devuelve el back ('demasiado común' y 'completamente por dígitos')", async () => {
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
        <RegisterPage />
      </AuthProvider>,
    );

    fillStep1Form({ password: "123456" });
    fireEvent.click(screen.getByRole("button", { name: "Registrarme" }));

    // En Paso 2 toca "Más tarde" para enviar al back
    const skipBtn = await screen.findByRole("button", { name: "Más tarde" });
    fireEvent.click(skipBtn);

    // Vuelve al Paso 1 y muestra ambos mensajes del back debajo del campo de contraseña
    expect(
      await screen.findByText("La contraseña tiene un valor demasiado común."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "La contraseña está formada completamente por dígitos.",
      ),
    ).toBeInTheDocument();
  });

  it("permite saltear el teléfono con 'Más tarde', registra la cuenta, inicia sesión y vuelve a la página de origen", async () => {
    currentRedirectParam = "/adopciones";
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        ...MOCK_REGISTER_RESPONSE,
        user: {
          ...MOCK_REGISTER_RESPONSE.user,
          phone: "",
          is_phone_verified: false,
        },
      }),
    );

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    fillStep1Form();
    fireEvent.click(screen.getByRole("button", { name: "Registrarme" }));

    expect(
      await screen.findByRole("heading", {
        name: "Ingresá tu número de teléfono",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Más tarde" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/adopciones");
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/auth/register/");
    expect(JSON.parse(init.body)).toEqual({
      email: "vecino@callejeros.ar",
      password: "ClaveSegura123!",
      first_name: "Lucía",
      last_name: "Gómez",
      phone: "",
      verification_code: "",
    });
    expect(
      window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY),
    ).not.toBeNull();
  });

  it("en el Paso 3 muestra el código 8596 en rojo con asterisco y completa el registro con teléfono verificado", async () => {
    currentRedirectParam = "/alertas/reportar";
    fetchMock.mockResolvedValueOnce(jsonResponse(201, MOCK_REGISTER_RESPONSE));

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    fillStep1Form();
    fireEvent.click(screen.getByRole("button", { name: "Registrarme" }));

    const phoneInput = await screen.findByLabelText("Número de Teléfono");
    fireEvent.change(phoneInput, { target: { value: "358 4123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

    expect(
      await screen.findByRole("heading", { name: "Verificá tu teléfono" }),
    ).toBeInTheDocument();

    const mockNotice = document.getElementById("mock-sms-code-notice");
    expect(mockNotice).not.toBeNull();
    expect(mockNotice?.textContent).toContain("*");
    expect(mockNotice?.textContent).toContain("8596");
    expect(mockNotice?.textContent).toMatch(/maquetad/i);
    expect(mockNotice?.className).toContain("text-red-600");

    fireEvent.change(screen.getByLabelText("Dígito 1"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Dígito 2"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Dígito 3"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("Dígito 4"), {
      target: { value: "6" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

    expect(
      await screen.findByRole("heading", { name: "¡Teléfono Verificado!" }),
    ).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/auth/register/");
    expect(JSON.parse(init.body)).toEqual({
      email: "vecino@callejeros.ar",
      password: "ClaveSegura123!",
      first_name: "Lucía",
      last_name: "Gómez",
      phone: "358 4123456",
      verification_code: "8596",
    });

    await waitFor(
      () => {
        expect(pushMock).toHaveBeenCalledWith("/alertas/reportar");
      },
      { timeout: 2500 },
    );
  });

  it("en el Paso 3 vacía los 4 casilleros y vuelve el foco al primero si el código SMS es incorrecto", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        verification_code: ["El código de verificación es incorrecto."],
      }),
    );

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    fillStep1Form();
    fireEvent.click(screen.getByRole("button", { name: "Registrarme" }));

    const phoneInput = await screen.findByLabelText("Número de Teléfono");
    fireEvent.change(phoneInput, { target: { value: "358 4123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

    await screen.findByRole("heading", { name: "Verificá tu teléfono" });

    fireEvent.change(screen.getByLabelText("Dígito 1"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Dígito 2"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Dígito 3"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Dígito 4"), {
      target: { value: "4" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

    expect(
      await screen.findByText("El código de verificación es incorrecto."),
    ).toBeInTheDocument();

    const otp1 = screen.getByLabelText("Dígito 1");
    expect(otp1).toHaveValue("");
    expect(screen.getByLabelText("Dígito 2")).toHaveValue("");
    expect(screen.getByLabelText("Dígito 3")).toHaveValue("");
    expect(screen.getByLabelText("Dígito 4")).toHaveValue("");
    expect(document.activeElement).toBe(otp1);
  });
});
