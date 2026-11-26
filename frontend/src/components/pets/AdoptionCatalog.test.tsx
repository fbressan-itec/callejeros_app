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
const mockAuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
  setSession: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  usePathname: () => "/adopciones",
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => mockAuthState,
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
  const addFavoriteSpy = vi.spyOn(petsApi, "addPetFavorite");
  const removeFavoriteSpy = vi.spyOn(petsApi, "removePetFavorite");

  beforeEach(() => {
    mockAuthState.isAuthenticated = false;
    fetchPetsSpy.mockReset();
    addFavoriteSpy.mockReset();
    removeFavoriteSpy.mockReset();
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
        expect.objectContaining({ species: "dog", page: 1 }),
        expect.anything(),
      );
    });
  });

  it("abre el modal de filtros, aplica Adoptados + búsqueda y muestra contador de filtros activos", async () => {
    fetchPetsSpy
      .mockResolvedValueOnce(makePage([buildPet({ id: 1, name: "Loki" })]))
      .mockResolvedValueOnce(
        makePage([
          buildPet({
            id: 9,
            name: "Pancho",
            status: "adopted",
            is_urgent: true,
          }),
        ]),
      );

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir filtros avanzados" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar ..."), {
      target: { value: "Pancho" },
    });
    fireEvent.click(screen.getByLabelText(/Adoptados/i));
    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADOS" }));

    expect(
      await screen.findByRole("heading", { name: "Pancho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("¡Ya encontró hogar! 🧡")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Abrir filtros avanzados (2 activos)",
      }),
    ).toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        search: "Pancho",
        adopted: true,
        page: 1,
      }),
      expect.anything(),
    );
  });

  it("muestra estado vacío propio de favoritos cuando solo Favoritos está activo y permite volver", async () => {
    fetchPetsSpy
      .mockResolvedValueOnce(makePage([buildPet({ id: 1, name: "Loki" })]))
      .mockResolvedValueOnce(makePage([]))
      .mockResolvedValueOnce(makePage([buildPet({ id: 1, name: "Loki" })]));

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir filtros avanzados" }),
    );
    fireEvent.click(screen.getByLabelText("Favoritos"));
    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADOS" }));

    expect(
      await screen.findByText("Todavía no tenés favoritos"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Abrir filtros avanzados (1 activo)",
      }),
    ).toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ favorites: true, page: 1 }),
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ver mascotas en adopción" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Loki" }),
    ).toBeInTheDocument();
    expect(fetchPetsSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ favorites: undefined, page: 1 }),
      expect.anything(),
    );
  });

  it("abre AuthRequiredModal al tocar favorito sin sesión sin llamar a la API", async () => {
    mockAuthState.isAuthenticated = false;
    fetchPetsSpy.mockResolvedValueOnce(
      makePage([buildPet({ id: 1, name: "Loki", is_favorite: false })]),
    );

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar a Loki en favoritos" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Iniciá sesión para continuar"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar Sesión" }),
    ).toHaveAttribute("href", "/login?redirect=%2Fadopciones");
    expect(addFavoriteSpy).not.toHaveBeenCalled();
  });

  it("marca y desmarca favoritos con sesión activa llamando a la API", async () => {
    mockAuthState.isAuthenticated = true;
    fetchPetsSpy.mockResolvedValueOnce(
      makePage([buildPet({ id: 1, name: "Loki", is_favorite: false })]),
    );
    addFavoriteSpy.mockResolvedValueOnce({ pet_id: 1, is_favorite: true });
    removeFavoriteSpy.mockResolvedValueOnce(undefined);

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar a Loki en favoritos" }),
    );

    await waitFor(() => {
      expect(addFavoriteSpy).toHaveBeenCalledWith(1);
    });
    const removeBtn = await screen.findByRole("button", {
      name: "Quitar a Loki de favoritos",
    });
    expect(removeBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(removeFavoriteSpy).toHaveBeenCalledWith(1);
    });
    const addBtn = await screen.findByRole("button", {
      name: "Guardar a Loki en favoritos",
    });
    expect(addBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("revierte el estado de favorito y muestra un aviso si la API falla", async () => {
    mockAuthState.isAuthenticated = true;
    fetchPetsSpy.mockResolvedValueOnce(
      makePage([buildPet({ id: 1, name: "Loki", is_favorite: false })]),
    );
    addFavoriteSpy.mockRejectedValueOnce(
      new ApiError(500, "No pudimos actualizar tu favorito."),
    );

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar a Loki en favoritos" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos actualizar tu favorito.");
    expect(
      screen.getByRole("button", { name: "Guardar a Loki en favoritos" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar aviso de error" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("quita la mascota en el acto cuando se desmarca con el filtro Favoritos activo", async () => {
    mockAuthState.isAuthenticated = true;
    fetchPetsSpy
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 1, name: "Loki", is_favorite: true })]),
      )
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 1, name: "Loki", is_favorite: true })]),
      );
    removeFavoriteSpy.mockResolvedValueOnce(undefined);

    render(<AdoptionCatalog />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir filtros avanzados" }),
    );
    fireEvent.click(screen.getByLabelText("Favoritos"));
    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADOS" }));
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a Loki de favoritos" }),
    );

    expect(
      await screen.findByText("Todavía no tenés favoritos"),
    ).toBeInTheDocument();
    expect(removeFavoriteSpy).toHaveBeenCalledWith(1);
  });
});
