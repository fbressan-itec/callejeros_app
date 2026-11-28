import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildPet } from "@/lib/pets/testing";

import Home from "./page";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function petsPage(count: number, names: string[]) {
  return {
    count,
    next: null,
    previous: null,
    results: names.map((name, index) => buildPet({ id: index + 1, name })),
  };
}

function statBox(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(
    jsonResponse(200, petsPage(6, ["Thor", "Bora", "Misa", "Loki"])),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

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

  it("mientras cargan las mascotas muestra LoadingScreen y una raya en el contador", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<Home />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando mascotas...",
    );
    expect(statBox("Mascotas en adopción")).toHaveTextContent("—");
  });

  it("muestra las 3 mascotas más nuevas de la API y el total de publicadas", async () => {
    render(<Home />);

    expect(
      await screen.findByRole("link", { name: "Conocer a Thor" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conocer a Misa" })).toBeVisible();
    // Se piden de la API ya ordenadas; se muestran solo las primeras 3.
    expect(
      screen.queryByRole("link", { name: "Conocer a Loki" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/pets/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(statBox("Mascotas en adopción")).toHaveTextContent("6");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("si la API falla muestra el error y deja el contador sin dato", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Home />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos conectarnos con el servidor.",
    );
    expect(statBox("Mascotas en adopción")).toHaveTextContent("—");
  });

  it("muestra la sección Sobre Nosotros con los datos institucionales y el acceso a Quiénes Somos", async () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Somos Callejeros Río IV",
      }),
    ).toBeInTheDocument();
    expect(statBox("Mascotas adoptadas")).toHaveTextContent("+150");
    expect(statBox("Voluntariado local")).toHaveTextContent("100%");
    expect(
      screen.getByRole("link", { name: "Conocé nuestra iniciativa" }),
    ).toHaveAttribute("href", "/quienes-somos");
    await screen.findByRole("link", { name: "Conocer a Thor" });
  });

  it("muestra las tres formas de colaborar con sus accesos", async () => {
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
    await screen.findByRole("link", { name: "Conocer a Thor" });
  });
});
