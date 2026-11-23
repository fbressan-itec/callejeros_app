import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Inicio", () => {
  it("muestra el carrusel institucional con el título principal", () => {
    render(<Home />);

    expect(
      screen.getByRole("region", { name: "Novedades destacadas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Dales una segunda oportunidad en Río Cuarto",
      }),
    ).toBeInTheDocument();
  });

  it("muestra la sección Sobre Nosotros con los datos institucionales y el acceso a Quiénes Somos", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Somos Callejeros Río IV",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("+150")).toBeInTheDocument();
    expect(screen.getByText("Mascotas adoptadas")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Voluntariado local")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conocé nuestra iniciativa" }),
    ).toHaveAttribute("href", "/quienes-somos");
  });

  it("muestra las tres formas de colaborar con sus accesos", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "¿Cómo podés colaborar hoy?",
      }),
    ).toBeInTheDocument();

    const accesses = [
      ["Donación Monetaria", "Ver Datos de Transferencia", "/donaciones"],
      ["Apadrinamiento", "Quiero ser Padrino", "/donaciones#apadrinar"],
      ["Tienda Benéfica", "Ir a la Tienda", "/tienda"],
    ] as const;

    for (const [title, cta, href] of accesses) {
      const card = screen.getByRole("heading", { level: 3, name: title })
        .parentElement?.parentElement as HTMLElement;
      expect(within(card).getByRole("link", { name: cta })).toHaveAttribute(
        "href",
        href,
      );
    }
  });
});
