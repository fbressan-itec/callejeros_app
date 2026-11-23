import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LatestPetsSection } from "@/components/home/LatestPetsSection";
import { buildPet } from "@/lib/pets/testing";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LatestPetsSection", () => {
  it("muestra el encabezado y el acceso al catálogo en todos los estados", () => {
    render(<LatestPetsSection state={{ status: "loading" }} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Encontrá a tu compañero ideal",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver catálogo completo" }),
    ).toHaveAttribute("href", "/adopciones");
  });

  it("mientras carga muestra LoadingScreen", () => {
    render(<LatestPetsSection state={{ status: "loading" }} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando mascotas...",
    );
  });

  it("si falla muestra el mensaje de error", () => {
    render(
      <LatestPetsSection
        state={{ status: "error", message: "No pudimos conectarnos." }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos conectarnos.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sin mascotas muestra el estado vacío con el acceso al catálogo", () => {
    render(
      <LatestPetsSection
        state={{ status: "success", pets: [], publishedCount: 0 }}
      />,
    );

    expect(
      screen.getByText("Todavía no hay mascotas publicadas. ¡Volvé pronto!"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Ver catálogo completo" }),
    ).toHaveLength(2);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("muestra hasta 3 mascotas: la tercera y la tarjeta fija solo en escritorio", () => {
    const pets = [
      buildPet({ id: 1, name: "Thor" }),
      buildPet({ id: 2, name: "Bora" }),
      buildPet({ id: 3, name: "Misa" }),
    ];
    render(
      <LatestPetsSection
        state={{ status: "success", pets, publishedCount: 6 }}
      />,
    );

    const items = screen.getAllByTestId("home-pet-item");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Thor")).toBeInTheDocument();
    expect(items[0]).not.toHaveClass("hidden");
    expect(items[1]).not.toHaveClass("hidden");
    expect(items[2]).toHaveClass("hidden", "lg:block");

    const cta = screen.getByRole("link", { name: "Explorar Catálogo" });
    expect(cta).toHaveAttribute("href", "/adopciones");
    expect(cta.parentElement).toHaveClass("hidden", "lg:flex");
  });
});
