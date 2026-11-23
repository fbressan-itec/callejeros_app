import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdoptionCatalog } from "@/components/pets/AdoptionCatalog";
import { ApiError } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/pagination";
import * as petsApi from "@/lib/pets/api";
import { buildPet } from "@/lib/pets/testing";
import type { PetListItem } from "@/lib/pets/types";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  usePathname: () => "/adopciones",
}));

function makePage(
  results: PetListItem[],
  overrides: Partial<PaginatedResponse<PetListItem>> = {},
): PaginatedResponse<PetListItem> {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
    ...overrides,
  };
}

describe("AdoptionCatalog", () => {
  const fetchPetsSpy = vi.spyOn(petsApi, "fetchPets");

  beforeEach(() => {
    fetchPetsSpy.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("muestra LoadingScreen mientras carga y luego renderiza las tarjetas", async () => {
    let resolveRequest!: (value: PaginatedResponse<PetListItem>) => void;
    fetchPetsSpy.mockReturnValueOnce(
      new Promise<PaginatedResponse<PetListItem>>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<AdoptionCatalog />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando mascotas...",
    );

    resolveRequest(
      makePage([
        buildPet({ id: 1, name: "Loki", species: "dog" }),
        buildPet({ id: 2, name: "Luna", species: "cat", sex: "female" }),
      ]),
    );

    expect(
      await screen.findByRole("heading", { name: "Loki" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Luna" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenCalledWith(
      { species: undefined, page: 1 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("filtra por especie al cambiar entre pestañas y permite limpiar filtros en estado vacío", async () => {
    fetchPetsSpy
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 1, name: "Loki", species: "dog" })]),
      )
      .mockResolvedValueOnce(makePage([]))
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 1, name: "Loki", species: "dog" })]),
      );

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(screen.getByRole("button", { name: "🐱 Gatos" }));

    expect(
      await screen.findByText("No encontramos animalitos con esos filtros."),
    ).toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenNthCalledWith(
      2,
      { species: "cat", page: 1 },
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpiar Filtros" }));

    expect(
      await screen.findByRole("heading", { name: "Loki" }),
    ).toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenNthCalledWith(
      3,
      { species: undefined, page: 1 },
      expect.anything(),
    );
  });

  it("muestra el error de la API si falla y permite reintentar", async () => {
    fetchPetsSpy
      .mockRejectedValueOnce(new ApiError(500, "Error interno del servidor."))
      .mockResolvedValueOnce(makePage([buildPet({ id: 4, name: "Bora" })]));

    render(<AdoptionCatalog />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Error interno del servidor.");

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("heading", { name: "Bora" }),
    ).toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenCalledTimes(2);
  });

  it("pagina de a 12 resultados y vuelve a página 1 al cambiar de especie", async () => {
    const page1Pets = [buildPet({ id: 1, name: "Loki" })];
    const page2Pets = [buildPet({ id: 13, name: "Thor" })];
    const dogPets = [buildPet({ id: 1, name: "Loki", species: "dog" })];

    fetchPetsSpy
      .mockResolvedValueOnce(
        makePage(page1Pets, {
          count: 15,
          next: "http://api.test/api/pets/?page=2",
        }),
      )
      .mockResolvedValueOnce(
        makePage(page2Pets, {
          count: 15,
          previous: "http://api.test/api/pets/?page=1",
        }),
      )
      .mockResolvedValueOnce(makePage(dogPets, { count: 1 }));

    render(<AdoptionCatalog />);

    await screen.findByRole("heading", { name: "Loki" });
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(
      await screen.findByRole("heading", { name: "Thor" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(fetchPetsSpy).toHaveBeenNthCalledWith(
      2,
      { species: undefined, page: 2 },
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: "🐶 Perros" }));

    await waitFor(() => {
      expect(fetchPetsSpy).toHaveBeenNthCalledWith(
        3,
        { species: "dog", page: 1 },
        expect.anything(),
      );
    });
  });
});
