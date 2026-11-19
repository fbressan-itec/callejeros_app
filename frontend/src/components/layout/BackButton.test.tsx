import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackButton, useNavigationHistoryTracker } from "./BackButton";

const backMock = vi.fn();
let currentPathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
  usePathname: () => currentPathname,
}));

function TestScene({ fallbackHref = "/" }: { fallbackHref?: string }) {
  useNavigationHistoryTracker();
  return <BackButton fallbackHref={fallbackHref} />;
}

describe("BackButton", () => {
  beforeEach(() => {
    backMock.mockClear();
    sessionStorage.clear();
    currentPathname = "/";
  });

  it("tiene tamaño mínimo táctil de 44×44 px y vuelve a la pantalla anterior cuando se navegó entre rutas del sitio", () => {
    currentPathname = "/adopciones";
    const { rerender } = render(<TestScene fallbackHref="/" />);

    // Simula navegación cliente con Link hacia una ficha interna
    currentPathname = "/mascotas/loki";
    rerender(<TestScene fallbackHref="/adopciones" />);

    const link = screen.getByRole("link", {
      name: "Volver a la pantalla anterior",
    });
    expect(link.className).toContain("min-w-[44px]");
    expect(link.className).toContain("min-h-[44px]");
    expect(link).toHaveAttribute("href", "/adopciones");

    fireEvent.click(link);
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("usa fallbackHref sin llamar a router.back cuando se entra directo por enlace o se viene de login/registro", () => {
    // 1. Entrada directa sin ruta previa en la sesión
    currentPathname = "/quienes-somos";
    const { rerender } = render(<TestScene fallbackHref="/" />);

    const link = screen.getByRole("link", {
      name: "Volver a la pantalla anterior",
    });

    fireEvent.click(link);
    expect(backMock).not.toHaveBeenCalled();

    // 2. Navegación desde /login hacia /alertas/reportar: no debe volver al formulario de login
    sessionStorage.clear();
    currentPathname = "/login";
    rerender(<TestScene fallbackHref="/alertas" />);

    currentPathname = "/alertas/reportar";
    rerender(<TestScene fallbackHref="/alertas" />);

    fireEvent.click(link);
    expect(backMock).not.toHaveBeenCalled();
  });
});
