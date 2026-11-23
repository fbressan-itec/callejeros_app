import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HERO_AUTOPLAY_MS,
  HERO_SLIDES,
  HeroCarousel,
} from "@/components/home/HeroCarousel";

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function activeSlideTitle(): string | null {
  const active = document.querySelector(
    '[aria-roledescription="slide"][data-active="true"]',
  );
  return active?.querySelector("h1, h2")?.textContent ?? null;
}

function swipe(element: Element, fromX: number, toX: number, deltaY = 0) {
  fireEvent.touchStart(element, {
    changedTouches: [{ clientX: fromX, clientY: 100 }],
  });
  fireEvent.touchEnd(element, {
    changedTouches: [{ clientX: toX, clientY: 100 + deltaY }],
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HeroCarousel", () => {
  it("muestra el primer slide con su título como encabezado principal y sus accesos", () => {
    render(<HeroCarousel />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Dales una segunda oportunidad en Río Cuarto",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver Mascotas" })).toHaveAttribute(
      "href",
      "/adopciones",
    );
    expect(screen.getByRole("link", { name: "Conocé Más" })).toHaveAttribute(
      "href",
      "/quienes-somos",
    );
    // Los slides ocultos no se leen ni se alcanzan con el teclado.
    expect(
      screen.queryByRole("link", { name: "Emitir Reporte" }),
    ).not.toBeInTheDocument();
  });

  it("tiene un puntito de 44×44 px por slide y marca el actual", () => {
    render(<HeroCarousel />);

    const dots = screen.getAllByRole("button", { name: /Ir al slide/ });
    expect(dots).toHaveLength(HERO_SLIDES.length);
    for (const dot of dots) {
      expect(dot).toHaveClass("min-h-[44px]", "min-w-[44px]");
    }
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).not.toHaveAttribute("aria-current");
  });

  it("cambia de slide con las flechas y los puntitos", () => {
    render(<HeroCarousel />);

    fireEvent.click(screen.getByRole("button", { name: "Slide siguiente" }));
    expect(activeSlideTitle()).toBe("¿Viste una mascota perdida o en riesgo?");
    expect(
      screen.getByRole("link", { name: "Emitir Reporte" }),
    ).toHaveAttribute("href", "/alertas");

    fireEvent.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(activeSlideTitle()).toBe(
      "Dales una segunda oportunidad en Río Cuarto",
    );

    // Desde el primero, "anterior" vuelve al último.
    fireEvent.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(activeSlideTitle()).toBe("Tu ayuda salva vidas cada fin de semana");
    expect(
      screen.getByRole("link", { name: "Quiero Colaborar" }),
    ).toHaveAttribute("href", "/donaciones");

    fireEvent.click(screen.getByRole("button", { name: "Ir al slide 2" }));
    expect(activeSlideTitle()).toBe("¿Viste una mascota perdida o en riesgo?");
  });

  it("se desliza con el dedo solo si el gesto es horizontal", () => {
    render(<HeroCarousel />);
    const carousel = screen.getByRole("region", {
      name: "Novedades destacadas",
    });

    swipe(carousel, 300, 200);
    expect(activeSlideTitle()).toBe("¿Viste una mascota perdida o en riesgo?");

    swipe(carousel, 200, 300);
    expect(activeSlideTitle()).toBe(
      "Dales una segunda oportunidad en Río Cuarto",
    );

    // Más vertical que horizontal: es scroll de la página, no cambia.
    swipe(carousel, 300, 200, 200);
    expect(activeSlideTitle()).toBe(
      "Dales una segunda oportunidad en Río Cuarto",
    );

    // Gesto muy corto: no cambia.
    swipe(carousel, 300, 280);
    expect(activeSlideTitle()).toBe(
      "Dales una segunda oportunidad en Río Cuarto",
    );
  });

  it("avanza solo cada 6 segundos y se pausa con el mouse encima", () => {
    render(<HeroCarousel />);

    act(() => {
      vi.advanceTimersByTime(HERO_AUTOPLAY_MS);
    });
    expect(activeSlideTitle()).toBe("¿Viste una mascota perdida o en riesgo?");

    const carousel = screen.getByRole("region", {
      name: "Novedades destacadas",
    });
    fireEvent.mouseEnter(carousel);
    act(() => {
      vi.advanceTimersByTime(HERO_AUTOPLAY_MS * 2);
    });
    expect(activeSlideTitle()).toBe("¿Viste una mascota perdida o en riesgo?");

    fireEvent.mouseLeave(carousel);
    act(() => {
      vi.advanceTimersByTime(HERO_AUTOPLAY_MS);
    });
    expect(activeSlideTitle()).toBe("Tu ayuda salva vidas cada fin de semana");
  });

  it("no avanza solo si la persona pidió reducir el movimiento", () => {
    mockReducedMotion(true);
    render(<HeroCarousel />);

    act(() => {
      vi.advanceTimersByTime(HERO_AUTOPLAY_MS * 3);
    });
    expect(activeSlideTitle()).toBe(
      "Dales una segunda oportunidad en Río Cuarto",
    );
  });
});
