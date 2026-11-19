import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "./Footer";

describe("Footer", () => {
  it("muestra la marca institucional, enlaces de navegación, contacto y copyright", () => {
    render(<Footer />);

    expect(screen.getByAltText("Logo Callejeros")).toBeInTheDocument();
    expect(screen.getByText("Callejeros Río Cuarto")).toBeInTheDocument();
    expect(
      screen.getByText(/Plataforma comunitaria independiente/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Adoptar un Callejero" }),
    ).toHaveAttribute("href", "/adopciones");
    expect(
      screen.getByRole("link", { name: "Alerta y Reportes" }),
    ).toHaveAttribute("href", "/alertas");
    expect(screen.getByRole("link", { name: "Quiénes Somos" })).toHaveAttribute(
      "href",
      "/quienes-somos",
    );
    expect(
      screen.getByRole("link", { name: "Donaciones y Ayuda" }),
    ).toHaveAttribute("href", "/donaciones");

    expect(
      screen.getByText("Río Cuarto, Córdoba, Argentina"),
    ).toBeInTheDocument();
    expect(screen.getByText("contacto@callejeros-r4.org")).toBeInTheDocument();
    expect(
      screen.getByText(
        "© 2026 Callejeros Río Cuarto. Todos los derechos reservados.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Desarrollado con amor por la comunidad animalista."),
    ).toBeInTheDocument();
  });
});
