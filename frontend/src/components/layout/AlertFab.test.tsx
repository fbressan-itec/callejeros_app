import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlertFab, FAB_HINT_STORAGE_KEY } from "./AlertFab";
import { AppHeader } from "./AppHeader";

let currentPathname = "/";
let isMobileViewport = true;
let prefersReducedMotion = false;

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

describe("AlertFab", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentPathname = "/";
    isMobileViewport = true;
    prefersReducedMotion = false;
    localStorage.clear();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          query === "(max-width: 639px)"
            ? isMobileViewport
            : query === "(prefers-reduced-motion: reduce)"
              ? prefersReducedMotion
              : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("apunta al formulario de reportar alerta en Inicio y Alerta Callejeros, al listado en Catálogo y Quiénes Somos, y no se muestra en otras rutas", () => {
    currentPathname = "/";
    const { rerender } = render(<AlertFab />);
    expect(document.getElementById("fab-alerta")).toHaveAttribute(
      "href",
      "/alertas/reportar",
    );

    currentPathname = "/alertas";
    rerender(<AlertFab />);
    expect(document.getElementById("fab-alerta")).toHaveAttribute(
      "href",
      "/alertas/reportar",
    );

    currentPathname = "/adopciones";
    rerender(<AlertFab />);
    expect(document.getElementById("fab-alerta")).toHaveAttribute(
      "href",
      "/alertas",
    );

    currentPathname = "/quienes-somos";
    rerender(<AlertFab />);
    expect(document.getElementById("fab-alerta")).toHaveAttribute(
      "href",
      "/alertas",
    );

    currentPathname = "/donaciones";
    rerender(<AlertFab />);
    expect(document.getElementById("fab-alerta")).toBeNull();
  });

  it("se oculta mientras el menú hamburguesa está abierto", () => {
    currentPathname = "/";
    render(
      <>
        <AppHeader />
        <AlertFab />
      </>,
    );

    const fab = document.getElementById("fab-alerta");
    const menuButton = screen.getByRole("button", {
      name: "Abrir menú de navegación",
    });

    expect(fab?.classList.contains("hidden")).toBe(false);

    fireEvent.click(menuButton);
    expect(fab?.classList.contains("hidden")).toBe(true);

    fireEvent.click(menuButton);
    expect(fab?.classList.contains("hidden")).toBe(false);
  });

  it("pasa a opacity-90 con scroll y vuelve a opacity-25 a los 2,5 s de inactividad", () => {
    currentPathname = "/adopciones";
    render(<AlertFab />);

    const fab = document.getElementById("fab-alerta")!;

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(fab.className).toContain("opacity-90");

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(fab.className).toContain("opacity-25");

    act(() => {
      fireEvent.scroll(window);
    });
    expect(fab.className).toContain("opacity-90");

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(fab.className).toContain("opacity-25");
  });

  it("en celular despliega el texto a los 2 s durante 3 s y deja de desplegarse después de tocarlo por primera vez", () => {
    currentPathname = "/";
    const { rerender } = render(<AlertFab />);

    const fab = document.getElementById("fab-alerta")!;
    const hint = fab.querySelector(".fab-hint") as HTMLElement;

    expect(hint).not.toBeNull();
    expect(hint.style.maxWidth).toBe("0px");

    // A los 2 s se despliega y se pone rojo sólido
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(hint.style.maxWidth).toBe("15rem");
    expect(fab.className).toContain("opacity-100");
    expect(fab).toHaveAttribute("data-hint-active", "1");

    // Dura 3 s desplegado y vuelve a reposo
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(hint.style.maxWidth).toBe("0px");
    expect(fab.className).toContain("opacity-25");

    // Al tocar el FAB se guarda callejeros_fab_usado = "1"
    fireEvent.click(fab);
    expect(localStorage.getItem(FAB_HINT_STORAGE_KEY)).toBe("1");

    // Si vuelve a entrar ya no se despliega a los 2 s
    currentPathname = "/alertas";
    rerender(<AlertFab />);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    const newHint = document
      .getElementById("fab-alerta")!
      .querySelector(".fab-hint") as HTMLElement;
    expect(newHint.style.maxWidth).toBe("0px");
  });
});
