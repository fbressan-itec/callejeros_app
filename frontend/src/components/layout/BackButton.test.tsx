import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackButton } from "./BackButton";

const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
}));

describe("BackButton", () => {
  beforeEach(() => {
    backMock.mockClear();
  });

  it("tiene tamaño mínimo táctil de 44×44 px y vuelve hacia atrás si hay historial del mismo sitio", () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: `${window.location.origin}/adopciones`,
    });
    Object.defineProperty(window.history, "length", {
      configurable: true,
      value: 3,
    });

    render(<BackButton fallbackHref="/" />);

    const link = screen.getByRole("link", {
      name: "Volver a la pantalla anterior",
    });
    expect(link.className).toContain("min-w-[44px]");
    expect(link.className).toContain("min-h-[44px]");
    expect(link).toHaveAttribute("href", "/");

    fireEvent.click(link);
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("no usa history.back cuando se entró directo o se viene de login o registro", () => {
    // Entrada directa sin referrer
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "",
    });
    Object.defineProperty(window.history, "length", {
      configurable: true,
      value: 1,
    });

    const { rerender } = render(<BackButton fallbackHref="/alertas" />);
    const link = screen.getByRole("link", {
      name: "Volver a la pantalla anterior",
    });

    fireEvent.click(link);
    expect(backMock).not.toHaveBeenCalled();

    // Viniendo desde /login
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: `${window.location.origin}/login`,
    });
    Object.defineProperty(window.history, "length", {
      configurable: true,
      value: 4,
    });

    rerender(<BackButton fallbackHref="/alertas" />);
    fireEvent.click(link);
    expect(backMock).not.toHaveBeenCalled();
  });
});
