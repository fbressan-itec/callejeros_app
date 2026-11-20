import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RecoverPasswordPage, { maskRecoverContact } from "./page";

const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
  usePathname: () => "/recuperar",
}));

describe("RecoverPasswordPage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_MOCK_VERIFICATION_CODE", "8596");
    backMock.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  it("enmascara correctamente email y teléfono con maskRecoverContact", () => {
    expect(maskRecoverContact("lucia@callejeros.ar", false)).toBe(
      "lu•••@callejeros.ar",
    );
    expect(maskRecoverContact("358 4123456", true)).toBe("•••• •••• 456");
  });

  it("permite alternar entre Email y Teléfono en el Paso 1 y valida el contacto con zod", async () => {
    render(<RecoverPasswordPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "¿Olvidaste tu contraseña?",
      }),
    ).toBeInTheDocument();

    const contactInput = screen.getByLabelText("Correo electrónico");
    expect(contactInput).toHaveAttribute("type", "email");

    fireEvent.change(contactInput, { target: { value: "correo-invalido" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(
      await screen.findByText("Ingresá un correo electrónico válido."),
    ).toBeInTheDocument();

    // Cambia a Teléfono
    fireEvent.click(screen.getByRole("radio", { name: /Teléfono/i }));
    const phoneInput = screen.getByLabelText("Número de teléfono");
    expect(phoneInput).toHaveAttribute("type", "tel");

    fireEvent.change(phoneInput, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(
      await screen.findByText("Ingresá un número de teléfono válido."),
    ).toBeInTheDocument();

    // Vuelve a cambiar a Email
    fireEvent.click(screen.getByRole("radio", { name: /Email/i }));
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "type",
      "email",
    );
  });

  it("en el Paso 2 muestra el código maquetado 8596 en rojo con asterisco y valida el código OTP", async () => {
    render(<RecoverPasswordPage />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "lucia@callejeros.ar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(
      await screen.findByRole("heading", { name: "Verificá tu email" }),
    ).toBeInTheDocument();
    expect(screen.getByText("lu•••@callejeros.ar")).toBeInTheDocument();

    const mockNotice = document.getElementById("mock-recover-code-notice");
    expect(mockNotice).not.toBeNull();
    expect(mockNotice?.textContent).toContain("*");
    expect(mockNotice?.textContent).toContain("8596");
    expect(mockNotice?.textContent).toMatch(/maquetad/i);
    expect(mockNotice?.className).toContain("text-red-600");

    // Código incompleto
    fireEvent.change(screen.getByLabelText("Dígito 1"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));
    expect(
      await screen.findByText("Ingresá los 4 dígitos del código."),
    ).toBeInTheDocument();

    // Código incorrecto
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
      await screen.findByText(
        "Código incorrecto. Probá con el código de demostración 8596.",
      ),
    ).toBeInTheDocument();

    // Código correcto (8596)
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
      await screen.findByRole("heading", {
        name: "Introducí tu nueva contraseña",
      }),
    ).toBeInTheDocument();
  });

  it("en el Paso 3 valida con zod el mínimo de 6 caracteres, coincidencia de contraseñas y muestra la confirmación final", async () => {
    render(<RecoverPasswordPage />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "lucia@callejeros.ar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await screen.findByRole("heading", { name: "Verificá tu email" });

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

    const pass1Input = await screen.findByLabelText("Nueva contraseña");
    const pass2Input = screen.getByLabelText("Repetí la contraseña");

    // 1. Menos de 6 caracteres
    fireEvent.change(pass1Input, { target: { value: "12345" } });
    fireEvent.change(pass2Input, { target: { value: "12345" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Restablecer contraseña" }),
    );

    expect(
      await screen.findAllByText(
        "La contraseña debe tener al menos 6 caracteres",
      ),
    ).toHaveLength(2);

    // 2. Contraseñas que no coinciden
    fireEvent.change(pass1Input, { target: { value: "ClaveSegura123!" } });
    fireEvent.change(pass2Input, { target: { value: "OtraClave456!" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Restablecer contraseña" }),
    );

    expect(
      await screen.findByText("Las contraseñas no coinciden."),
    ).toBeInTheDocument();

    // 3. Contraseñas válidas e iguales -> Éxito
    fireEvent.change(pass2Input, { target: { value: "ClaveSegura123!" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Restablecer contraseña" }),
    );

    expect(
      await screen.findByRole("heading", { name: "¡Contraseña actualizada!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
  });
});
